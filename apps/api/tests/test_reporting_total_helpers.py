from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from apps.api.models import Account, InvestmentSnapshot, Transaction, TransactionLeg
from apps.api.repositories.reporting import NetWorthPoint, TransactionAmountRow
from apps.api.services.reporting_total import (
    _compress_points_monthly,
    _ensure_category,
    _ensure_source,
    _month_end,
    _next_month,
    build_total_overview,
)
from apps.api.shared import AccountType, TransactionType

# mypy: ignore-errors


# pylint: disable=unnecessary-lambda


class _RepoStub:
    def __init__(self, *, user_id: str, rows_all, rows_by_account, balances, networth, snapshots):
        self.user_id = user_id
        self._rows_all = rows_all
        self._rows_by_account = rows_by_account
        self._balances = balances
        self._networth = networth
        self._snapshots = snapshots

    def fetch_transaction_amounts(
        self, start, end, account_ids=None
    ):  # pylint: disable=unused-argument
        if account_ids is None:
            return list(self._rows_all)
        if len(account_ids) == 1:
            return list(self._rows_by_account.get(account_ids[0], []))
        return list(self._rows_all)

    def sum_legs_before(self, before, account_ids=None):  # pylint: disable=unused-argument
        if not account_ids:
            return Decimal("0")
        key = tuple(sorted(str(item) for item in account_ids))
        return self._balances.get(key, Decimal("0"))

    def current_balance_total(self, account_ids=None):
        if not account_ids:
            return Decimal("0")
        key = tuple(sorted(str(item) for item in account_ids))
        return self._balances.get(key, Decimal("0"))

    def get_net_worth_history(self, account_ids=None):  # pylint: disable=unused-argument
        return list(self._networth)

    def list_investment_snapshots_until(self, end):  # pylint: disable=unused-argument
        return list(self._snapshots)


def _row(
    tx_id: int, occurred_at: datetime, tx_type: TransactionType, amount: str, *, description: str
):
    return TransactionAmountRow(
        id=UUID(int=tx_id),
        occurred_at=occurred_at,
        transaction_type=tx_type,
        description=description,
        notes=None,
        category_id=UUID(int=tx_id + 100),
        category_name=f"Category {tx_id}",
        category_icon=None,
        category_color_hex=None,
        amount=Decimal(amount),
        inflow=Decimal(amount) if Decimal(amount) > 0 else Decimal("0"),
        outflow=-Decimal(amount) if Decimal(amount) < 0 else Decimal("0"),
    )


def test_reporting_total_helper_primitives() -> None:
    assert _month_end(2025, 2).isoformat() == "2025-02-28"
    assert _next_month(date(2025, 12, 31)).isoformat() == "2026-01-01"

    points = [(date(2025, 1, 10), Decimal("10")), (date(2025, 2, 20), Decimal("20"))]
    compressed = _compress_points_monthly(points=points, as_of=date(2025, 3, 1))
    assert compressed[-1][0] == date(2025, 3, 1)
    assert compressed[-1][1] == Decimal("20")

    mapping = {}
    row = _row(
        1,
        datetime(2025, 1, 1, tzinfo=timezone.utc),
        TransactionType.EXPENSE,
        "-10",
        description="x",
    )
    bucket = _ensure_category(mapping, row=row)
    assert bucket["name"] == "Category 1"
    src = _ensure_source({}, "Store")
    assert src["source"] == "Store"
    assert _compress_points_monthly(points=[], as_of=date(2025, 3, 1)) == []

    mapping = {str(row.category_id): bucket}
    updated_row = TransactionAmountRow(
        id=UUID(int=11),
        occurred_at=datetime(2025, 1, 2, tzinfo=timezone.utc),
        transaction_type=TransactionType.EXPENSE,
        description="x",
        notes=None,
        category_id=row.category_id,
        category_name="Updated",
        category_icon="cart",
        category_color_hex="#000000",
        amount=Decimal("-2"),
        inflow=Decimal("0"),
        outflow=Decimal("2"),
    )
    updated_bucket = _ensure_category(mapping, row=updated_row)
    assert updated_bucket["name"] == "Updated"
    assert updated_bucket["icon"] == "cart"
    assert updated_bucket["color_hex"] == "#000000"
    assert _ensure_source({"Store": src}, "Store") is src

    blank_row = TransactionAmountRow(
        id=UUID(int=12),
        occurred_at=datetime(2025, 1, 3, tzinfo=timezone.utc),
        transaction_type=TransactionType.EXPENSE,
        description="x",
        notes=None,
        category_id=row.category_id,
        category_name=None,
        category_icon=None,
        category_color_hex=None,
        amount=Decimal("-1"),
        inflow=Decimal("0"),
        outflow=Decimal("1"),
    )
    unchanged_bucket = _ensure_category(mapping, row=blank_row)
    assert unchanged_bucket["name"] == "Updated"


