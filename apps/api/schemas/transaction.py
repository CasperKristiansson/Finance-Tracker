"""Pydantic schemas for transaction API endpoints."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Literal, Optional
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
    subscription_id: Optional[UUID] = None
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
    subscription_id: Optional[UUID] = None
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
    category_ids: Optional[List[UUID]] = Field(default=None, alias="category_ids")
    subscription_ids: Optional[List[UUID]] = Field(default=None, alias="subscription_ids")
    transaction_type: Optional[List[TransactionType]] = Field(
        default=None, alias="transaction_type"
    )
    min_amount: Optional[Decimal] = Field(default=None, alias="min_amount")
    max_amount: Optional[Decimal] = Field(default=None, alias="max_amount")
    search: Optional[str] = None
    sort_by: Literal["occurred_at", "amount", "description", "category", "type"] = Field(
        default="occurred_at", alias="sort_by"
    )
    sort_dir: Literal["asc", "desc"] = Field(default="desc", alias="sort_dir")
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

        if isinstance(values, dict) and "category_ids" in values:
            category_ids = values.get("category_ids")
            if isinstance(category_ids, str):
                parts = [part.strip() for part in category_ids.split(",") if part.strip()]
                converted_categories: List[UUID] = []
                for part in parts:
                    try:
                        converted_categories.append(UUID(part))
                    except ValueError as exc:  # pragma: no cover - validation
                        raise ValidationError(
                            [
                                {
                                    "loc": ("category_ids",),
                                    "msg": "Invalid UUID in category_ids",
                                    "type": "value_error",
                                }
                            ],
                            cls,
                        ) from exc
                values["category_ids"] = converted_categories

        if isinstance(values, dict) and "subscription_ids" in values:
            subscription_ids = values.get("subscription_ids")
            if isinstance(subscription_ids, str):
                parts = [part.strip() for part in subscription_ids.split(",") if part.strip()]
                converted_subscriptions: List[UUID] = []
                for part in parts:
                    try:
                        converted_subscriptions.append(UUID(part))
                    except ValueError as exc:  # pragma: no cover - validation
                        raise ValidationError(
                            [
                                {
                                    "loc": ("subscription_ids",),
                                    "msg": "Invalid UUID in subscription_ids",
                                    "type": "value_error",
                                }
                            ],
                            cls,
                        ) from exc
                values["subscription_ids"] = converted_subscriptions

        if (
            isinstance(values, dict)
            and "transaction_type" in values
            and isinstance(values["transaction_type"], str)
        ):
            type_values = [
                part.strip() for part in str(values["transaction_type"]).split(",") if part.strip()
            ]
            converted_types: List[TransactionType] = []
            for tx_type in type_values:
                try:
                    converted_types.append(TransactionType(tx_type))
                except ValueError as exc:  # pragma: no cover - validation
                    raise ValidationError(
                        [
                            {
                                "loc": ("transaction_type",),
                                "msg": "Invalid transaction_type provided",
                                "type": "value_error",
                            }
                        ],
                        cls,
                    ) from exc
            values["transaction_type"] = converted_types
        return values


class TransactionListResponse(BaseModel):
    """Response payload for transaction listings."""

    transactions: List[TransactionRead]
    running_balances: dict[UUID, Decimal]


class TransactionUpdate(BaseModel):
    """Partial update payload for transactions."""

    description: Optional[str] = Field(default=None, max_length=250)
    notes: Optional[str] = None
    occurred_at: Optional[datetime] = None
    posted_at: Optional[datetime] = None
    category_id: Optional[UUID] = None
    subscription_id: Optional[UUID] = None

    @model_validator(mode="after")
    def ensure_updates_present(self) -> "TransactionUpdate":
        if not self.model_fields_set:
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
