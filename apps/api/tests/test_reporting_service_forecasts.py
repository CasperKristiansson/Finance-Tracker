from __future__ import annotations

from datetime import date
from decimal import Decimal

from apps.api.repositories.reporting import NetWorthPoint
from apps.api.services.reporting import ReportingService

# mypy: ignore-errors


class _RepoForCashflow:
    def __init__(self, history):
        self._history = history

    def current_balance_total(self, account_ids=None):  # pylint: disable=unused-argument
        return Decimal("1000")

    def average_daily_net(self, days, account_ids=None):  # pylint: disable=unused-argument
        return Decimal("5") if days else Decimal("0")

    def daily_deltas_between(self, start, end, account_ids=None):  # pylint: disable=unused-argument
        return self._history


class _RepoForProjection:
    def current_balance_total(self, account_ids=None):  # pylint: disable=unused-argument
        return Decimal("0")


def test_cashflow_forecast_simple_branch(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoForCashflow([])

    result = service.cashflow_forecast(days=5, model="simple")
    assert result["model"] == "simple"
    assert len(result["points"]) == 5
    assert result["residual_std"] is None


def test_cashflow_forecast_ensemble_branch(session) -> None:
    service = ReportingService(session)
    # 90 days of patterned history to trigger ensemble seasonality path.
    start = date(2025, 1, 1)
    history = []
    for idx in range(90):
        day = start.fromordinal(start.toordinal() + idx)
        delta = Decimal(str((idx % 7) - 3))
        history.append((day, delta))

    service.repository = _RepoForCashflow(history)
    result = service.cashflow_forecast(days=10, model="ensemble", lookback_days=90)

    assert result["model"] == "ensemble"
    assert len(result["points"]) == 10
    assert result["weekday_averages"] is not None
    assert result["monthday_averages"] is not None
    assert result["residual_std"] is not None


def test_cashflow_forecast_ensemble_without_history_residual_defaults(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoForCashflow([])
    result = service.cashflow_forecast(days=3, model="ensemble", lookback_days=30)
    assert result["residual_std"] is not None
    assert result["residual_std"] >= Decimal("0")


def test_net_worth_projection_no_history_branch(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoForProjection()
    service.net_worth_history = lambda account_ids=None: []  # type: ignore[assignment]

    result = service.net_worth_projection(months=3)
    assert result["current"] == Decimal("0")
    assert result["points"] == []


def test_net_worth_projection_flat_branch_for_single_point(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoForProjection()
    service.net_worth_history = lambda account_ids=None: [  # type: ignore[assignment]
        NetWorthPoint(period=date(2025, 1, 31), net_worth=Decimal("1000"))
    ]

    result = service.net_worth_projection(months=4)
    assert result["recommended_method"] == "flat"
    assert len(result["points"]) == 4


def test_net_worth_projection_ensemble_path(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoForProjection()

    def _history(account_ids=None):  # pylint: disable=unused-argument
        points = []
        base = Decimal("1000")
        for idx in range(24):
            year = 2023 + (idx // 12)
            month = (idx % 12) + 1
            # Keep values positive and non-linear so several methods produce distinct MAE.
            value = base + Decimal(str(idx * 40 + (idx % 3) * 5))
            points.append(NetWorthPoint(period=date(year, month, 28), net_worth=value))
        return points

    service.net_worth_history = _history  # type: ignore[assignment]

    result = service.net_worth_projection(months=6)
    assert result["recommended_method"] == "ensemble"
    assert len(result["points"]) == 6
    assert result["methods"] is not None
    assert result["insights"] is not None


def test_net_worth_projection_holdout_two_and_non_positive_cagr_path(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoForProjection()

    service.net_worth_history = lambda account_ids=None: [  # type: ignore[assignment]
        NetWorthPoint(
            period=date(2025, month, 28),
            net_worth=Decimal(str((month - 1) * 10)),
        )
        for month in range(1, 8)
    ]

    result = service.net_worth_projection(months=3)
    assert result["cagr"] is None
    methods = result["methods"] or {}
    assert result["recommended_method"] != "cagr"
    assert result["recommended_method"] in ({"ensemble"} | set(methods.keys()) | {"sma_delta"})
    assert "cagr" not in methods


def test_net_worth_projection_holdout_four_branch(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoForProjection()

    service.net_worth_history = lambda account_ids=None: [  # type: ignore[assignment]
        NetWorthPoint(period=date(2024, month, 28), net_worth=Decimal(str(1000 + month * 5)))
        for month in range(1, 13)
    ]

    result = service.net_worth_projection(months=2)
    assert len(result["points"]) == 2


def test_net_worth_projection_zero_months_returns_empty_points(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoForProjection()
    service.net_worth_history = lambda account_ids=None: [  # type: ignore[assignment]
        NetWorthPoint(period=date(2025, month, 28), net_worth=Decimal(str(1000 + month * 10)))
        for month in range(1, 8)
    ]
    result = service.net_worth_projection(months=0)
    assert result["points"] == []


def test_net_worth_projection_zero_months_short_history_rows_empty_branch(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoForProjection()
    service.net_worth_history = lambda account_ids=None: [  # type: ignore[assignment]
        NetWorthPoint(period=date(2025, month, 28), net_worth=Decimal(str(1000 + month * 10)))
        for month in range(1, 6)
    ]
    result = service.net_worth_projection(months=0)
    assert result["recommended_method"] == "sma_delta"
    assert result["points"] == []


def test_net_worth_projection_duplicate_month_and_nonpositive_13m_cagr(session) -> None:
    service = ReportingService(session)
    service.repository = _RepoForProjection()

    points = [NetWorthPoint(period=date(2024, 1, 31), net_worth=Decimal("0"))]
    # Same month but earlier date appears later; it should be ignored by monthly aggregation.
    points.append(NetWorthPoint(period=date(2024, 1, 1), net_worth=Decimal("999")))
    for month in range(2, 13):
        points.append(
            NetWorthPoint(period=date(2024, month, 28), net_worth=Decimal(str(1000 + month)))
        )
    points.append(NetWorthPoint(period=date(2025, 1, 28), net_worth=Decimal("1200")))

    service.net_worth_history = lambda account_ids=None: points  # type: ignore[assignment]
    result = service.net_worth_projection(months=2)

    assert result["cagr"] is None
    assert len(result["points"]) == 2