def test_build_total_overview_account_scope(session) -> None:
    normal = Account(name="Main", account_type=AccountType.NORMAL)
    debt = Account(name="Debt", account_type=AccountType.DEBT)
    session.add_all([normal, debt])
    session.commit()

    row_income = _row(
        1,
        datetime(2024, 1, 10, tzinfo=timezone.utc),
        TransactionType.INCOME,
        "500",
        description="Salary",
    )
    row_expense = _row(
        2,
        datetime(2024, 1, 12, tzinfo=timezone.utc),
        TransactionType.EXPENSE,
        "-200",
        description="Groceries",
    )

    repo = _RepoStub(
        user_id="integration-user",
        rows_all=[row_income, row_expense],
        rows_by_account={normal.id: [row_income, row_expense], debt.id: []},
        balances={
            tuple(sorted([str(normal.id)])): Decimal("300"),
            tuple(sorted([str(debt.id)])): Decimal("-1000"),
            tuple(sorted([str(normal.id), str(debt.id)])): Decimal("-700"),
        },
        networth=[NetWorthPoint(period=date(2024, 1, 31), net_worth=Decimal("-1000"))],
        snapshots=[],
    )

    result = build_total_overview(
        session=session,
        repository=repo,
        as_of=date(2024, 1, 31),
        account_id_list=[normal.id, debt.id],
        net_worth_points=[(date(2024, 1, 31), Decimal("300"))],
        classify_income_expense=lambda row: (row.inflow, row.outflow),
        merchant_key=lambda raw: raw or "Unknown",
    )

    assert result["kpis"]["lifetime_income"] == Decimal("500")
    assert result["kpis"]["lifetime_expense"] == Decimal("200")
    assert result["debt"]["total_current"] == Decimal("1000")
    assert result["accounts"]


def test_build_total_overview_includes_investments_when_unscoped(session) -> None:
    cash = Account(name="Cash", account_type=AccountType.NORMAL)
    investment = Account(name="Broker", account_type=AccountType.INVESTMENT)
    session.add_all([cash, investment])
    session.commit()

    snapshot = InvestmentSnapshot(
        provider="manual",
        report_type="portfolio_report",
        account_name="Broker",
        snapshot_date=date(2024, 2, 1),
        portfolio_value=Decimal("1200"),
        raw_text="raw",
        parsed_payload={"accounts": {"Broker": 1200}},
    )
    session.add(snapshot)

    tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=datetime(2024, 1, 15, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 15, tzinfo=timezone.utc),
    )
    session.add(tx)
    session.flush()
    session.add_all(
        [
            TransactionLeg(transaction_id=tx.id, account_id=investment.id, amount=Decimal("100")),
            TransactionLeg(transaction_id=tx.id, account_id=cash.id, amount=Decimal("-100")),
        ]
    )
    session.commit()

    row_income = _row(
        5,
        datetime(2024, 1, 10, tzinfo=timezone.utc),
        TransactionType.INCOME,
        "300",
        description="Salary",
    )

    repo = _RepoStub(
        user_id="integration-user",
        rows_all=[row_income],
        rows_by_account={cash.id: [row_income], investment.id: []},
        balances={
            tuple(sorted([str(cash.id)])): Decimal("300"),
            tuple(sorted([str(investment.id)])): Decimal("100"),
        },
        networth=[],
        snapshots=[(date(2024, 2, 1), Decimal("1200"))],
    )

    result = build_total_overview(
        session=session,
        repository=repo,
        as_of=date(2024, 2, 1),
        account_id_list=None,
        net_worth_points=[(date(2024, 2, 1), Decimal("1300"))],
        classify_income_expense=lambda row: (row.inflow, row.outflow),
        merchant_key=lambda raw: raw or "Unknown",
    )

    assert result["investments"] is not None
    investments = result["investments"]
    assert investments["accounts_latest"]
    assert result["kpis"]["investments_value"] == Decimal("1200")


