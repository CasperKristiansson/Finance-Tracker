"""Pydantic schemas for transaction API endpoints."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..shared import TransactionType
from .tax import TaxEventRead


def _split_transaction_csv_filters(values: Any) -> Any:
    if not isinstance(values, dict):
        return values

    if "account_ids" in values and isinstance(values.get("account_ids"), str):
        parts = [part.strip() for part in str(values["account_ids"]).split(",") if part.strip()]
        parsed_account_ids: List[UUID] = []
        for part in parts:
            try:
                parsed_account_ids.append(UUID(part))
            except ValueError as exc:
                raise ValueError(f"Invalid UUID in account_ids: {part}") from exc
        values["account_ids"] = parsed_account_ids

    if "category_ids" in values and isinstance(values.get("category_ids"), str):
        parts = [part.strip() for part in str(values["category_ids"]).split(",") if part.strip()]
        parsed_category_ids: List[UUID] = []
        for part in parts:
            try:
                parsed_category_ids.append(UUID(part))
            except ValueError as exc:
                raise ValueError(f"Invalid UUID in category_ids: {part}") from exc
        values["category_ids"] = parsed_category_ids

    if "transaction_type" in values and isinstance(values["transaction_type"], str):
        parts = [
            part.strip() for part in str(values["transaction_type"]).split(",") if part.strip()
        ]
        parsed_types: List[TransactionType] = []
        for part in parts:
            try:
                parsed_types.append(TransactionType(part))
            except ValueError as exc:
                raise ValueError(f"Invalid transaction_type: {part}") from exc
        values["transaction_type"] = parsed_types

    return values


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
    tax_event: Optional[TaxEventRead] = None
    legs: List[TransactionLegRead]


class TransactionListQuery(BaseModel):
    """Query filters for listing transactions."""

    start_date: Optional[datetime] = Field(default=None, alias="start_date")
    end_date: Optional[datetime] = Field(default=None, alias="end_date")
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")
    category_ids: Optional[List[UUID]] = Field(default=None, alias="category_ids")
    transaction_type: Optional[List[TransactionType]] = Field(
        default=None, alias="transaction_type"
    )
    tax_event: Optional[bool] = Field(default=None, alias="tax_event")
    min_amount: Optional[Decimal] = Field(default=None, alias="min_amount")
    max_amount: Optional[Decimal] = Field(default=None, alias="max_amount")
    search: Optional[str] = None
    sort_by: Literal["occurred_at", "amount", "description", "category", "type"] = Field(
        default="occurred_at", alias="sort_by"
    )
    sort_dir: Literal["asc", "desc"] = Field(default="desc", alias="sort_dir")
    limit: int = Field(default=50, ge=1, le=200)
    offset: int = Field(default=0, ge=0)
    include_running_balances: bool = Field(default=False, alias="include_running_balances")
    include_tax_event: bool = Field(default=False, alias="include_tax_event")
    view: Literal["full", "summary"] = Field(default="full")

    @model_validator(mode="before")
    @classmethod
    def split_csv_filters(cls, values: Any) -> Any:
        return _split_transaction_csv_filters(values)


class TransactionSummaryRead(BaseModel):
    """Condensed transaction representation for list/recent views."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    category_id: Optional[UUID] = None
    transaction_type: TransactionType
    description: Optional[str] = None
    notes: Optional[str] = None
    occurred_at: datetime
    posted_at: datetime
    tax_event: Optional[TaxEventRead] = None
    legs: List[TransactionLegRead]


class TransactionListResponse(BaseModel):
    """Response payload for transaction listings."""

    transactions: List[TransactionRead | TransactionSummaryRead]
    running_balances: Optional[dict[UUID, Decimal]] = None


class TransactionRecentQuery(BaseModel):
    """Query filters for the recent-transactions endpoint."""

    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")
    transaction_type: Optional[List[TransactionType]] = Field(
        default=None, alias="transaction_type"
    )
    include_tax_event: bool = Field(default=False, alias="include_tax_event")
    limit: int = Field(default=20, ge=1, le=200)

    @model_validator(mode="before")
    @classmethod
    def split_csv_filters(cls, values: Any) -> Any:
        return _split_transaction_csv_filters(values)


class TransactionRecentResponse(BaseModel):
    """Response payload for recent transaction listings."""

    transactions: List[TransactionSummaryRead]


class TransactionUpdate(BaseModel):
    """Partial update payload for transactions."""

    description: Optional[str] = Field(default=None, max_length=250)
    notes: Optional[str] = None
    occurred_at: Optional[datetime] = None
    posted_at: Optional[datetime] = None
    category_id: Optional[UUID] = None

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
    "TransactionSummaryRead",
    "TransactionLegCreate",
    "TransactionLegRead",
    "TransactionListQuery",
    "TransactionListResponse",
    "TransactionRecentQuery",
    "TransactionRecentResponse",
]
