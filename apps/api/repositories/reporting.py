"""Reporting aggregation helpers."""

from __future__ import annotations

from typing import Any, cast
from uuid import UUID

from sqlmodel import Session, select

from ..models import Account
from ..shared import get_default_user_id
from .reporting_aggregation_mixin import ReportingAggregationMixin
from .reporting_balance_mixin import ReportingBalanceMixin
from .reporting_snapshot_mixin import ReportingSnapshotMixin
from .reporting_transaction_mixin import ReportingTransactionMixin
from .reporting_types import (
    LifetimeTotals,
    MonthlyTotals,
    NetWorthPoint,
    QuarterlyTotals,
    TransactionAmountRow,
    YearlyTotals,
)


class ReportingRepository(
    ReportingAggregationMixin,
    ReportingBalanceMixin,
    ReportingSnapshotMixin,
    ReportingTransactionMixin,
):
    """Provides reporting-oriented aggregation helpers."""

    def __init__(self, session: Session):
        self.session = session
        self.user_id: str = str(session.info.get("user_id") or get_default_user_id())
        self._excluded_account_ids: set[UUID] = set(
            acc_id
            for acc_id in session.exec(
                select(Account.id).where(
                    Account.user_id == self.user_id,
                    cast(Any, Account.name).in_(["Offset", "Unassigned"]),
                )
            ).all()
        )


__all__ = [
    "ReportingRepository",
    "MonthlyTotals",
    "YearlyTotals",
    "QuarterlyTotals",
    "LifetimeTotals",
    "NetWorthPoint",
    "TransactionAmountRow",
]