def test_build_total_overview_yoy_and_no_investment_accounts(session) -> None:
    cash = Account(name="Cash", account_type=AccountType.NORMAL)
    debt = Account(name="Debt", account_type=AccountType.DEBT)
    session.add_all([cash, debt])
    session.commit()

    prev_expense = _row(
        30,
        datetime(2023, 12, 10, tzinfo=timezone.utc),
        TransactionType.EXPENSE,
        "-50",
        description="Store X",
    )
    current_expense = _row(
        31,
        datetime(2024, 1, 10, tzinfo=timezone.utc),
        TransactionType.EXPENSE,
        "-80",
        description="Store X",
    )
    current_income = _row(
        32,
        datetime(2024, 1, 12, tzinfo=timezone.utc),
        TransactionType.INCOME,
        "200",
        description="Employer",
    )
    current_transfer = _row(
        33,
        datetime(2024, 1, 15, tzinfo=timezone.utc),
        TransactionType.TRANSFER,
        "-20",
        description="Move",
    )

    repo = _RepoStub(
        user_id="integration-user",
        rows_all=[prev_expense, current_expense, current_income, current_transfer],
        rows_by_account={
            cash.id: [current_income, current_expense, current_transfer],
            debt.id: [current_transfer],
        },
        balances={
            tuple(sorted([str(cash.id)])): Decimal("100"),
            tuple(sorted([str(debt.id)])): Decimal("-500"),
            tuple(sorted([str(cash.id), str(debt.id)])): Decimal("-400"),
        },
        networth=[NetWorthPoint(period=date(2024, 1, 31), net_worth=Decimal("-400"))],
        snapshots=[],
    )

    result = build_total_overview(
        session=session,
        repository=repo,
        as_of=date(2025, 1, 31),
        account_id_list=None,
        net_worth_points=[
            (date(2023, 12, 31), Decimal("-450")),
            (date(2024, 1, 31), Decimal("-400")),
        ],
        classify_income_expense=lambda row: (row.inflow, row.outflow),
        merchant_key=lambda raw: (raw or "Unknown").split()[0],
    )

    assert result["expense_category_changes_yoy"]
    assert result["income_source_changes_yoy"]
    assert result["expense_source_changes_yoy"]
    assert result["accounts"]
    assert result["investments"] is not None
    assert result["investments"]["yearly"]


def test_build_total_overview_investment_snapshot_payload_variants(session) -> None:
    cash = Account(name="Cash", account_type=AccountType.NORMAL)
    broker = Account(name="Broker", account_type=AccountType.INVESTMENT)
    session.add_all([cash, broker])
    session.commit()

    session.add_all(
        [
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name=None,
                snapshot_date=date(2024, 1, 1),
                portfolio_value=None,
                raw_text="raw",
                parsed_payload={"accounts": {"Broker": "700"}},
                cleaned_payload={"accounts": {"Broker": "750"}},
            ),
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name="Broker",
                snapshot_date=date(2024, 2, 1),
                portfolio_value=Decimal("900"),
                raw_text="raw",
                parsed_payload={},
                cleaned_payload=None,
            ),
        ]
    )
    session.commit()

    repo = _RepoStub(
        user_id="integration-user",
        rows_all=[],
        rows_by_account={cash.id: [], broker.id: []},
        balances={tuple(sorted([str(cash.id)])): Decimal("0")},
        networth=[],
        snapshots=[(date(2024, 1, 1), Decimal("750")), (date(2024, 2, 1), Decimal("900"))],
    )

    result = build_total_overview(
        session=session,
        repository=repo,
        as_of=date(2024, 2, 1),
        account_id_list=None,
        net_worth_points=[(date(2024, 2, 1), Decimal("900"))],
        classify_income_expense=lambda row: (row.inflow, row.outflow),
        merchant_key=lambda raw: raw or "Unknown",
    )

    investments = result["investments"]
    assert investments is not None
    assert investments["accounts_latest"][0]["account_name"] == "Broker"
    assert investments["accounts_latest"][0]["value"] == Decimal("900")


