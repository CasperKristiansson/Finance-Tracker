"""Pydantic schemas for tax API endpoints."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from ..shared import TaxEventType


class TaxEventCreateRequest(BaseModel):
    """Request payload for recording an income tax payment/refund."""

    account_id: UUID
    occurred_at: datetime
    posted_at: Optional[datetime] = None
    amount: Decimal = Field(gt=Decimal("0"))
    event_type: TaxEventType
    description: str = Field(min_length=1, max_length=250)
    authority: Optional[str] = Field(default="Skatteverket", max_length=120)
    note: Optional[str] = Field(default=None, max_length=500)


class TaxEventRead(BaseModel):
    """Tax event representation for clients."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    transaction_id: UUID
    event_type: TaxEventType
    authority: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TaxEventListItem(BaseModel):
    """Tax event list entry enriched with transaction context."""

    id: UUID
    transaction_id: UUID
    occurred_at: datetime
    description: Optional[str] = None
    event_type: TaxEventType
    authority: Optional[str] = None
    note: Optional[str] = None
    account_id: UUID
    account_name: Optional[str] = None
    amount: Decimal


class TaxEventListQuery(BaseModel):
    """Query parameters for listing tax events."""

    start_date: Optional[datetime] = Field(default=None, alias="start_date")
    end_date: Optional[datetime] = Field(default=None, alias="end_date")
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class TaxEventListResponse(BaseModel):
    """Response payload for listing tax events."""

    events: List[TaxEventListItem]


class TaxSummaryMonthlyEntry(BaseModel):
    month: int = Field(ge=1, le=12)
    net_tax_paid: Decimal


class TaxSummaryTotals(BaseModel):
    net_tax_paid_ytd: Decimal
    net_tax_paid_last_12m: Decimal
    largest_month: Optional[int] = Field(default=None, ge=1, le=12)
    largest_month_value: Optional[Decimal] = None


class TaxSummaryResponse(BaseModel):
    year: int
    monthly: List[TaxSummaryMonthlyEntry]
    totals: TaxSummaryTotals


class TaxSummaryQuery(BaseModel):
    """Query parameters for tax summary endpoint."""

    year: Optional[int] = Field(default=None, ge=1900, le=3000)


__all__ = [
    "TaxEventCreateRequest",
    "TaxEventRead",
    "TaxEventListItem",
    "TaxEventListQuery",
    "TaxEventListResponse",
    "TaxSummaryMonthlyEntry",
    "TaxSummaryTotals",
    "TaxSummaryResponse",
    "TaxSummaryQuery",
]
