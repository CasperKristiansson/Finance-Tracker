from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Iterator
from uuid import UUID

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, select

from apps.api.jobs import accrue_interest
from apps.api.models import Account, Category, Loan, LoanEvent, Transaction, TransactionLeg
from apps.api.shared import (
    AccountType,
    CategoryType,
    InterestCompound,
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
        SQLModel.metadata.drop_all(engine)


def _create_accounts_and_category(session: Session) -> tuple[UUID, UUID, UUID, UUID]:
    debt_account = Account(name="Debt", account_type=AccountType.DEBT)
    expense_account = Account(name="Expense", account_type=AccountType.NORMAL)
    offset_account = Account(name="Offset", account_type=AccountType.NORMAL)
    session.add_all([debt_account, expense_account, offset_account])
    session.flush()

    category = Category(name="Interest", category_type=CategoryType.INTEREST)
    session.add(category)
    session.flush()

    return debt_account.id, expense_account.id, offset_account.id, category.id


def _prime_existing_activity(session: Session, debt_id: UUID, offset_id: UUID) -> None:
    occurred = datetime(2024, 1, 1, tzinfo=timezone.utc)
    tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=occurred,
        posted_at=occurred,
    )
    session.add(tx)
    session.flush()
    session.add_all(
        [
            TransactionLeg(transaction_id=tx.id, account_id=debt_id, amount=Decimal("-500.00")),
            TransactionLeg(transaction_id=tx.id, account_id=offset_id, amount=Decimal("500.00")),
        ]
    )
    session.commit()


def test_accrue_interest_posts_transaction_and_updates_loan():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        debt_id, expense_id, offset_id, category_id = _create_accounts_and_category(session)
        _prime_existing_activity(session, debt_id, offset_id)

        loan = Loan(
            account_id=debt_id,
            origin_principal=Decimal("10000.00"),
            current_principal=Decimal("10000.00"),
            interest_rate_annual=Decimal("0.12"),
            interest_compound=InterestCompound.MONTHLY,
        )
        session.add(loan)
        session.commit()

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        created = accrue_interest(
            session,
            as_of=date(2024, 2, 1),
            interest_category_id=category_id,
            expense_account_id=expense_id,
        )
        assert len(created) == 1
        tx = created[0]
        session.refresh(tx)
        assert tx.category_id == category_id
        assert tx.transaction_type == TransactionType.EXPENSE
        legs = session.exec(
            select(TransactionLeg).where(TransactionLeg.transaction_id == tx.id)
        ).all()
        assert len(legs) == 2
        amounts = {leg.account_id: leg.amount for leg in legs}
        assert amounts[debt_id] == Decimal("100.00")
        assert amounts[expense_id] == Decimal("-100.00")

        loan = session.exec(select(Loan).where(Loan.account_id == debt_id)).one()
        assert loan.current_principal == Decimal("10100.00")

        events = session.exec(select(LoanEvent).where(LoanEvent.loan_id == loan.id)).all()
        assert len(events) == 1
        assert events[0].event_type == "interest_accrual"


def test_accrue_interest_ignores_zero_rate_loans() -> None:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        debt_id, expense_id, offset_id, category_id = _create_accounts_and_category(session)
        _prime_existing_activity(session, debt_id, offset_id)

        loan = Loan(
            account_id=debt_id,
            origin_principal=Decimal("5000.00"),
            current_principal=Decimal("5000.00"),
            interest_rate_annual=Decimal("0.00"),
            interest_compound=InterestCompound.MONTHLY,
        )
        session.add(loan)
        session.commit()

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        created = accrue_interest(
            session,
            as_of=date(2024, 3, 1),
            interest_category_id=category_id,
            expense_account_id=expense_id,
        )
        assert not created

        loan = session.exec(select(Loan).where(Loan.account_id == debt_id)).one()
        assert loan.current_principal == Decimal("5000.00")
