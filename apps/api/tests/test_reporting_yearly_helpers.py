from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from apps.api.models import Account, InvestmentSnapshot, Transaction, TransactionLeg
from apps.api.repositories.reporting import TransactionAmountRow
from apps.api.services.reporting_yearly import build_yearly_overview_enhancements
from apps.api.shared import AccountType, TransactionType

# mypy: ignore-errors


# pylint: disable=unnecessary-lambda


class _RepoYearly:
    def __init__(self, *, user_id: str, rows_by_account, balances):
        self.user_id = user_id
        self._rows_by_account = rows_by_account
        self._balances = balances

    def sum_legs_before(self, before, account_ids=None):  # pylint: disable=unused-argument
        if not account_ids:
            return Decimal("0")
        return self._balances.get(tuple(sorted(str(item) for item in account_ids)), Decimal("0"))

    def fetch_transaction_amounts(
        self, start, end, account_ids=None
    ):  # pylint: disable=unused-argument
        if account_ids and len(account_ids) == 1:
            return list(self._rows_by_account.get(account_ids[0], []))
        rows = []
        for items in self._rows_by_account.values():
            rows.extend(items)
        return rows


def _row(
    tx_id: int,
    occurred_at: datetime,
    tx_type: TransactionType,
    amount: str,
    *,
    description: str,
    category_id: int = 999,
) -> TransactionAmountRow:
    dec = Decimal(amount)
    return TransactionAmountRow(
        id=UUID(int=tx_id),
        occurred_at=occurred_at,
        transaction_type=tx_type,
        description=description,
        notes=None,
        category_id=UUID(int=category_id),
        category_name="Category",
        category_icon=None,
        category_color_hex=None,
        amount=dec,
        inflow=dec if dec > 0 else Decimal("0"),
        outflow=-dec if dec < 0 else Decimal("0"),
    )


def test_build_yearly_overview_enhancements_scoped(session) -> None:
    normal = Account(name="Main", account_type=AccountType.NORMAL)
    debt = Account(name="Debt", account_type=AccountType.DEBT)
    session.add_all([normal, debt])
    session.commit()

    income = _row(
        1,
        datetime(2024, 1, 10, tzinfo=timezone.utc),
        TransactionType.INCOME,
        "500",
        description="Salary",
    )
    expense = _row(
        2,
        datetime(2024, 1, 11, tzinfo=timezone.utc),
        TransactionType.EXPENSE,
        "-200",
        description="Food Store",
    )

    repo = _RepoYearly(
        user_id="integration-user",
        rows_by_account={normal.id: [income, expense], debt.id: []},
        balances={
            tuple(sorted([str(normal.id)])): Decimal("300"),
            tuple(sorted([str(debt.id)])): Decimal("-1000"),
        },
    )

    investments_summary, debt_overview, account_flows, income_sources, expense_sources = (
        build_yearly_overview_enhancements(
            session=session,
            repository=repo,
            year=2024,
            start=datetime(2024, 1, 1, tzinfo=timezone.utc),
            end=datetime(2025, 1, 1, tzinfo=timezone.utc),
            as_of_date=date(2024, 12, 31),
            account_id_list=[normal.id, debt.id],
            rows=[income, expense],
            classify_income_expense=lambda row: (row.inflow, row.outflow),
            merchant_key=lambda raw: raw or "Unknown",
            month_end_balance_series=lambda _year, _ids: [
                (date(2024, month, 28), Decimal("-1000")) for month in range(1, 13)
            ],
            month_end_dates=lambda _year: [date(2024, month, 28) for month in range(1, 13)],
        )
    )

    assert investments_summary["end_value"] == Decimal("0")
    assert debt_overview
    assert account_flows
    assert income_sources and expense_sources


