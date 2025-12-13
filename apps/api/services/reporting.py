"""Service layer for reporting aggregation helpers."""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Iterable, List, Optional
from uuid import UUID

from sqlmodel import Session

from ..repositories.reporting import (
    LifetimeTotals,
    MonthlyTotals,
    NetWorthPoint,
    QuarterlyTotals,
    ReportingRepository,
    YearlyTotals,
)


class ReportingService:
    """Coordinates access to reporting aggregations and utilities."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = ReportingRepository(session)

    def monthly_report(
        self,
        *,
        year: Optional[int] = None,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[MonthlyTotals]:
        return self.repository.get_monthly_totals(
            year=year,
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
        )

    def yearly_report(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[YearlyTotals]:
        return self.repository.get_yearly_totals(
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
        )

    def total_report(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> LifetimeTotals:
        return self.repository.get_total_summary(
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
            start_date=start_date,
            end_date=end_date,
        )

    def net_worth_history(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> List[NetWorthPoint]:
        return self.repository.get_net_worth_history(account_ids=account_ids)

    def cashflow_forecast(
        self,
        *,
        days: int = 60,
        threshold: Decimal = Decimal("0"),
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        current_balance = self.repository.current_balance_total(account_ids=account_ids)
        avg_daily = self.repository.average_daily_net(account_ids=account_ids)
        points: list[tuple[str, Decimal]] = []
        alert_at: Optional[str] = None
        running = current_balance
        for day in range(1, days + 1):
            running += avg_daily
            iso = (datetime.now(timezone.utc).date() + timedelta(days=day)).isoformat()
            points.append((iso, running))
            if alert_at is None and running < threshold:
                alert_at = iso
        return {
            "starting_balance": current_balance,
            "average_daily": avg_daily,
            "points": [{"date": d, "balance": v} for d, v in points],
            "alert_below_threshold_at": alert_at,
            "threshold": threshold,
        }

    @staticmethod
    def _add_months(start: date, months: int) -> date:
        month_index = (start.month - 1) + months
        year = start.year + (month_index // 12)
        month = (month_index % 12) + 1
        day = min(start.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    def net_worth_projection(
        self,
        *,
        months: int = 36,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        history = self.repository.get_net_worth_history(account_ids=account_ids)

        investment_value = (
            self.repository.latest_investment_value() if account_ids is None else Decimal("0")
        )
        current = self.repository.current_balance_total(account_ids=account_ids) + investment_value

        if not history:
            return {"current": current, "cagr": None, "points": []}

        monthly: dict[tuple[int, int], tuple[date, Decimal]] = {}
        for point in history:
            key = (point.period.year, point.period.month)
            monthly[key] = (point.period, point.net_worth)
        monthly_points = [monthly[key] for key in sorted(monthly.keys())]

        end_period, end_value = monthly_points[-1]
        if investment_value:
            end_value += investment_value

        # Prefer a 12-month CAGR window when available; fallback to earliest positive value.
        cagr: Decimal | None = None
        start_idx = max(0, len(monthly_points) - 13)
        start_period, start_value = monthly_points[start_idx]
        if start_value <= 0:
            for i in range(start_idx, -1, -1):
                candidate_period, candidate_value = monthly_points[i]
                if candidate_value > 0:
                    start_period, start_value = candidate_period, candidate_value
                    break

        months_span = (end_period.year - start_period.year) * 12 + (
            end_period.month - start_period.month
        )
        years = Decimal(str(months_span / 12)) if months_span else Decimal("0")
        if years > 0 and start_value > 0 and end_value > 0:
            try:
                cagr = (end_value / start_value) ** (Decimal("1") / years) - Decimal("1")
            except (InvalidOperation, ZeroDivisionError, OverflowError):  # pragma: no cover
                cagr = None

        # If CAGR isn't computable, fall back to linear projection from recent monthly deltas.
        monthly_delta = Decimal("0")
        recent = monthly_points[-7:] if len(monthly_points) > 1 else []
        if len(recent) >= 2:
            deltas: list[Decimal] = []
            for (_prev_period, prev_value), (_next_period, next_value) in zip(recent, recent[1:]):
                deltas.append(next_value - prev_value)
            if deltas:
                monthly_delta = sum(deltas, Decimal("0")) / Decimal(len(deltas))

        points: list[dict[str, object]] = []
        monthly_rate = (cagr / Decimal(12)) if cagr is not None else None
        for idx in range(1, months + 1):
            target_date = self._add_months(end_period, idx)
            if monthly_rate is not None:
                projected = current * (Decimal("1") + monthly_rate) ** Decimal(idx)
            else:
                projected = current + (monthly_delta * Decimal(idx))
            points.append({"date": target_date.isoformat(), "net_worth": projected})

        return {"current": current, "cagr": cagr, "points": points}

    def refresh_materialized_views(
        self,
        view_names: Iterable[str],
        *,
        concurrently: bool = False,
    ) -> None:
        self.repository.refresh_materialized_views(
            view_names,
            concurrently=concurrently,
        )

    def quarterly_report(
        self,
        *,
        year: Optional[int] = None,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[QuarterlyTotals]:
        return self.repository.get_quarterly_totals(
            year=year,
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
        )

    def date_range_report(
        self,
        *,
        start_date: date,
        end_date: date,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[MonthlyTotals]:
        return self.repository.get_range_monthly_totals(
            start_date=start_date,
            end_date=end_date,
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
        )


__all__ = [
    "ReportingService",
    "MonthlyTotals",
    "YearlyTotals",
    "QuarterlyTotals",
    "LifetimeTotals",
    "NetWorthPoint",
]
