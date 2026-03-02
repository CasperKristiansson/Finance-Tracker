"""Pydantic schemas for loan API operations."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..shared import InterestCompound, LoanEventType
from .account import LoanCreate


class LoanCreateRequest(LoanCreate):
    """Payload for attaching a loan to an existing account."""

    account_id: UUID


class LoanUpdate(BaseModel):
    """Patch payload for updating loan configuration."""

    origin_principal: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    current_principal: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    interest_rate_annual: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    interest_compound: Optional[InterestCompound] = None
    minimum_payment: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    expected_maturity_date: Optional[date] = None

    @model_validator(mode="after")
    def ensure_fields_present(self) -> "LoanUpdate":
        if not any(
            value is not None
            for value in (
                self.origin_principal,
                self.current_principal,
                self.interest_rate_annual,
                self.interest_compound,
                self.minimum_payment,
                self.expected_maturity_date,
            )
        ):
            raise ValueError("At least one field must be provided for update")
        return self


class LoanScheduleQuery(BaseModel):
    """Query parameters accepted by the loan schedule endpoint."""

    as_of_date: Optional[date] = Field(default=None, alias="as_of_date")
    periods: int = Field(default=60, ge=1, le=360)


class LoanScheduleEntry(BaseModel):
    """Single line item in the amortization schedule."""

    period: int
    due_date: date
    payment_amount: Decimal
    interest_amount: Decimal
    principal_amount: Decimal
    remaining_principal: Decimal


class LoanScheduleRead(BaseModel):
    """Amortization schedule response."""

    account_id: UUID
    loan_id: UUID
    generated_at: datetime
    as_of_date: date
    schedule: List[LoanScheduleEntry]


class LoanEventRead(BaseModel):
    """Representation of a loan event derived from transactions."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    loan_id: UUID
    transaction_id: UUID
    transaction_leg_id: Optional[UUID] = None
    event_type: LoanEventType
    amount: Decimal
    occurred_at: datetime


class LoanEventListQuery(BaseModel):
    """Query parameters accepted by the loan events endpoint."""

    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)


class LoanEventListResponse(BaseModel):
    """Response payload for loan event listings."""

    events: List[LoanEventRead]


class LoanPortfolioSeriesQuery(BaseModel):
    """Query parameters accepted by the loan portfolio series endpoint."""

    start_date: Optional[date] = Field(default=None, alias="start_date")
    end_date: Optional[date] = Field(default=None, alias="end_date")


class LoanPortfolioSeriesPoint(BaseModel):
    """Daily total of cumulative loan balance."""

    date: str
    total: Decimal


class LoanPortfolioSeriesRead(BaseModel):
    """Cumulative loan balance series derived from loan events."""

    series: List[LoanPortfolioSeriesPoint]


class LoanActivityCreateRequest(BaseModel):
    """Request payload for recording loan activity atomically."""

    kind: str = Field(pattern="^(payment|disbursement)$")
    funding_account_id: UUID
    amount: Decimal = Field(gt=Decimal("0"))
    occurred_at: datetime
    description: Optional[str] = Field(default=None, max_length=250)
    sync_principal: bool = False


class LoanActivityCreateResponse(BaseModel):
    """Response payload after recording loan activity."""

    account_id: UUID
    loan_id: UUID
    transaction_id: UUID
    amount: Decimal
    kind: str
    current_principal: Decimal


__all__ = [
    "LoanCreateRequest",
    "LoanActivityCreateRequest",
    "LoanActivityCreateResponse",
    "LoanUpdate",
    "LoanScheduleQuery",
    "LoanScheduleEntry",
    "LoanScheduleRead",
    "LoanEventRead",
    "LoanEventListQuery",
    "LoanEventListResponse",
    "LoanPortfolioSeriesQuery",
    "LoanPortfolioSeriesPoint",
    "LoanPortfolioSeriesRead",
]