def test_build_yearly_overview_enhancements_unscoped_investments(session) -> None:
    cash = Account(name="Cash", account_type=AccountType.NORMAL)
    investment = Account(name="Broker", account_type=AccountType.INVESTMENT)
    session.add_all([cash, investment])
    session.commit()

    snapshot = InvestmentSnapshot(
        provider="manual",
        report_type="portfolio_report",
        account_name="Broker",
        snapshot_date=date(2024, 2, 1),
        portfolio_value=Decimal("1400"),
        raw_text="raw",
        parsed_payload={"accounts": {"Broker": 1400}},
    )
    session.add(snapshot)

    tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=datetime(2024, 2, 2, tzinfo=timezone.utc),
        posted_at=datetime(2024, 2, 2, tzinfo=timezone.utc),
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

    income = _row(
        10,
        datetime(2024, 2, 10, tzinfo=timezone.utc),
        TransactionType.INCOME,
        "300",
        description="Salary",
    )

    repo = _RepoYearly(
        user_id="integration-user",
        rows_by_account={cash.id: [income], investment.id: []},
        balances={
            tuple(sorted([str(cash.id)])): Decimal("300"),
            tuple(sorted([str(investment.id)])): Decimal("100"),
        },
    )

    investments_summary, _debt_overview, account_flows, _income_sources, _expense_sources = (
        build_yearly_overview_enhancements(
            session=session,
            repository=repo,
            year=2024,
            start=datetime(2024, 1, 1, tzinfo=timezone.utc),
            end=datetime(2025, 1, 1, tzinfo=timezone.utc),
            as_of_date=date(2024, 2, 28),
            account_id_list=None,
            rows=[income],
            classify_income_expense=lambda row: (row.inflow, row.outflow),
            merchant_key=lambda raw: raw or "Unknown",
            month_end_balance_series=lambda _year, _ids: [
                (date(2024, month, 28), Decimal("0")) for month in range(1, 13)
            ],
            month_end_dates=lambda _year: [date(2024, month, 28) for month in range(1, 13)],
        )
    )

    assert investments_summary["end_value"] == Decimal("1400")
    assert investments_summary["accounts"]
    assert account_flows


def test_build_yearly_overview_enhancements_snapshot_fallback_and_transfer_branches(
    session,
) -> None:
    cash = Account(name="Cash", account_type=AccountType.NORMAL)
    session.add(cash)
    session.commit()

    session.add_all(
        [
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name=None,
                snapshot_date=date(2024, 1, 10),
                portfolio_value=None,
                raw_text="raw",
                parsed_payload=None,
                cleaned_payload={"accounts": {"Broker": "1200", "Bad": "50"}},
            ),
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name="Broker2",
                snapshot_date=date(2024, 1, 20),
                portfolio_value=Decimal("300"),
                raw_text="raw",
                parsed_payload=None,
                cleaned_payload=None,
            ),
        ]
    )
    session.commit()

    transfer_in = _row(
        110,
        datetime(2024, 2, 10, tzinfo=timezone.utc),
        TransactionType.TRANSFER,
        "75",
        description="Transfer in",
    )
    transfer_out = _row(
        111,
        datetime(2024, 2, 11, tzinfo=timezone.utc),
        TransactionType.TRANSFER,
        "-25",
        description="Transfer out",
    )
    income = _row(
        112,
        datetime(2024, 2, 12, tzinfo=timezone.utc),
        TransactionType.INCOME,
        "100",
        description="Salary",
    )

    repo = _RepoYearly(
        user_id="integration-user",
        rows_by_account={cash.id: [transfer_in, transfer_out, income]},
        balances={tuple(sorted([str(cash.id)])): Decimal("150")},
    )

    investments_summary, _debt_overview, account_flows, _income_sources, _expense_sources = (
        build_yearly_overview_enhancements(
            session=session,
            repository=repo,
            year=2024,
            start=datetime(2024, 1, 1, tzinfo=timezone.utc),
            end=datetime(2025, 1, 1, tzinfo=timezone.utc),
            as_of_date=date(2024, 2, 28),
            account_id_list=None,
            rows=[income],
            classify_income_expense=lambda row: (row.inflow, row.outflow),
            merchant_key=lambda raw: raw or "Unknown",
            month_end_balance_series=lambda _year, _ids: [
                (date(2024, month, 28), Decimal("0")) for month in range(1, 13)
            ],
            month_end_dates=lambda _year: [date(2024, month, 28) for month in range(1, 13)],
        )
    )

    assert investments_summary["end_value"] == Decimal("1550")
    assert investments_summary["contributions"] == Decimal("0")
    assert investments_summary["withdrawals"] == Decimal("0")
    flow = account_flows[0]
    assert flow["transfers_in"] == Decimal("75")
    assert flow["transfers_out"] == Decimal("25")


