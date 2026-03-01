from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlalchemy.exc import SQLAlchemyError

from apps.api.models import Account, Category, InvestmentSnapshot, Transaction, TransactionLeg
from apps.api.repositories.reporting import ReportingRepository
from apps.api.shared import AccountType, CategoryType, TransactionType

# pylint: disable=redefined-outer-name


def _account(session, *, name: str, account_type: AccountType = AccountType.NORMAL) -> Account:
    account = Account(name=name, account_type=account_type)
    session.add(account)
    session.flush()
    session.refresh(account)
    return account


def _category(session, *, name: str, category_type: CategoryType) -> Category:
    category = Category(name=name, category_type=category_type)
    session.add(category)
    session.flush()
    session.refresh(category)
    return category


def _post_transaction(
    session,
    *,
    tx_type: TransactionType,
    occurred_at: datetime,
    description: str,
    category_id,
    legs: list[tuple[Account, Decimal]],
) -> Transaction:
    tx = Transaction(
        transaction_type=tx_type,
        occurred_at=occurred_at,
        posted_at=occurred_at,
        description=description,
        category_id=category_id,
    )
    session.add(tx)
    session.flush()
    session.add_all(
        [
            TransactionLeg(
                transaction_id=tx.id,
                account_id=account.id,
                amount=amount,
            )
            for account, amount in legs
        ]
    )
    session.commit()
    session.refresh(tx)
    return tx


def test_reporting_repository_quarterly_range_and_exclusion_paths(session) -> None:
    offset = _account(session, name="Offset")
    bank = _account(session, name="Main")
    groceries = _category(session, name="Groceries", category_type=CategoryType.EXPENSE)

    _post_transaction(
        session,
        tx_type=TransactionType.INCOME,
        occurred_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
        description="Salary",
        category_id=groceries.id,
        legs=[(bank, Decimal("5000")), (offset, Decimal("-5000"))],
    )
    _post_transaction(
        session,
        tx_type=TransactionType.EXPENSE,
        occurred_at=datetime(2024, 2, 15, tzinfo=timezone.utc),
        description="Food",
        category_id=groceries.id,
        legs=[(bank, Decimal("-200")), (offset, Decimal("200"))],
    )
    _post_transaction(
        session,
        tx_type=TransactionType.ADJUSTMENT,
        occurred_at=datetime(2024, 3, 5, tzinfo=timezone.utc),
        description="Fix",
        category_id=groceries.id,
        legs=[(bank, Decimal("-50")), (offset, Decimal("50"))],
    )

    repo = ReportingRepository(session)

    rows = repo.fetch_transaction_amounts(
        start=datetime(2024, 1, 1, tzinfo=timezone.utc),
        end=datetime(2024, 4, 1, tzinfo=timezone.utc),
        account_ids=None,
    )
    assert rows
    assert all(row.description in {"Salary", "Food", "Fix"} for row in rows)

    quarterly = repo.get_quarterly_totals(
        year=2024,
        account_ids=[bank.id],
        category_ids=[groceries.id],
    )
    assert len(quarterly) == 1
    assert quarterly[0].year == 2024
    assert quarterly[0].quarter == 1

    monthly = repo.get_range_monthly_totals(
        start_date=date(2024, 1, 1),
        end_date=date(2024, 2, 29),
        account_ids=[bank.id],
        category_ids=[groceries.id],
    )
    assert [item.period for item in monthly] == [date(2024, 1, 1), date(2024, 2, 1)]

    deltas = repo.daily_deltas_between(
        start=datetime(2024, 1, 1, tzinfo=timezone.utc),
        end=datetime(2024, 4, 1, tzinfo=timezone.utc),
    )
    assert deltas

    avg = repo.average_daily_net(days=365)
    assert isinstance(avg, Decimal)

    total = repo.current_balance_total()
    assert total == Decimal("4750")

    assert repo.list_account_ids_by_type(AccountType.NORMAL, account_ids=[bank.id]) == [bank.id]

    assert repo._coerce_date("2024-01-01") == date(2024, 1, 1)
    assert repo._accumulate(
        Decimal("-5"),
        TransactionType.EXPENSE,
        Decimal("0"),
        Decimal("0"),
        Decimal("0"),
        Decimal("0"),
    ) == (Decimal("0"), Decimal("5"), Decimal("0"), Decimal("0"))


