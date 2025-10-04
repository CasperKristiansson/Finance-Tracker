from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Iterable

import pytest

from apps.api.models import Account, Transaction, TransactionLeg
from apps.api.repositories.reporting import (
    LifetimeTotals,
    MonthlyTotals,
    ReportingRepository,
    YearlyTotals,
)
from apps.api.services.reporting import ReportingService
from apps.api.shared import AccountType, TransactionType

# pylint: disable=redefined-outer-name


@pytest.fixture()
def reporting_repo(session) -> ReportingRepository:
    return ReportingRepository(session)


def _create_account(session, *, account_type: AccountType = AccountType.NORMAL) -> Account:
    account = Account(account_type=account_type)
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def _post_transaction(
    session,
    *,
    account: Account,
    counter_account: Account,
    amount: Decimal,
    occurred_at: datetime,
    description: str,
    transaction_type: TransactionType,
) -> Transaction:
    transaction = Transaction(
        transaction_type=transaction_type,
        description=description,
        occurred_at=occurred_at,
        posted_at=occurred_at,
    )
    session.add(transaction)
    session.flush()

    session.add_all(
        [
            TransactionLeg(
                transaction_id=transaction.id,
                account_id=account.id,
                amount=amount,
            ),
            TransactionLeg(
                transaction_id=transaction.id,
                account_id=counter_account.id,
                amount=-amount,
            ),
        ]
    )
    session.commit()
    session.refresh(transaction)
    return transaction


def _seed_sample_transactions(session) -> tuple[Account, Iterable[Transaction]]:
    bank = _create_account(session)
    offset = _create_account(session)

    transactions = [
        _post_transaction(
            session,
            account=bank,
            counter_account=offset,
            amount=Decimal("5000.00"),
            occurred_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
            description="Salary",
            transaction_type=TransactionType.INCOME,
        ),
        _post_transaction(
            session,
            account=bank,
            counter_account=offset,
            amount=Decimal("-200.00"),
            occurred_at=datetime(2024, 1, 12, tzinfo=timezone.utc),
            description="Groceries",
            transaction_type=TransactionType.EXPENSE,
        ),
        _post_transaction(
            session,
            account=bank,
            counter_account=offset,
            amount=Decimal("1000.00"),
            occurred_at=datetime(2024, 2, 5, tzinfo=timezone.utc),
            description="Bonus",
            transaction_type=TransactionType.INCOME,
        ),
        _post_transaction(
            session,
            account=bank,
            counter_account=offset,
            amount=Decimal("-1200.00"),
            occurred_at=datetime(2024, 3, 1, tzinfo=timezone.utc),
            description="Rent",
            transaction_type=TransactionType.EXPENSE,
        ),
        _post_transaction(
            session,
            account=bank,
            counter_account=offset,
            amount=Decimal("4000.00"),
            occurred_at=datetime(2023, 11, 15, tzinfo=timezone.utc),
            description="Year end bonus",
            transaction_type=TransactionType.INCOME,
        ),
    ]
    return bank, transactions


def test_monthly_yearly_and_total_reports(reporting_repo, session):
    bank_account, _transactions = _seed_sample_transactions(session)

    monthly = reporting_repo.get_monthly_totals(year=2024, account_ids=[bank_account.id])
    assert monthly == [
        MonthlyTotals(
            period=date(2024, 1, 1),
            income=Decimal("5000.00"),
            expense=Decimal("200.00"),
            net=Decimal("4800.00"),
        ),
        MonthlyTotals(
            period=date(2024, 2, 1),
            income=Decimal("1000.00"),
            expense=Decimal("0"),
            net=Decimal("1000.00"),
        ),
        MonthlyTotals(
            period=date(2024, 3, 1),
            income=Decimal("0"),
            expense=Decimal("1200.00"),
            net=Decimal("-1200.00"),
        ),
    ]

    yearly = reporting_repo.get_yearly_totals(account_ids=[bank_account.id])
    assert yearly == [
        YearlyTotals(
            year=2023, income=Decimal("4000.00"), expense=Decimal("0"), net=Decimal("4000.00")
        ),
        YearlyTotals(
            year=2024, income=Decimal("6000.00"), expense=Decimal("1400.00"), net=Decimal("4600.00")
        ),
    ]

    totals = reporting_repo.get_total_summary(account_ids=[bank_account.id])
    assert totals == LifetimeTotals(
        income=Decimal("10000.00"),
        expense=Decimal("1400.00"),
        net=Decimal("8600.00"),
    )


def test_reporting_service_wraps_repository(session):
    bank_account, _transactions = _seed_sample_transactions(session)
    service = ReportingService(session)

    monthly = service.monthly_report(year=2024, account_ids=[bank_account.id])
    yearly = service.yearly_report(account_ids=[bank_account.id])
    totals = service.total_report(account_ids=[bank_account.id])

    assert len(monthly) == 3
    assert yearly[-1].net == Decimal("4600.00")
    assert totals.net == Decimal("8600.00")


def test_materialized_view_refresh_noop_on_sqlite(reporting_repo):
    # Should not raise even though SQLite does not support materialized views.
    reporting_repo.refresh_materialized_views(["vw_monthly_account_totals"])


def test_materialized_view_refresh_executes_for_postgres(monkeypatch, reporting_repo):
    calls: list[str] = []

    def fake_execute(statement):
        statement_text = getattr(statement, "text", str(statement))
        calls.append(statement_text)

    def fake_commit():
        calls.append("commit")

    dummy_bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))

    monkeypatch.setattr(reporting_repo.session, "get_bind", lambda: dummy_bind)
    monkeypatch.setattr(reporting_repo.session, "execute", fake_execute)
    monkeypatch.setattr(reporting_repo.session, "commit", fake_commit)
    monkeypatch.setattr(reporting_repo.session, "rollback", lambda: calls.append("rollback"))

    reporting_repo.refresh_materialized_views(["vw_monthly_account_totals"], concurrently=True)

    assert any(
        call == "REFRESH MATERIALIZED VIEW CONCURRENTLY vw_monthly_account_totals" for call in calls
    )
    assert "commit" in calls
    assert "rollback" not in calls
