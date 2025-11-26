"""Pydantic schemas for transaction API endpoints."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from ..shared import TransactionStatus, TransactionType


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
    status: TransactionStatus = TransactionStatus.RECORDED
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
    status: TransactionStatus
    legs: List[TransactionLegRead]


class TransactionListQuery(BaseModel):
    """Query filters for listing transactions."""

    start_date: Optional[datetime] = Field(default=None, alias="start_date")
    end_date: Optional[datetime] = Field(default=None, alias="end_date")
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)

    @model_validator(mode="before")
    @classmethod
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


class TransactionUpdate(BaseModel):
    """Partial update payload for transactions."""

    description: Optional[str] = Field(default=None, max_length=250)
    notes: Optional[str] = None
    occurred_at: Optional[datetime] = None
    posted_at: Optional[datetime] = None
    category_id: Optional[UUID] = None
    status: Optional[TransactionStatus] = None

    @model_validator(mode="after")
    def ensure_updates_present(self) -> "TransactionUpdate":
        if not any(
            value is not None
            for value in (
                self.description,
                self.notes,
                self.occurred_at,
                self.posted_at,
                self.category_id,
                self.status,
            )
        ):
            raise ValueError("At least one field must be provided for update")
        return self


class TransactionPathParams(BaseModel):
    transaction_id: UUID


__all__ = [
    "TransactionCreate",
    "TransactionRead",
    "TransactionLegCreate",
    "TransactionLegRead",
    "TransactionListQuery",
    "TransactionListResponse",
]