def test_build_total_overview_additional_branch_paths(session, monkeypatch) -> None:
    cash = Account(name="Cash Main", account_type=AccountType.NORMAL)
    broker = Account(name="Broker Main", account_type=AccountType.INVESTMENT)
    session.add_all([cash, broker])
    session.commit()

    session.add_all(
        [
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name=None,
                snapshot_date=date(2024, 1, 1),
                portfolio_value=None,
                raw_text="raw",
                parsed_payload={"accounts": {"Unknown": "111"}},
                cleaned_payload=None,
            ),
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name="Broker Main",
                snapshot_date=date(2024, 2, 1),
                portfolio_value=Decimal("200"),
                raw_text="raw",
                parsed_payload={},
                cleaned_payload=None,
            ),
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name=None,
                snapshot_date=date(2024, 2, 2),
                portfolio_value=None,
                raw_text="raw",
                parsed_payload="bad",
                cleaned_payload=[],
            ),
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name="Unknown Broker",
                snapshot_date=date(2024, 2, 3),
                portfolio_value=Decimal("400"),
                raw_text="raw",
                parsed_payload=None,
                cleaned_payload=None,
            ),
        ]
    )
    session.commit()

    income_old = _row(
        81,
        datetime(2023, 6, 2, tzinfo=timezone.utc),
        TransactionType.INCOME,
        "100",
        description="Old income",
    )
    expense_new = _row(
        82,
        datetime(2024, 2, 3, tzinfo=timezone.utc),
        TransactionType.EXPENSE,
        "-90",
        description="New expense",
    )
    transfer_in = _row(
        80,
        datetime(2024, 2, 2, tzinfo=timezone.utc),
        TransactionType.TRANSFER,
        "20",
        description="Transfer in",
    )

    repo = _RepoStub(
        user_id="integration-user",
        rows_all=[income_old, expense_new, transfer_in],
        rows_by_account={cash.id: [income_old, expense_new, transfer_in], broker.id: []},
        balances={
            tuple(sorted([str(cash.id)])): Decimal("20"),
            tuple(sorted([str(broker.id)])): Decimal("200"),
        },
        networth=[NetWorthPoint(period=date(2024, 2, 1), net_worth=Decimal("220"))],
        snapshots=[(date(2024, 2, 1), Decimal("200")), (date(2026, 1, 1), Decimal("300"))],
    )

    original_exec = session.exec

    class _ContributionRows:
        def all(self):
            return [(None, Decimal("10"), Decimal("1"))]

    def _exec(stmt):
        sql = str(stmt)
        if "deposits" in sql and "withdrawals" in sql:
            return _ContributionRows()
        return original_exec(stmt)

    monkeypatch.setattr(session, "exec", _exec)

    result = build_total_overview(
        session=session,
        repository=repo,
        as_of=date(2024, 12, 31),
        account_id_list=None,
        net_worth_points=[(date(2024, 2, 1), Decimal("220"))],
        classify_income_expense=lambda row: (row.inflow, row.outflow),
        merchant_key=lambda raw: raw or "Unknown",
    )

    cash_row = next(row for row in result["accounts"] if row["name"] == "Cash Main")
    assert cash_row["transfers_in"] == Decimal("20")
    investments = result["investments"] or {"yearly": []}
    assert all(item["year"] <= 2024 for item in investments["yearly"])
