from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

from apps.api.models import Account, InvestmentSnapshot, Transaction, TransactionLeg
from apps.api.services.investments import InvestmentSnapshotService
from apps.api.shared import AccountType, TransactionType


def test_investment_overview_includes_cashflow_series_and_since_start_totals(session) -> None:
    now = datetime.now(timezone.utc)
    investment = Account(name="Broker Account", account_type=AccountType.INVESTMENT, is_active=True)
    cash = Account(name="Cash Account", account_type=AccountType.NORMAL, is_active=True)
    session.add(investment)
    session.add(cash)
    session.commit()

    start_snapshot_date = (now - timedelta(days=40)).date()
    end_snapshot_date = (now - timedelta(days=2)).date()

    session.add(
        InvestmentSnapshot(
            provider="nordnet",
            report_type="portfolio_report",
            account_name=None,
            snapshot_date=start_snapshot_date,
            portfolio_value=Decimal("1000.00"),
            raw_text="seed",
            parsed_payload={"accounts": {"Broker Account": "1000"}},
        )
    )
    session.add(
        InvestmentSnapshot(
            provider="nordnet",
            report_type="portfolio_report",
            account_name=None,
            snapshot_date=end_snapshot_date,
            portfolio_value=Decimal("2000.00"),
            raw_text="seed",
            parsed_payload={"accounts": {"Broker Account": "2000"}},
        )
    )
    session.commit()

    deposit_dt = now - timedelta(days=10)
    withdrawal_dt = now - timedelta(days=5)

    deposit_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=deposit_dt,
        posted_at=deposit_dt,
        description="Deposit",
    )
    deposit_tx.legs = [
        TransactionLeg(
            transaction_id=deposit_tx.id,
            account_id=investment.id,
            amount=Decimal("1000.00"),
        ),
        TransactionLeg(
            transaction_id=deposit_tx.id,
            account_id=cash.id,
            amount=Decimal("-1000.00"),
        ),
    ]

    withdrawal_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=withdrawal_dt,
        posted_at=withdrawal_dt,
        description="Withdrawal",
    )
    withdrawal_tx.legs = [
        TransactionLeg(
            transaction_id=withdrawal_tx.id,
            account_id=investment.id,
            amount=Decimal("-200.00"),
        ),
        TransactionLeg(
            transaction_id=withdrawal_tx.id,
            account_id=cash.id,
            amount=Decimal("200.00"),
        ),
    ]

    session.add(deposit_tx)
    session.add(withdrawal_tx)
    session.commit()

    service = InvestmentSnapshotService(session)
    overview = service.investment_overview()

    portfolio = overview["portfolio"]
    cashflow = portfolio["cashflow"]
    assert cashflow["added_since_start"] == Decimal("1000.00")
    assert cashflow["withdrawn_since_start"] == Decimal("200.00")
    assert cashflow["net_since_start"] == Decimal("800.00")

    assert "cashflow_series" in portfolio
    assert portfolio["cashflow_series"]
    months = [row["period"] for row in portfolio["cashflow_series"]]
    assert months == sorted(months)

    assert portfolio["growth_since_start_ex_transfers"]["amount"] == Decimal("200.00")

    assert overview["accounts"]
    account = overview["accounts"][0]
    assert account["cashflow_since_start_added"] == Decimal("1000.00")
    assert account["cashflow_since_start_withdrawn"] == Decimal("200.00")
    assert account["cashflow_since_start_net"] == Decimal("800.00")
    assert account["growth_since_start_ex_transfers"]["amount"] == Decimal("200.00")


def test_investment_service_list_method_delegation(session) -> None:
    service = InvestmentSnapshotService(session)
    service.repository = SimpleNamespace(
        list_snapshots=lambda limit=None: [f"snapshot-{limit}"]  # type: ignore[assignment]
    )
    service.tx_repository = SimpleNamespace(
        list_transactions=lambda **kwargs: [kwargs]  # type: ignore[assignment]
    )

    assert service.list_snapshots(limit=7) == ["snapshot-7"]
    rows = service.list_transactions(holding="ABC", tx_type="buy", limit=3)
    assert rows[0]["holding"] == "ABC"
    assert rows[0]["tx_type"] == "buy"
    assert rows[0]["limit"] == 3


def test_investment_overview_future_snapshot_handles_empty_cashflow_series(session) -> None:
    investment = Account(name="Future Broker", account_type=AccountType.INVESTMENT, is_active=True)
    session.add(investment)
    session.commit()

    session.add(
        InvestmentSnapshot(
            provider="manual",
            report_type="portfolio_report",
            account_name="Future Broker",
            snapshot_date=(datetime.now(timezone.utc) + timedelta(days=20)).date(),
            portfolio_value=Decimal("1500"),
            raw_text="future",
            parsed_payload=None,
            cleaned_payload={"accounts": {"Future Broker": "1500", "BadValue": "NaNx"}},
        )
    )
    session.commit()

    overview = InvestmentSnapshotService(session).investment_overview()
    assert overview["portfolio"]["cashflow_series"] == []
    assert overview["portfolio"]["current_value"] == Decimal("1500")