def test_build_yearly_overview_enhancements_source_and_snapshot_empty_branches(session) -> None:
    cash = Account(name="Cash 2", account_type=AccountType.NORMAL)
    session.add(cash)
    session.commit()

    session.add(
        InvestmentSnapshot(
            provider="manual",
            report_type="portfolio_report",
            account_name=None,
            snapshot_date=date(2024, 1, 5),
            portfolio_value=None,
            raw_text="raw",
            parsed_payload=None,
            cleaned_payload=None,
        )
    )
    session.commit()

    inc_a = _row(
        210,
        datetime(2024, 3, 10, tzinfo=timezone.utc),
        TransactionType.INCOME,
        "50",
        description="Employer",
    )
    inc_b = _row(
        211,
        datetime(2024, 3, 11, tzinfo=timezone.utc),
        TransactionType.INCOME,
        "60",
        description="Employer",
    )
    exp_a = _row(
        212,
        datetime(2024, 3, 12, tzinfo=timezone.utc),
        TransactionType.EXPENSE,
        "-20",
        description="Store",
    )
    exp_b = _row(
        213,
        datetime(2024, 3, 13, tzinfo=timezone.utc),
        TransactionType.EXPENSE,
        "-25",
        description="Store",
    )

    repo = _RepoYearly(
        user_id="integration-user",
        rows_by_account={cash.id: [inc_a, inc_b, exp_a, exp_b]},
        balances={tuple(sorted([str(cash.id)])): Decimal("65")},
    )

    _investments_summary, _debt_overview, _account_flows, income_sources, expense_sources = (
        build_yearly_overview_enhancements(
            session=session,
            repository=repo,
            year=2024,
            start=datetime(2024, 1, 1, tzinfo=timezone.utc),
            end=datetime(2025, 1, 1, tzinfo=timezone.utc),
            as_of_date=date(2024, 12, 31),
            account_id_list=None,
            rows=[inc_a, inc_b, exp_a, exp_b],
            classify_income_expense=lambda row: (row.inflow, row.outflow),
            merchant_key=lambda raw: raw or "Unknown",
            month_end_balance_series=lambda _year, _ids: [
                (date(2024, month, 28), Decimal("0")) for month in range(1, 13)
            ],
            month_end_dates=lambda _year: [date(2024, month, 28) for month in range(1, 13)],
        )
    )

    assert income_sources[0]["source"] == "Employer"
    assert expense_sources[0]["source"] == "Store"


def test_build_yearly_overview_investment_value_missing_key_branch(session) -> None:
    cash = Account(name="Cash 3", account_type=AccountType.NORMAL)
    broker_a = Account(name="Broker A", account_type=AccountType.INVESTMENT)
    broker_b = Account(name="Broker B", account_type=AccountType.INVESTMENT)
    session.add_all([cash, broker_a, broker_b])
    session.commit()

    session.add(
        InvestmentSnapshot(
            provider="manual",
            report_type="portfolio_report",
            account_name=None,
            snapshot_date=date(2024, 1, 15),
            portfolio_value=None,
            raw_text="raw",
            parsed_payload={"accounts": {"Broker A": "250"}},
            cleaned_payload=None,
        )
    )
    session.commit()

    repo = _RepoYearly(
        user_id="integration-user",
        rows_by_account={cash.id: []},
        balances={tuple(sorted([str(cash.id)])): Decimal("0")},
    )

    investments_summary, _debt_overview, account_flows, _income_sources, _expense_sources = (
        build_yearly_overview_enhancements(
            session=session,
            repository=repo,
            year=2024,
            start=datetime(2024, 1, 1, tzinfo=timezone.utc),
            end=datetime(2025, 1, 1, tzinfo=timezone.utc),
            as_of_date=date(2024, 12, 31),
            account_id_list=None,
            rows=[],
            classify_income_expense=lambda row: (row.inflow, row.outflow),
            merchant_key=lambda raw: raw or "Unknown",
            month_end_balance_series=lambda _year, _ids: [
                (date(2024, month, 28), Decimal("0")) for month in range(1, 13)
            ],
            month_end_dates=lambda _year: [date(2024, month, 28) for month in range(1, 13)],
        )
    )

    assert investments_summary["accounts"]
    assert any(flow["name"] == "Broker B" for flow in account_flows)
