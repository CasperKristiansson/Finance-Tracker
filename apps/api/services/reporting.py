"""Service layer for reporting aggregation helpers."""

from __future__ import annotations

from sqlmodel import Session

from ..repositories.reporting import (
    LifetimeTotals,
    MonthlyTotals,
    NetWorthPoint,
    QuarterlyTotals,
    ReportingRepository,
    YearlyTotals,
)
from .reporting_projection_mixin import ReportingProjectionMixin
from .reporting_service_overview_mixin import ReportingServiceOverviewMixin
from .reporting_service_summary_mixin import ReportingServiceSummaryMixin
from .reporting_yearly import build_yearly_overview_enhancements


class ReportingService(
    ReportingServiceOverviewMixin,
    ReportingServiceSummaryMixin,
    ReportingProjectionMixin,
):
    """Coordinates access to reporting aggregations and utilities."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = ReportingRepository(session)


__all__ = [
    "ReportingService",
    "MonthlyTotals",
    "YearlyTotals",
    "QuarterlyTotals",
    "LifetimeTotals",
    "NetWorthPoint",
    "build_yearly_overview_enhancements",
]
