"""Service layer for reporting aggregation helpers."""

from __future__ import annotations

from datetime import date
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
