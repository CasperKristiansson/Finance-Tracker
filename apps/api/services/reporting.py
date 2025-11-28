"""Service layer for reporting aggregation helpers."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
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
        avg_daily = self.repository.average_daily_net()
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

    def net_worth_projection(
        self,
        *,
        months: int = 36,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        history = self.repository.get_net_worth_history(account_ids=account_ids)
        if not history:
            return {"points": [], "cagr": None}
        start = history[0].net_worth
        end = history[-1].net_worth
        start_date = history[0].period
        end_date = history[-1].period
        years = max(1, (end_date.year - start_date.year) + (end_date.month - start_date.month) / 12)
        cagr = None
        if start > 0 and end > 0:
            cagr = (end / start) ** Decimal(1 / years) - Decimal("1")
        current = end + self.repository.latest_investment_value()

        points: list[dict[str, object]] = []
        monthly_rate = cagr / Decimal(12) if cagr is not None else Decimal("0")
        for idx in range(1, months + 1):
            projected = current * (Decimal("1") + monthly_rate) ** Decimal(idx)
            target_date = (
                datetime.combine(end_date, datetime.min.time()) + timedelta(days=30 * idx)
            ).date()
            points.append({"date": target_date.isoformat(), "net_worth": projected})

        return {
            "current": current,
            "cagr": cagr,
            "points": points,
        }

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