def test_investment_overview_helper_branches(session) -> None:
    service = InvestmentSnapshotService(session)
    assert service._coerce_decimal(None) is None
    assert service._coerce_decimal("") is None
    assert service._coerce_decimal("bad-number") is None
    assert service._coerce_decimal("12.4") == Decimal("12.4")

    exact = Account(name="Main Broker", account_type=AccountType.INVESTMENT)
    partial = Account(name="Broker Long Name", account_type=AccountType.INVESTMENT)
    blank = Account(name=" ", account_type=AccountType.INVESTMENT)
    accounts = [blank, exact, partial]
    by_key = {"main broker": exact}

    assert service._match_account("", accounts, by_key) is None
    assert service._match_account("main broker", accounts, by_key) is exact
    assert service._match_account("long name", accounts, by_key) is partial
    longer = Account(name="Broker Super Long", account_type=AccountType.INVESTMENT)
    shorter = Account(name="Broker", account_type=AccountType.INVESTMENT)
    best = service._match_account("broker super long account", [longer, shorter], {})
    assert best is longer


def test_investment_overview_mocked_exec_edge_paths(monkeypatch, session) -> None:
    service = InvestmentSnapshotService(session)
    today = datetime.now(timezone.utc).date()
    acc_valid = SimpleNamespace(id=UUID(int=101), name="Primary", icon="coins")
    acc_no_id = SimpleNamespace(id=None, name="NoId", icon=None)

    class _Result:
        def __init__(self, *, all_rows=None, one_value=None):
            self._all_rows = all_rows if all_rows is not None else []
            self._one_value = one_value

        def all(self):
            return self._all_rows

        def one(self):
            return self._one_value

    snapshot_rows = [
        (
            date(today.year - 1, 12, 1),
            "Primary",
            None,
            None,
            None,
            datetime(today.year - 1, 12, 1, tzinfo=timezone.utc),
            None,
        ),
        (
            date(today.year - 1, 12, 1),
            None,
            None,
            {"accounts": {"Unknown": "10", "Primary": "100"}},
            None,
            datetime(today.year - 1, 12, 2, tzinfo=timezone.utc),
            datetime(today.year - 1, 12, 2, tzinfo=timezone.utc),
        ),
        (
            date(today.year - 1, 12, 1),
            None,
            None,
            {"accounts": {"Primary": "90"}},
            None,
            datetime(today.year - 1, 12, 1, tzinfo=timezone.utc),
            datetime(today.year - 1, 12, 1, tzinfo=timezone.utc),
        ),
        (
            date(today.year, 1, 1),
            None,
            None,
            None,
            {"accounts": {"Primary": "120", "Bad": "x"}},
            datetime(today.year, 1, 1, tzinfo=timezone.utc),
            datetime(today.year, 1, 1, tzinfo=timezone.utc),
        ),
        (
            today,
            "Primary",
            Decimal("150"),
            None,
            None,
            datetime(today.year, today.month, today.day, tzinfo=timezone.utc),
            datetime(today.year, today.month, today.day, tzinfo=timezone.utc),
        ),
    ]

    recent_rows = [
        (uuid4(), datetime.now(timezone.utc), "unknown", UUID(int=999), Decimal("5")),
        (uuid4(), datetime.now(timezone.utc), "zero", acc_valid.id, Decimal("0")),
        (uuid4(), datetime.now(timezone.utc), "valid", acc_valid.id, Decimal("7")),
    ]

    monthly_rows = [
        (None, Decimal("10")),
        (datetime(today.year - 1, 12, 15, tzinfo=timezone.utc), Decimal("10")),
        (datetime(today.year, 1, 15, tzinfo=timezone.utc), Decimal("-5")),
        (datetime(today.year, 1, 20, tzinfo=timezone.utc), Decimal("0")),
    ]

    def _exec(stmt):
        sql = str(stmt)
        if "FROM account" in sql and "account_type" in sql:
            return _Result(all_rows=[acc_valid, acc_no_id])
        if "FROM investment_snapshot" in sql:
            return _Result(all_rows=snapshot_rows)
        if "min(" in sql and "transaction_leg.account_id" in sql and "GROUP BY" not in sql:
            return _Result(one_value=datetime(today.year - 2, 1, 1, tzinfo=timezone.utc))
        if "min(" in sql and "transaction_legs.account_id" in sql and "GROUP BY" in sql:
            return _Result(
                all_rows=[
                    (None, datetime(today.year - 2, 1, 1, tzinfo=timezone.utc)),
                    (acc_valid.id, datetime(today.year - 2, 1, 1, tzinfo=timezone.utc)),
                ]
            )
        if "deposits" in sql and "withdrawals" in sql:
            return _Result(all_rows=[(acc_valid.id, Decimal("10"), Decimal("3"))])
        if "SELECT transactions.occurred_at, transaction_legs.amount" in sql:
            return _Result(all_rows=monthly_rows)
        if "SELECT transactions.id, transactions.occurred_at" in sql:
            return _Result(all_rows=recent_rows)
        return _Result(all_rows=[])

    monkeypatch.setattr(service.session, "exec", _exec)
    overview = service.investment_overview()

    assert overview["portfolio"]["cashflow_series"]
    assert "recent_cashflows" in overview
    assert all(
        row["account_id"] == acc_valid.id for row in overview["accounts"] if row["account_id"]
    )


