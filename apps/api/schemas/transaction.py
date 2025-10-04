"""Pydantic schemas for transaction API endpoints."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional, Sequence
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from ..shared import TransactionType


class TransactionLegCreate(BaseModel):
    """Payload for creating a transaction leg."""

    account_id: UUID
    amount: Decimal


class TransactionLegRead(BaseModel):
    """Leg information returned to API clients."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
    amount: Decimal


class TransactionCreate(BaseModel):
    """Transaction creation payload."""

    category_id: Optional[UUID] = None
    description: Optional[str] = Field(default=None, max_length=250)
    notes: Optional[str] = None
    external_id: Optional[str] = Field(default=None, max_length=180)
    occurred_at: datetime
    posted_at: Optional[datetime] = None
    transaction_type: TransactionType = TransactionType.TRANSFER
    legs: List[TransactionLegCreate]

    @model_validator(mode="after")
    def validate_model(self) -> "TransactionCreate":
        if len(self.legs) < 2:
            raise ValueError("Transactions require at least two legs")
        if self.posted_at is None:
            self.posted_at = self.occurred_at
        return self


class TransactionRead(BaseModel):
    """Transaction representation returned by handlers."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: Optional[UUID] = None
    transaction_type: TransactionType
    description: Optional[str] = None
    notes: Optional[str] = None
    external_id: Optional[str] = None
    occurred_at: datetime
    posted_at: datetime
    created_at: datetime
    updated_at: datetime
    legs: List[TransactionLegRead]


class TransactionListQuery(BaseModel):
    """Query filters for listing transactions."""

    start_date: Optional[datetime] = Field(default=None, alias="start_date")
    end_date: Optional[datetime] = Field(default=None, alias="end_date")
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")

    @model_validator(mode="before")
    def split_account_ids(cls, values: Any) -> Any:
        if isinstance(values, dict) and "account_ids" in values:
            account_ids = values["account_ids"]
            if isinstance(account_ids, str):
                parts = [part.strip() for part in account_ids.split(",") if part.strip()]
                converted: List[UUID] = []
                for part in parts:
                    try:
                        converted.append(UUID(part))
                    except ValueError as exc:  # pragma: no cover - validation
                        raise ValidationError(
                            [
                                {
                                    "loc": ("account_ids",),
                                    "msg": "Invalid UUID in account_ids",
                                    "type": "value_error",
                                }
                            ],
                            cls,
                        ) from exc
                values["account_ids"] = converted
        return values


class TransactionListResponse(BaseModel):
    """Response payload for transaction listings."""

    transactions: List[TransactionRead]


__all__ = [
    "TransactionCreate",
    "TransactionRead",
    "TransactionLegCreate",
    "TransactionLegRead",
    "TransactionListQuery",
    "TransactionListResponse",
]
