"""Pydantic schemas for subscription endpoints."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class SubscriptionCreate(BaseModel):
    """Payload for creating a subscription."""

    name: str = Field(max_length=120)
    matcher_text: str = Field(max_length=255)
    matcher_amount_tolerance: Optional[Decimal] = Field(default=None, ge=0)
    matcher_day_of_month: Optional[int] = Field(default=None, ge=1, le=31)
    category_id: Optional[UUID] = None
    is_active: bool = True


class SubscriptionRead(BaseModel):
    """Subscription representation returned to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    matcher_text: str
    matcher_amount_tolerance: Optional[Decimal] = None
    matcher_day_of_month: Optional[int] = None
    category_id: Optional[UUID] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class SubscriptionUpdate(BaseModel):
    """Partial update payload for subscriptions."""

    name: Optional[str] = Field(default=None, max_length=120)
    matcher_text: Optional[str] = Field(default=None, max_length=255)
    matcher_amount_tolerance: Optional[Decimal] = Field(default=None, ge=0)
    matcher_day_of_month: Optional[int] = Field(default=None, ge=1, le=31)
    category_id: Optional[UUID] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def ensure_updates_present(self) -> "SubscriptionUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided for update")
        return self


class SubscriptionListQuery(BaseModel):
    """Query params for listing subscriptions."""

    include_inactive: bool = Field(default=False, alias="include_inactive")


class SubscriptionListResponse(BaseModel):
    """Response payload for subscription listings."""

    subscriptions: List[SubscriptionRead]


class SubscriptionSummaryRead(SubscriptionRead):
    """Subscription with spend metrics and history."""

    current_month_spend: Decimal
    trailing_three_month_spend: Decimal
    trailing_twelve_month_spend: Decimal
    trend: List[Decimal]
    last_charge_at: Optional[datetime] = None
    category_name: Optional[str] = None


class SubscriptionSummaryResponse(BaseModel):
    """Response payload for subscription summaries."""

    subscriptions: List[SubscriptionSummaryRead]


class AttachSubscriptionRequest(BaseModel):
    """Payload for attaching a transaction to a subscription."""

    subscription_id: UUID


__all__ = [
    "SubscriptionCreate",
    "SubscriptionRead",
    "SubscriptionUpdate",
    "SubscriptionListQuery",
    "SubscriptionListResponse",
    "AttachSubscriptionRequest",
]
