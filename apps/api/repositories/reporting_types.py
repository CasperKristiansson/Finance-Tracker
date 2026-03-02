"""Shared reporting repository type models."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Optional, Tuple
from uuid import UUID

from ..shared import TransactionType

DecimalTotals = Tuple[Decimal, Decimal, Decimal, Decimal]


@dataclass(frozen=True)
class MonthlyTotals:
    """Aggregate totals for a specific month."""

    period: date
    income: Decimal
    expense: Decimal
    adjustment_inflow: Decimal
    adjustment_outflow: Decimal
    adjustment_net: Decimal
    net: Decimal


@dataclass(frozen=True)
class YearlyTotals:
    """Aggregate totals for a specific year."""

    year: int
    income: Decimal
    expense: Decimal
    adjustment_inflow: Decimal
    adjustment_outflow: Decimal
    adjustment_net: Decimal
    net: Decimal


@dataclass(frozen=True)
class LifetimeTotals:
    """Overall totals across the queried dataset."""

    income: Decimal
    expense: Decimal
    adjustment_inflow: Decimal
    adjustment_outflow: Decimal
    adjustment_net: Decimal
    net: Decimal


@dataclass(frozen=True)
class QuarterlyTotals:
    """Aggregate totals for a specific quarter."""

    year: int
    quarter: int
    income: Decimal
    expense: Decimal
    adjustment_inflow: Decimal
    adjustment_outflow: Decimal
    adjustment_net: Decimal
    net: Decimal


@dataclass(frozen=True)
class NetWorthPoint:
    """Net worth value at a point in time."""

    period: date
    net_worth: Decimal


@dataclass(frozen=True)
class TransactionAmountRow:
    """Aggregated view of a transaction's impact on selected accounts."""

    id: UUID
    occurred_at: datetime
    transaction_type: TransactionType
    description: Optional[str]
    notes: Optional[str]
    category_id: Optional[UUID]
    category_name: Optional[str]
    category_icon: Optional[str]
    category_color_hex: Optional[str]
    amount: Decimal
    inflow: Decimal
    outflow: Decimal


__all__ = [
    "DecimalTotals",
    "MonthlyTotals",
    "YearlyTotals",
    "QuarterlyTotals",
    "LifetimeTotals",
    "NetWorthPoint",
    "TransactionAmountRow",
]
