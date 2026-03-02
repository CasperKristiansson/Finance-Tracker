from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID

from apps.api.repositories.reporting import NetWorthPoint, TransactionAmountRow
from apps.api.services.reporting import ReportingService
from apps.api.shared import AccountType, TransactionType

# mypy: ignore-errors


def _row(
    tx_int: int,
    *,
    occurred_at: datetime,
    tx_type: TransactionType,
    amount: str,
    inflow: str = "0",
    outflow: str = "0",
    description: str | None = None,
    category_id: UUID | None = None,
    category_name: str | None = None,
) -> TransactionAmountRow:
    return TransactionAmountRow(
        id=UUID(int=tx_int),
        occurred_at=occurred_at,
        transaction_type=tx_type,
        description=description,
        notes=None,
        category_id=category_id,
        category_name=category_name,
        category_icon=None,
        category_color_hex=None,
        amount=Decimal(amount),
        inflow=Decimal(inflow),
        outflow=Decimal(outflow),
    )


class _RepoTransactionsOnly:
    def __init__(self, rows: list[TransactionAmountRow]) -> None:
        self.rows = rows
        self.refresh_calls: list[tuple[list[str], bool]] = []

    def fetch_transaction_amounts(
        self, start, end, account_ids=None
    ):  # pylint: disable=unused-argument
        return list(self.rows)

    def refresh_materialized_views(self, view_names, concurrently=False):
        self.refresh_calls.append((list(view_names), concurrently))


class _RepoNetWorth:
    def __init__(self, *, ledger, snapshots, investment_ledger=None) -> None:
        self._ledger = list(ledger)
        self._snapshots = list(snapshots)
        self._investment_ledger = list(investment_ledger or [])

    def get_net_worth_history(self, account_ids=None):
        if account_ids:
            return list(self._investment_ledger or self._ledger)
        return list(self._ledger)

    def list_investment_snapshots_until(self, end):  # pylint: disable=unused-argument
        return list(self._snapshots)

    def list_account_ids_by_type(
        self, account_type, account_ids=None
    ):  # pylint: disable=unused-argument
        if account_type == AccountType.INVESTMENT:
            return [UUID(int=9)] if self._investment_ledger else []
        return []


class _RepoForecastProjection:
    def __init__(self, *, history):
        self._history = list(history)

    def current_balance_total(self, account_ids=None):  # pylint: disable=unused-argument
        return Decimal("100")

    def average_daily_net(self, days, account_ids=None):  # pylint: disable=unused-argument
        return Decimal("-20") if days else Decimal("0")

    def daily_deltas_between(self, start, end, account_ids=None):  # pylint: disable=unused-argument
        return list(self._history)


def test_reporting_service_monthly_quarterly_range_and_filters(session) -> None:
    category = UUID(int=10)
    rows = [
        _row(
            1,
            occurred_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
            tx_type=TransactionType.INCOME,
            amount="100",
            inflow="100",
            description="Salary",
            category_id=category,
            category_name="Income",
        ),
        _row(
            2,
            occurred_at=datetime(2024, 1, 9, tzinfo=timezone.utc),
            tx_type=TransactionType.EXPENSE,
            amount="-40",
            outflow="40",
            description="Shop A",
            category_id=category,
            category_name="Expense",
        ),
        _row(
            3,
            occurred_at=datetime(2024, 2, 4, tzinfo=timezone.utc),
            tx_type=TransactionType.ADJUSTMENT,
            amount="-10",
            description="Recon",
            category_id=category,
            category_name="Expense",
        ),
        _row(
            4,
            occurred_at=datetime(2024, 2, 10, tzinfo=timezone.utc),
            tx_type=TransactionType.TRANSFER,
            amount="20",
            inflow="20",
            description="Internal move",
            category_id=category,
            category_name="Expense",
        ),
    ]
    service = ReportingService(session)
    repo = _RepoTransactionsOnly(rows)
    service.repository = repo

    monthly = service.monthly_report(category_ids=[category])
    assert [item.period for item in monthly] == [date(2024, 1, 1), date(2024, 2, 1)]

    quarterly = service.quarterly_report()
    assert len(quarterly) == 1
    assert quarterly[0].quarter == 1

    ranged = service.date_range_report(
        start_date=date(2024, 1, 1),
        end_date=date(2024, 2, 28),
        source="Shop A",
    )
    assert len(ranged) == 1
    assert ranged[0].expense == Decimal("40")

    service.refresh_materialized_views(["vw_monthly"], concurrently=True)
    assert repo.refresh_calls == [(["vw_monthly"], True)]


