"""Pydantic schemas for import operations."""

from __future__ import annotations

import base64
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError

from ..shared import BankImportType, TaxEventType


class ImportErrorRead(BaseModel):
    """Error details for a row in an import file."""

    model_config = ConfigDict(from_attributes=True)

    row_number: int
    message: str


class ImportPreviewFile(BaseModel):
    """Single file payload for import preview."""

    filename: str = Field(min_length=1, max_length=160)
    content_base64: str = Field(min_length=1)
    account_id: UUID

    @field_validator("content_base64")
    @classmethod
    def validate_base64(cls, value: str) -> str:
        try:
            base64.b64decode(value, validate=True)
        except Exception as exc:  # pragma: no cover - defensive
            raise PydanticCustomError(
                "invalid_base64", "content_base64 must be valid base64"
            ) from exc
        return value


class ImportPreviewRequest(BaseModel):
    """Request payload for previewing an import (no persistence)."""

    files: List[ImportPreviewFile]
    note: Optional[str] = Field(default=None, max_length=255)


class ImportPreviewFileRead(BaseModel):
    """Preview metadata returned for each uploaded file."""

    id: UUID
    filename: str
    account_id: UUID
    bank_import_type: Optional[BankImportType] = None
    row_count: int
    error_count: int
    errors: List[ImportErrorRead] = Field(default_factory=list)
    preview_rows: List[dict[str, Any]] = Field(default_factory=list)


class ImportPreviewRowRead(BaseModel):
    """Single draft transaction row returned by preview."""

    id: UUID
    file_id: UUID
    row_index: int
    account_id: UUID
    occurred_at: str
    amount: str
    description: str
    suggested_category_id: Optional[UUID] = None
    suggested_category_name: Optional[str] = None
    suggested_confidence: Optional[float] = None
    suggested_reason: Optional[str] = None
    suggested_subscription_id: Optional[UUID] = None
    suggested_subscription_name: Optional[str] = None
    suggested_subscription_confidence: Optional[float] = None
    suggested_subscription_reason: Optional[str] = None
    transfer_match: Optional[dict[str, Any]] = None
    rule_applied: bool = False
    rule_type: Optional[str] = None
    rule_summary: Optional[str] = None


class ImportPreviewResponse(BaseModel):
    """Response payload for import preview."""

    files: List[ImportPreviewFileRead]
    rows: List[ImportPreviewRowRead]


class ImportCommitRow(BaseModel):
    """Single draft transaction row submitted for commit."""

    id: UUID
    account_id: UUID
    occurred_at: str
    amount: str
    description: str
    category_id: Optional[UUID] = None
    subscription_id: Optional[UUID] = None
    transfer_account_id: Optional[UUID] = None
    tax_event_type: Optional[TaxEventType] = None
    delete: bool = False


class ImportCommitRequest(BaseModel):
    """Payload to commit a previewed import (persists transactions)."""

    note: Optional[str] = Field(default=None, max_length=255)
    rows: List[ImportCommitRow]


class ImportCommitResponse(BaseModel):
    """Response payload for a committed import."""

    import_batch_id: UUID
    transaction_ids: List[UUID]


__all__ = [
    "ImportErrorRead",
    "ImportPreviewFile",
    "ImportPreviewRequest",
    "ImportPreviewFileRead",
    "ImportPreviewRowRead",
    "ImportPreviewResponse",
    "ImportCommitRow",
    "ImportCommitRequest",
    "ImportCommitResponse",
]
