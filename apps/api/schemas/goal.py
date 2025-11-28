"""Schemas for goal CRUD."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class GoalCreate(BaseModel):
    """Payload to create a goal."""

    name: str = Field(min_length=1, max_length=180)
    target_amount: Decimal = Field(gt=Decimal("0"))
    target_date: Optional[date] = None
    category_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    subscription_id: Optional[UUID] = None
    note: Optional[str] = Field(default=None, max_length=255)


class GoalUpdate(BaseModel):
    """Payload to update a goal."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    target_amount: Optional[Decimal] = Field(default=None, gt=Decimal("0"))
    target_date: Optional[date] = None
    category_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    subscription_id: Optional[UUID] = None
    note: Optional[str] = Field(default=None, max_length=255)


class GoalRead(BaseModel):
    """Goal read model with computed progress."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    target_amount: Decimal
    target_date: Optional[date] = None
    category_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    subscription_id: Optional[UUID] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    current_amount: Decimal
    progress_pct: float


class GoalListResponse(BaseModel):
    """List payload for goals."""

    goals: list[GoalRead]


__all__ = ["GoalCreate", "GoalUpdate", "GoalRead", "GoalListResponse"]