def test_reporting_repository_snapshot_extraction_and_latest_value(session) -> None:
    repo = ReportingRepository(session)
    assert repo.latest_investment_value() == Decimal("0")

    session.add_all(
        [
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name=None,
                snapshot_date=date(2024, 1, 1),
                portfolio_value=None,
                raw_text="raw",
                parsed_payload={},
                cleaned_payload=None,
            ),
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name="Broker",
                snapshot_date=date(2024, 1, 2),
                portfolio_value=Decimal("100"),
                raw_text="raw",
                parsed_payload={},
                cleaned_payload=None,
            ),
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name=None,
                snapshot_date=date(2024, 1, 2),
                portfolio_value=None,
                raw_text="raw",
                parsed_payload={"accounts": {"Broker": "140", "Bad": "nanx"}},
                cleaned_payload=None,
            ),
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name=None,
                snapshot_date=date(2024, 1, 3),
                portfolio_value=None,
                raw_text="raw",
                parsed_payload={},
                cleaned_payload={"accounts": {"Broker": "200", "Savings": "20"}},
            ),
        ]
    )
    session.commit()

    points = repo.list_investment_snapshots_until(end=date(2024, 1, 3))
    assert points[-1] == (date(2024, 1, 3), Decimal("220"))
    assert repo.latest_investment_value() == Decimal("220")

    class _StringOnce:
        def __init__(self) -> None:
            self._used = False

        def __str__(self) -> str:
            if not self._used:
                self._used = True
                raise TypeError("boom")
            return "12.5"

    class _AlwaysBad:
        def __str__(self) -> str:
            return "not-a-number"

    assert repo._coerce_snapshot_amount(_StringOnce()) == Decimal("12.5")
    assert repo._coerce_snapshot_amount(_AlwaysBad()) is None
    assert repo._coerce_snapshot_amount("") is None

    assert repo._extract_snapshot_account_values(
        account_name="Fallback",
        portfolio_value=Decimal("10"),
        parsed_payload=None,
        cleaned_payload=None,
    ) == {"Fallback": Decimal("10")}


def test_reporting_repository_scalar_fallback_branches(monkeypatch, session) -> None:
    repo = ReportingRepository(session)

    bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))
    monkeypatch.setattr(repo.session, "get_bind", lambda: bind)
    aware = datetime(2024, 1, 1, tzinfo=timezone.utc)
    assert repo._normalize_datetime(aware) == aware

    class _OneOnly:
        def one(self):
            return (Decimal("12"),)

    class _FirstOnly:
        def first(self):
            return (Decimal("8"),)

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _OneOnly())
    assert repo.sum_legs_before(before=aware, account_ids=None) == Decimal("12")

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _FirstOnly())
    assert repo.sum_legs_before(before=aware, account_ids=None) == Decimal("8")

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: Decimal("5"))
    assert repo.sum_legs_before(before=aware, account_ids=None) == Decimal("5")

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _OneOnly())
    assert repo.current_balance_total(account_ids=None) == Decimal("12")

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _FirstOnly())
    assert repo.current_balance_total(account_ids=None) == Decimal("8")

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: Decimal("3"))
    assert repo.current_balance_total(account_ids=None) == Decimal("3")


def test_reporting_repository_additional_missing_paths(monkeypatch, session) -> None:
    repo = ReportingRepository(session)
    repo._excluded_account_ids = {UUID(int=1)}  # pylint: disable=protected-access
    aware = datetime(2024, 1, 1, tzinfo=timezone.utc)
    repo_for_quarterly = ReportingRepository(session)

    class _ScalarOne:
        def scalar_one(self):
            return Decimal("11")

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _ScalarOne())
    assert repo.sum_legs_before(before=aware, account_ids=None) == Decimal("11")
    assert repo.current_balance_total(account_ids=None) == Decimal("11")

    class _AvgRows:
        def all(self):
            return [(date(2024, 1, 1), Decimal("2")), (date(2024, 1, 2), Decimal("4"))]

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _AvgRows())
    assert repo.average_daily_net(days=10) == Decimal("3")

    class _SnapshotRows:
        def all(self):
            return [
                (
                    date(2024, 1, 1),
                    "Broker",
                    Decimal("100"),
                    None,
                    {"accounts": {"Broker": "150"}},
                    datetime(2024, 1, 1),
                    datetime(2024, 1, 1),
                ),
                (
                    date(2024, 1, 1),
                    "Broker",
                    Decimal("90"),
                    None,
                    {"accounts": {"Broker": "90"}},
                    datetime(2023, 12, 31),
                    datetime(2023, 12, 31),
                ),
            ]

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _SnapshotRows())
    points = repo.list_investment_snapshots_until(end=date(2024, 1, 1))
    assert points == [(date(2024, 1, 1), Decimal("150"))]

    repo_for_quarterly._fetch_legs = lambda **_kwargs: [  # type: ignore[assignment]  # pylint: disable=protected-access
        (datetime(2023, 12, 31, tzinfo=timezone.utc), Decimal("10"), TransactionType.INCOME),
        (datetime(2024, 1, 1, tzinfo=timezone.utc), Decimal("-5"), TransactionType.EXPENSE),
    ]
    quarterly = repo_for_quarterly.get_quarterly_totals(year=2024)
    assert len(quarterly) == 1
    assert quarterly[0].year == 2024

    class _LegRows:
        def all(self):
            return [(aware, Decimal("1"), TransactionType.INCOME.value)]

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _LegRows())
    fetched = repo._fetch_legs()  # pylint: disable=protected-access
    assert fetched[0][2] == TransactionType.INCOME