def test_reporting_service_net_worth_history_branches(session) -> None:
    service = ReportingService(session)

    scoped_repo = _RepoNetWorth(
        ledger=[NetWorthPoint(period=date(2024, 1, 1), net_worth=Decimal("10"))],
        snapshots=[],
    )
    service.repository = scoped_repo
    scoped = service.net_worth_history(account_ids=[UUID(int=1)])
    assert scoped == [NetWorthPoint(period=date(2024, 1, 1), net_worth=Decimal("10"))]

    full_repo = _RepoNetWorth(
        ledger=[NetWorthPoint(period=date(2024, 1, 1), net_worth=Decimal("100"))],
        snapshots=[(date(2024, 1, 5), Decimal("250"))],
        investment_ledger=[NetWorthPoint(period=date(2024, 1, 1), net_worth=Decimal("20"))],
    )
    service.repository = full_repo
    history = service.net_worth_history()
    assert history[0].period == date(2024, 1, 1)
    assert history[-1].period == date.today()


def test_reporting_service_net_worth_history_no_snapshots_returns_ledger(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoNetWorth(
        ledger=[NetWorthPoint(period=date(2024, 4, 1), net_worth=Decimal("12"))],
        snapshots=[],
        investment_ledger=[],
    )
    result = service.net_worth_history()
    assert result == [NetWorthPoint(period=date(2024, 4, 1), net_worth=Decimal("12"))]


def test_reporting_service_net_worth_history_does_not_append_when_latest_is_today(session) -> None:
    today = date.today()
    service = ReportingService(session)
    service.repository = _RepoNetWorth(
        ledger=[NetWorthPoint(period=today, net_worth=Decimal("100"))],
        snapshots=[(today, Decimal("250"))],
        investment_ledger=[NetWorthPoint(period=today, net_worth=Decimal("75"))],
    )
    result = service.net_worth_history()
    assert len(result) == 1
    assert result[0].period == today


def test_reporting_service_cashflow_alert_and_projection_default_method(session) -> None:
    start = date.today() - timedelta(days=90)
    history = []
    for idx in range(90):
        history.append((start + timedelta(days=idx), Decimal("-2")))

    service = ReportingService(session)
    service.repository = _RepoForecastProjection(history=history)

    simple = service.cashflow_forecast(days=3, model="simple", threshold=Decimal("100"))
    assert simple["alert_below_threshold_at"] is not None

    ensemble = service.cashflow_forecast(
        days=5, model="ensemble", threshold=Decimal("500"), lookback_days=90
    )
    assert ensemble["alert_below_threshold_at"] is not None


def test_yearly_overview_range_calls_yearly_overview_per_year(session) -> None:
    service = ReportingService(session)
    called_years: list[int] = []

    def _yearly_overview(*, year, account_ids=None):  # pylint: disable=unused-argument
        called_years.append(year)
        return {"year": year}

    service.yearly_overview = _yearly_overview  # type: ignore[assignment]
    result = service.yearly_overview_range(start_year=2022, end_year=2024)

    assert called_years == [2022, 2023, 2024]
    assert result == [{"year": 2022}, {"year": 2023}, {"year": 2024}]


def test_dashboard_overview_aggregates_monthly_total_and_net_worth(session) -> None:
    service = ReportingService(session)
    service.monthly_report = lambda **_kwargs: ["monthly"]  # type: ignore[assignment]
    service.total_report = lambda **_kwargs: {"net": Decimal("12")}  # type: ignore[assignment]
    service.net_worth_history = lambda **_kwargs: ["net-worth"]  # type: ignore[assignment]

    result = service.dashboard_overview(year=2025, account_ids=[UUID(int=1)])

    assert result["year"] == 2025
    assert result["monthly"] == ["monthly"]
    assert result["total"] == {"net": Decimal("12")}
    assert result["net_worth"] == ["net-worth"]

    # Fewer than six monthly points => no holdout, defaults to sma_delta recommendation.
    service.net_worth_history = lambda account_ids=None: [  # type: ignore[assignment]
        NetWorthPoint(period=date(2025, month, 28), net_worth=Decimal(str(1000 + month * 10)))
        for month in range(1, 6)
    ]
    projection = service.net_worth_projection(months=4)
    assert projection["recommended_method"] == "sma_delta"
    assert projection["methods"] is not None
    assert len(projection["points"]) == 4


def test_reporting_service_yearly_overview_and_category_detail(monkeypatch, session) -> None:
    category_ids = [UUID(int=100 + idx) for idx in range(10)]
    rows_current: list[TransactionAmountRow] = []
    for idx, category_id in enumerate(category_ids):
        rows_current.append(
            _row(
                1000 + idx,
                occurred_at=datetime(2024, min(idx + 1, 12), 2, tzinfo=timezone.utc),
                tx_type=TransactionType.EXPENSE,
                amount=str(-(20 + idx * 5)),
                outflow=str(20 + idx * 5),
                description=f"Merchant {idx}",
                category_id=category_id,
                category_name=f"Cat {idx}",
            )
        )
    rows_current.append(
        _row(
            2001,
            occurred_at=datetime(2024, 12, 15, tzinfo=timezone.utc),
            tx_type=TransactionType.INCOME,
            amount="800",
            inflow="800",
            description="Employer",
            category_id=UUID(int=999),
            category_name="Salary",
        )
    )

    rows_prev = [
        _row(
            3001,
            occurred_at=datetime(2023, 2, 3, tzinfo=timezone.utc),
            tx_type=TransactionType.EXPENSE,
            amount="-15",
            outflow="15",
            description="Merchant 1",
            category_id=category_ids[1],
            category_name="Cat 1",
        )
    ]

    class _RepoOverview:
        def fetch_transaction_amounts(
            self, start, end, account_ids=None
        ):  # pylint: disable=unused-argument
            if start.year == 2023:
                return list(rows_prev)
            return list(rows_current)

        def list_account_ids_by_type(
            self, account_type, account_ids=None
        ):  # pylint: disable=unused-argument
            return [UUID(int=700)] if account_type == AccountType.DEBT else []

    service = ReportingService(session)
    service.repository = _RepoOverview()
    service._month_end_balance_series = (  # type: ignore[assignment]
        lambda year, account_ids=None: [  # pylint: disable=unused-argument
            (date(year, month, 28), Decimal(str(month * 10))) for month in range(1, 13)
        ]
    )
    service.net_worth_history = lambda account_ids=None: [  # type: ignore[assignment]
        NetWorthPoint(period=date(2024, month, 28), net_worth=Decimal(str(month * 100)))
        for month in range(1, 13)
    ]
    monkeypatch.setattr(
        "apps.api.services.reporting.build_yearly_overview_enhancements",
        lambda **_kwargs: ({}, {}, [], [], []),
    )

    overview_full = service.yearly_overview(year=2024)
    assert overview_full["category_breakdown"]
    assert any(item["name"] == "Other" for item in overview_full["category_breakdown"])
    assert overview_full["insights"]

    overview_scoped = service.yearly_overview(year=2024, account_ids=[UUID(int=1)])
    assert overview_scoped["net_worth"]

    detail_income = service.yearly_category_detail(
        year=2024,
        category_id=category_ids[0],
        flow="income",
    )
    assert detail_income["top_merchants"] == []

    detail_expense = service.yearly_category_detail(
        year=2024,
        category_id=category_ids[0],
        flow="expense",
    )
    assert detail_expense["top_merchants"]


def test_reporting_service_yearly_overview_reuses_buckets_and_skips_optional_insights(
    monkeypatch, session
) -> None:
    expense_category = UUID(int=8001)
    income_category = UUID(int=8002)
    rows_current: list[TransactionAmountRow] = []
    for month in range(1, 13):
        rows_current.append(
            _row(
                5000 + month,
                occurred_at=datetime(2024, month, 5, tzinfo=timezone.utc),
                tx_type=TransactionType.EXPENSE,
                amount="-100",
                outflow="100",
                description="Same Merchant",
                category_id=expense_category,
                category_name="Living",
            )
        )
    rows_current.extend(
        [
            _row(
                7001,
                occurred_at=datetime(2024, 1, 12, tzinfo=timezone.utc),
                tx_type=TransactionType.INCOME,
                amount="2000",
                inflow="2000",
                description="Employer",
                category_id=income_category,
                category_name="Salary",
            ),
            _row(
                7002,
                occurred_at=datetime(2024, 2, 12, tzinfo=timezone.utc),
                tx_type=TransactionType.INCOME,
                amount="2100",
                inflow="2100",
                description="Employer",
                category_id=income_category,
                category_name="Salary",
            ),
        ]
    )

    rows_prev: list[TransactionAmountRow] = []
    for month in range(1, 13):
        rows_prev.append(
            _row(
                9000 + month,
                occurred_at=datetime(2023, month, 6, tzinfo=timezone.utc),
                tx_type=TransactionType.EXPENSE,
                amount="-100",
                outflow="100",
                description="Same Merchant",
                category_id=expense_category,
                category_name="Living",
            )
        )
    rows_prev.append(
        _row(
            9900,
            occurred_at=datetime(2023, 3, 10, tzinfo=timezone.utc),
            tx_type=TransactionType.INCOME,
            amount="300",
            inflow="300",
            description="Bonus",
            category_id=income_category,
            category_name="Salary",
        )
    )

    class _RepoOverviewEdges:
        def fetch_transaction_amounts(
            self, start, end, account_ids=None
        ):  # pylint: disable=unused-argument
            if start.year == 2023:
                return list(rows_prev)
            return list(rows_current)

        def list_account_ids_by_type(
            self, account_type, account_ids=None
        ):  # pylint: disable=unused-argument
            if account_type == AccountType.DEBT:
                return [UUID(int=123)]
            return []

    service = ReportingService(session)
    service.repository = _RepoOverviewEdges()
    service._month_end_balance_series = (  # type: ignore[assignment]
        lambda year, account_ids=None: [  # pylint: disable=unused-argument
            (date(year, month, 28), Decimal("0")) for month in range(1, 13)
        ]
    )
    service.net_worth_history = lambda account_ids=None: [  # type: ignore[assignment]
        NetWorthPoint(period=date(2024, month, 28), net_worth=Decimal("1000"))
        for month in range(1, 13)
    ]
    monkeypatch.setattr(
        "apps.api.services.reporting.build_yearly_overview_enhancements",
        lambda **_kwargs: ({}, {}, [], [], []),
    )

    overview = service.yearly_overview(year=2024)
    assert overview["insights"]
    assert "Biggest drivers:" not in " ".join(overview["insights"])
    assert not any("Unusually high months:" in line for line in overview["insights"])

    detail = service.yearly_category_detail(
        year=2024,
        category_id=expense_category,
        flow="expense",
    )
    assert detail["top_merchants"][0]["merchant"] == "Same Merchant"


def test_reporting_service_yearly_overview_income_only_skips_unusual_months(
    monkeypatch, session
) -> None:
    income_category = UUID(int=9100)
    rows_current = [
        _row(
            8100 + month,
            occurred_at=datetime(2024, month, 10, tzinfo=timezone.utc),
            tx_type=TransactionType.INCOME,
            amount="1000",
            inflow="1000",
            description="Employer",
            category_id=income_category,
            category_name="Salary",
        )
        for month in range(1, 13)
    ]

    class _IncomeOnlyRepo:
        def fetch_transaction_amounts(
            self, start, end, account_ids=None
        ):  # pylint: disable=unused-argument
            if start.year == 2023:
                return []
            return list(rows_current)

        def list_account_ids_by_type(
            self, account_type, account_ids=None
        ):  # pylint: disable=unused-argument
            return []

    service = ReportingService(session)
    service.repository = _IncomeOnlyRepo()
    service._month_end_balance_series = (  # type: ignore[assignment]
        lambda year, account_ids=None: [  # pylint: disable=unused-argument
            (date(year, month, 28), Decimal("0")) for month in range(1, 13)
        ]
    )
    service.net_worth_history = lambda account_ids=None: [  # type: ignore[assignment]
        NetWorthPoint(period=date(2024, month, 28), net_worth=Decimal("1000"))
        for month in range(1, 13)
    ]
    monkeypatch.setattr(
        "apps.api.services.reporting.build_yearly_overview_enhancements",
        lambda **_kwargs: ({}, {}, [], [], []),
    )

    overview = service.yearly_overview(year=2024)
    assert not any("Unusually high months:" in line for line in (overview["insights"] or []))


def test_reporting_service_classify_helpers_and_date_range_zero_flow_skip(session) -> None:
    transfer = _row(
        811,
        occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        tx_type=TransactionType.TRANSFER,
        amount="50",
        inflow="50",
        description="Transfer only",
    )
    adjust_pos = _row(
        812,
        occurred_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
        tx_type=TransactionType.ADJUSTMENT,
        amount="10",
        description="Adj+",
    )
    adjust_neg = _row(
        813,
        occurred_at=datetime(2024, 1, 3, tzinfo=timezone.utc),
        tx_type=TransactionType.ADJUSTMENT,
        amount="-8",
        description="Adj-",
    )
    expense = _row(
        814,
        occurred_at=datetime(2024, 1, 4, tzinfo=timezone.utc),
        tx_type=TransactionType.EXPENSE,
        amount="-20",
        outflow="20",
        description="Coffee",
    )
    service = ReportingService(session)
    service.repository = _RepoTransactionsOnly([transfer, adjust_pos, adjust_neg, expense])

    assert service._classify_income_expense(transfer, account_scoped=False) == (
        Decimal("0"),
        Decimal("0"),
    )
    assert service._classify_income_expense(adjust_pos, account_scoped=False) == (
        Decimal("10"),
        Decimal("0"),
    )
    assert service._classify_income_expense(adjust_neg, account_scoped=False) == (
        Decimal("0"),
        Decimal("8"),
    )
    assert service._classify_flows(adjust_pos, account_scoped=False) == (
        Decimal("0"),
        Decimal("0"),
        Decimal("10"),
        Decimal("0"),
    )
    adjust_zero = _row(
        815,
        occurred_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
        tx_type=TransactionType.ADJUSTMENT,
        amount="0",
        description="Adj0",
    )
    assert service._classify_flows(adjust_zero, account_scoped=False) == (
        Decimal("0"),
        Decimal("0"),
        Decimal("0"),
        Decimal("0"),
    )
    weird_row = SimpleNamespace(
        transaction_type="weird",
        amount=Decimal("5"),
        inflow=Decimal("0"),
        outflow=Decimal("0"),
    )
    assert service._classify_income_expense(weird_row, account_scoped=False) == (
        Decimal("0"),
        Decimal("0"),
    )

    rows = service.date_range_report(
        start_date=date(2024, 1, 1),
        end_date=date(2024, 1, 31),
        source="Coffee",
    )
    assert len(rows) == 1
    assert rows[0].expense == Decimal("20")

    transfer_only = ReportingService(session)
    transfer_only.repository = _RepoTransactionsOnly([transfer])
    assert (
        transfer_only.date_range_report(
            start_date=date(2024, 1, 1),
            end_date=date(2024, 1, 31),
        )
        == []
    )
