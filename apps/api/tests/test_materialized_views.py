from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Iterator, cast
from uuid import UUID

import pytest
from sqlalchemy import text
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from apps.api.models import Account, Category, Transaction, TransactionLeg
from apps.api.shared import (
    AccountType,
    CategoryType,
    TransactionType,
    configure_engine,
    create_or_replace_materialized_views,
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


def _seed_sample_data(session: Session) -> None:
    asset = Account(account_type=AccountType.NORMAL)
    savings = Account(account_type=AccountType.NORMAL)
    debt = Account(account_type=AccountType.DEBT)
    session.add_all([asset, savings, debt])
    session.flush()

    category = Category(name="Salary", category_type=CategoryType.INCOME)
    session.add(category)
    session.flush()

    occurred = datetime(2024, 5, 10, tzinfo=timezone.utc)
    salary_tx = Transaction(
        category_id=category.id,
        transaction_type=TransactionType.INCOME,
        occurred_at=occurred,
        posted_at=occurred,
    )
    session.add(salary_tx)
    session.flush()

    session.add_all(
        [
            TransactionLeg(
                transaction_id=salary_tx.id, account_id=asset.id, amount=Decimal("1000.00")
            ),
            TransactionLeg(
                transaction_id=salary_tx.id, account_id=savings.id, amount=Decimal("-1000.00")
            ),
        ]
    )

    loan_tx = Transaction(
        category_id=None,
        transaction_type=TransactionType.TRANSFER,
        occurred_at=occurred,
        posted_at=occurred,
    )
    session.add(loan_tx)
    session.flush()
    session.add_all(
        [
            TransactionLeg(
                transaction_id=loan_tx.id, account_id=debt.id, amount=Decimal("-400.00")
            ),
            TransactionLeg(
                transaction_id=loan_tx.id, account_id=asset.id, amount=Decimal("400.00")
            ),
        ]
    )
    session.commit()


def test_create_or_replace_views_on_sqlite() -> None:
    engine = get_engine()

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        _seed_sample_data(session)

    create_or_replace_materialized_views(engine, replace=True)

    with Session(engine) as session:
        monthly_query = (
            "SELECT period, account_id, income_total, expense_total, net_total "
            "FROM vw_monthly_account_totals"
        )
        monthly_rows = cast(
            Any, session.exec(text(monthly_query))  # type: ignore[call-overload]
        ).all()
        assert len(monthly_rows) == 3
        monthly = {
            UUID(row[1]): (
                row[0],
                Decimal(str(row[2])),
                Decimal(str(row[3])),
                Decimal(str(row[4])),
            )
            for row in monthly_rows
        }
        assert sum(entry[3] for entry in monthly.values()) == Decimal("0")

        yearly_query = (
            "SELECT year, category_id, income_total, expense_total, net_total "
            "FROM vw_category_yearly_totals"
        )
        yearly = cast(Any, session.exec(text(yearly_query))).all()  # type: ignore[call-overload]
        assert len(yearly) == 1
        year, category_id, income_total, expense_total, net_total = yearly[0]
        assert year == 2024
        assert category_id is not None
        assert Decimal(income_total) == Decimal("1000.00")
        assert Decimal(expense_total) == Decimal("1000.00")
        assert Decimal(net_total) == Decimal("0")

        net_worth_query = "SELECT total_assets, total_liabilities, net_worth FROM vw_net_worth"
        net_worth = cast(
            Any, session.exec(text(net_worth_query))  # type: ignore[call-overload]
        ).one()
        assets, liabilities, net = [Decimal(str(value)) for value in net_worth]
        assert assets == Decimal("400.00")
        assert liabilities == Decimal("400.00")
        assert net == Decimal("0")


def test_create_views_subset() -> None:
    engine = get_engine()
    create_or_replace_materialized_views(engine, replace=True, view_names=["vw_net_worth"])

    with Session(engine) as session:
        query = "SELECT * FROM sqlite_master WHERE name = 'vw_net_worth'"
        result = cast(Any, session.exec(text(query)))  # type: ignore[call-overload]
        assert result.first() is not None