def test_reporting_repository_refresh_materialized_views_error(monkeypatch, session) -> None:
    repo = ReportingRepository(session)
    bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))
    events: list[str] = []

    monkeypatch.setattr(repo.session, "get_bind", lambda: bind)
    monkeypatch.setattr(
        repo.session,
        "execute",
        lambda _stmt: (_ for _ in ()).throw(SQLAlchemyError("boom")),
    )
    monkeypatch.setattr(repo.session, "rollback", lambda: events.append("rollback"))
    monkeypatch.setattr(repo.session, "commit", lambda: events.append("commit"))

    with pytest.raises(SQLAlchemyError):
        repo.refresh_materialized_views(["vw_one"], concurrently=False)
    assert events == ["rollback"]


def test_reporting_repository_additional_filter_and_accumulate_branches(
    monkeypatch, session
) -> None:
    repo = ReportingRepository(session)
    start = datetime(2024, 1, 1, tzinfo=timezone.utc)
    end = datetime(2024, 2, 1, tzinfo=timezone.utc)

    class _Rows:
        def all(self):
            return []

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _Rows())
    repo._excluded_account_ids = set()  # pylint: disable=protected-access
    assert repo.daily_deltas_between(start=start, end=end, account_ids=None) == []
    assert repo.average_daily_net(days=30, account_ids=None) == Decimal("0")

    assert (
        repo._extract_snapshot_account_values(  # pylint: disable=protected-access
            account_name="Broker",
            portfolio_value="bad-decimal",
            parsed_payload=None,
            cleaned_payload=None,
        )
        == {}
    )

    assert repo._accumulate(  # pylint: disable=protected-access
        Decimal("0"),
        TransactionType.ADJUSTMENT,
        Decimal("1"),
        Decimal("2"),
        Decimal("3"),
        Decimal("4"),
    ) == (Decimal("1"), Decimal("2"), Decimal("3"), Decimal("4"))
    assert repo._accumulate(  # pylint: disable=protected-access
        Decimal("0"),
        TransactionType.EXPENSE,
        Decimal("1"),
        Decimal("2"),
        Decimal("3"),
        Decimal("4"),
    ) == (Decimal("1"), Decimal("2"), Decimal("3"), Decimal("4"))

    repo._excluded_account_ids = {UUID(int=42)}  # pylint: disable=protected-access
    assert repo._fetch_legs() == []  # pylint: disable=protected-access


def test_reporting_repository_snapshot_none_timestamps_and_fetch_legs_without_exclusions(
    monkeypatch, session
) -> None:
    repo = ReportingRepository(session)

    class _SnapshotRows:
        def all(self):
            return [
                (
                    date(2024, 1, 1),
                    "Broker",
                    Decimal("100"),
                    None,
                    None,
                    None,
                    None,
                )
            ]

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _SnapshotRows())
    assert repo.list_investment_snapshots_until(end=date(2024, 1, 1)) == [
        (date(2024, 1, 1), Decimal("100"))
    ]

    class _LegRows:
        def all(self):
            return []

    monkeypatch.setattr(repo.session, "exec", lambda _stmt: _LegRows())
    repo._excluded_account_ids = set()  # pylint: disable=protected-access
    assert repo._fetch_legs() == []  # pylint: disable=protected-access