def test_investment_overview_without_investment_accounts(monkeypatch, session) -> None:
    service = InvestmentSnapshotService(session)
    today = datetime.now(timezone.utc).date()
    no_id_account = SimpleNamespace(id=None, name="Ghost", icon=None)

    class _Result:
        def __init__(self, rows=None, one_value=None):
            self._rows = rows if rows is not None else []
            self._one = one_value

        def all(self):
            return self._rows

        def one(self):
            return self._one

    def _exec(stmt):
        sql = str(stmt)
        if "FROM account" in sql and "account_type" in sql:
            return _Result(rows=[no_id_account])
        if "FROM investment_snapshot" in sql:
            return _Result(
                rows=[
                    (
                        today,
                        "Ghost",
                        "not-a-number",
                        None,
                        None,
                        datetime.now(timezone.utc),
                        datetime.now(timezone.utc),
                    )
                ]
            )
        return _Result(rows=[])

    monkeypatch.setattr(service.session, "exec", _exec)
    overview = service.investment_overview()
    assert overview["accounts"] == []
    assert overview["portfolio"]["cashflow"]["added_12m"] == Decimal("0")


def test_investment_overview_cashflow_starts_before_snapshot(session) -> None:
    now = datetime.now(timezone.utc)
    investment = Account(
        name="Early Flow Broker", account_type=AccountType.INVESTMENT, is_active=True
    )
    cash = Account(name="Cash", account_type=AccountType.NORMAL, is_active=True)
    session.add_all([investment, cash])
    session.commit()

    session.add(
        InvestmentSnapshot(
            provider="manual",
            report_type="portfolio_report",
            account_name="Early Flow Broker",
            snapshot_date=(now - timedelta(days=10)).date(),
            portfolio_value=Decimal("200"),
            raw_text="raw",
            parsed_payload={"accounts": {"Early Flow Broker": "200"}},
        )
    )
    session.commit()

    tx_date = now - timedelta(days=30)
    tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=tx_date,
        posted_at=tx_date,
        description="Seed transfer",
    )
    session.add(tx)
    session.flush()
    session.add_all(
        [
            TransactionLeg(transaction_id=tx.id, account_id=investment.id, amount=Decimal("75")),
            TransactionLeg(transaction_id=tx.id, account_id=cash.id, amount=Decimal("-75")),
        ]
    )
    session.commit()

    overview = InvestmentSnapshotService(session).investment_overview()
    assert overview["portfolio"]["growth_since_start_ex_transfers"]["amount"] is not None
    assert overview["accounts"][0]["growth_since_start_ex_transfers"]["amount"] is not None


def test_investment_overview_handles_unmapped_account_series_bucket(monkeypatch, session) -> None:
    service = InvestmentSnapshotService(session)
    today = datetime.now(timezone.utc).date()
    real_account = SimpleNamespace(id=UUID(int=500), name="Real", icon=None)
    ghost_account = SimpleNamespace(id=UUID(int=900), name="Ghost", icon=None)

    class _Result:
        def __init__(self, rows=None, one_value=None):
            self._rows = rows if rows is not None else []
            self._one = one_value

        def all(self):
            return self._rows

        def one(self):
            return self._one

    def _exec(stmt):
        sql = str(stmt)
        if "FROM account" in sql and "account_type" in sql:
            return _Result(rows=[real_account])
        if "FROM investment_snapshot" in sql:
            return _Result(
                rows=[
                    (
                        today,
                        "Ghost",
                        Decimal("10"),
                        None,
                        None,
                        datetime.now(timezone.utc),
                        datetime.now(timezone.utc),
                    )
                ]
            )
        if "min(" in sql and "transaction_legs.account_id" in sql and "GROUP BY" not in sql:
            return _Result(one_value=datetime(today.year, 1, 1, tzinfo=timezone.utc))
        if "min(" in sql and "transaction_legs.account_id" in sql and "GROUP BY" in sql:
            return _Result(
                rows=[(real_account.id, datetime(today.year, 1, 1, tzinfo=timezone.utc))]
            )
        if "deposits" in sql and "withdrawals" in sql:
            return _Result(rows=[(real_account.id, Decimal("0"), Decimal("0"))])
        if "SELECT transactions.occurred_at, transaction_legs.amount" in sql:
            return _Result(rows=[])
        if "SELECT transactions.id, transactions.occurred_at" in sql:
            return _Result(rows=[])
        return _Result(rows=[])

    monkeypatch.setattr(service.session, "exec", _exec)
    monkeypatch.setattr(service, "_match_account", lambda *_args, **_kwargs: ghost_account)
    overview = service.investment_overview()
    assert overview["portfolio"]["current_value"] == Decimal("10")
