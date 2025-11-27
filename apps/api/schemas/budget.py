"""Pydantic schemas for budgets."""

from __future__ import annotations

from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..shared import BudgetPeriod


class BudgetCreate(BaseModel):
    category_id: UUID
    period: BudgetPeriod
    amount: Decimal = Field(gt=0)
    note: Optional[str] = Field(default=None, max_length=255)


class BudgetUpdate(BaseModel):
    period: Optional[BudgetPeriod] = None
    amount: Optional[Decimal] = Field(default=None, gt=0)
    note: Optional[str] = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def ensure_updates_present(self) -> "BudgetUpdate":
        if not any(value is not None for value in (self.period, self.amount, self.note)):
            raise ValueError("At least one field must be provided for update")
        return self


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: UUID
    period: BudgetPeriod
    amount: Decimal
    note: Optional[str] = None


class BudgetListResponse(BaseModel):
    budgets: list[BudgetRead]


class BudgetProgressRead(BudgetRead):
    spent: Decimal
    remaining: Decimal
    percent_used: Decimal


class BudgetProgressListResponse(BaseModel):
    budgets: list[BudgetProgressRead]


__all__ = [
    "BudgetCreate",
    "BudgetUpdate",
    "BudgetRead",
    "BudgetListResponse",
    "BudgetProgressRead",
    "BudgetProgressListResponse",
]
