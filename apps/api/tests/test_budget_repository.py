from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from apps.api.models import Account, Budget, Category, Transaction, TransactionLeg
from apps.api.repositories.budget import BudgetRepository
from apps.api.shared import (
    AccountType,
    BudgetPeriod,
    CategoryType,
    TransactionType,
    configure_engine,
    get_default_user_id,
    get_engine,
    scope_session_to_user,
)


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    configure_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    try:
        yield
    finally:
        engine.dispose()
        SQLModel.metadata.drop_all(engine)


def _seed_transaction(
    session: Session,
    *,
    category_id,
    amount: Decimal,
    occurred_at: datetime,
) -> None:
    account = Account(name="Account", account_type=AccountType.NORMAL)
    session.add(account)
    session.flush()

    txn = Transaction(
        category_id=category_id,
        transaction_type=TransactionType.EXPENSE if amount < 0 else TransactionType.INCOME,
        occurred_at=occurred_at,
        posted_at=occurred_at,
        description="Seed",
    )
    session.add(txn)
    session.flush()

    leg_out = TransactionLeg(
        transaction_id=txn.id,
        account_id=account.id,
        amount=amount,
    )
    leg_balancer = TransactionLeg(
        transaction_id=txn.id,
        account_id=account.id,
        amount=-amount,
    )
    session.add(leg_out)
    session.add(leg_balancer)
    session.commit()


def test_list_with_spend_monthly():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        category = Category(name="Food", category_type=CategoryType.EXPENSE)
        budget = Budget(
            category_id=category.id,
            period=BudgetPeriod.MONTHLY,
            amount=Decimal("400.00"),
        )
        session.add(category)
        session.add(budget)
        session.commit()

        _seed_transaction(
            session,
            category_id=category.id,
            amount=Decimal("-50.00"),
            occurred_at=datetime.now(timezone.utc),
        )

        repo = BudgetRepository(session)
        results = repo.list_with_spend(as_of=datetime.now(timezone.utc))

    assert len(results) == 1
    budget_row, spent = results[0]
    assert budget_row.id == budget.id
    assert spent == Decimal("50.00")


def test_list_with_spend_ignores_out_of_period():
    now = datetime.now(timezone.utc)
    last_year = now - timedelta(days=370)
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        category = Category(name="Salary", category_type=CategoryType.INCOME)
        budget = Budget(
            category_id=category.id,
            period=BudgetPeriod.YEARLY,
            amount=Decimal("10000.00"),
        )
        session.add(category)
        session.add(budget)
        session.commit()

        _seed_transaction(
            session,
            category_id=category.id,
            amount=Decimal("2500.00"),
            occurred_at=last_year,
        )

        repo = BudgetRepository(session)
        results = repo.list_with_spend(as_of=now)

    assert len(results) == 1
    _budget_row, spent = results[0]
    assert spent == Decimal("0")
