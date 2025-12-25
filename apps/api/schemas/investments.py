"""Pydantic schemas for investment-related endpoints."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class InvestmentTransactionRead(BaseModel):
    """Investment transaction entry."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    snapshot_id: Optional[UUID] = None
    occurred_at: datetime
    transaction_type: str
    description: Optional[str] = None
    holding_name: Optional[str] = None
    isin: Optional[str] = None
    account_name: Optional[str] = None
    quantity: Optional[Decimal] = None
    amount_sek: Decimal
    currency: Optional[str] = None
    fee_sek: Optional[Decimal] = None
    notes: Optional[str] = None


class InvestmentTransactionListResponse(BaseModel):
    """Response for listing investment transactions."""

    transactions: list[InvestmentTransactionRead]


class InvestmentValuePointRead(BaseModel):
    """Value point for an investment account or portfolio."""

    date: date
    value: Decimal


class InvestmentCashflowPointRead(BaseModel):
    """Cashflow bucket (typically monthly) for contributions charting."""

    period: date
    added: Decimal
    withdrawn: Decimal
    net: Decimal


class InvestmentCashflowSummaryRead(BaseModel):
    """Aggregated deposits and withdrawals."""

    added_30d: Decimal
    withdrawn_30d: Decimal
    net_30d: Decimal
    added_ytd: Decimal
    withdrawn_ytd: Decimal
    net_ytd: Decimal
    added_12m: Decimal
    withdrawn_12m: Decimal
    net_12m: Decimal
    added_since_start: Decimal
    withdrawn_since_start: Decimal
    net_since_start: Decimal


class InvestmentGrowthRead(BaseModel):
    """Growth excluding transfers."""

    amount: Decimal
    pct: Optional[float] = None


class InvestmentPortfolioOverviewRead(BaseModel):
    """Portfolio-level investment overview."""

    start_date: Optional[date] = None
    as_of: Optional[date] = None
    current_value: Decimal
    series: list[InvestmentValuePointRead] = Field(default_factory=list)
    cashflow_series: list[InvestmentCashflowPointRead] = Field(default_factory=list)
    cashflow: InvestmentCashflowSummaryRead
    growth_12m_ex_transfers: InvestmentGrowthRead
    growth_since_start_ex_transfers: InvestmentGrowthRead


class InvestmentAccountOverviewRead(BaseModel):
    """Per investment account overview."""

    account_id: UUID
    name: str
    icon: Optional[str] = None
    start_date: Optional[date] = None
    as_of: Optional[date] = None
    current_value: Decimal
    series: list[InvestmentValuePointRead] = Field(default_factory=list)
    cashflow_12m_added: Decimal
    cashflow_12m_withdrawn: Decimal
    cashflow_since_start_added: Decimal
    cashflow_since_start_withdrawn: Decimal
    cashflow_since_start_net: Decimal
    growth_12m_ex_transfers: InvestmentGrowthRead
    growth_since_start_ex_transfers: InvestmentGrowthRead


class InvestmentCashflowEventRead(BaseModel):
    """Recent cashflow affecting an investment account."""

    occurred_at: datetime
    account_id: UUID
    account_name: str
    direction: Literal["deposit", "withdrawal"]
    amount_sek: Decimal
    description: Optional[str] = None
    transaction_id: UUID


class InvestmentOverviewResponse(BaseModel):
    """Combined investments overview for the investments page."""

    portfolio: InvestmentPortfolioOverviewRead
    accounts: list[InvestmentAccountOverviewRead]
    recent_cashflows: list[InvestmentCashflowEventRead] = Field(default_factory=list)


class InvestmentSnapshotCreateRequest(BaseModel):
    """Request to create a manual investment snapshot."""

    account_id: UUID
    snapshot_date: date
    balance: Decimal
    notes: Optional[str] = None


class InvestmentSnapshotCreateResponse(BaseModel):
    """Response after creating a manual investment snapshot."""

    snapshot_id: UUID
    account_id: UUID
    snapshot_date: date
    balance: Decimal


__all__ = [
    "InvestmentTransactionRead",
    "InvestmentTransactionListResponse",
    "InvestmentValuePointRead",
    "InvestmentCashflowPointRead",
    "InvestmentCashflowSummaryRead",
    "InvestmentGrowthRead",
    "InvestmentPortfolioOverviewRead",
    "InvestmentAccountOverviewRead",
    "InvestmentCashflowEventRead",
    "InvestmentOverviewResponse",
    "InvestmentSnapshotCreateRequest",
    "InvestmentSnapshotCreateResponse",
]
