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


class ImportRelatedTransactionRead(BaseModel):
    """Previously categorized transaction used as suggestion context."""

    id: UUID
    occurred_at: str
    description: str
    category_id: Optional[UUID] = None
    category_name: Optional[str] = None


class ImportPreviewRowSimilarMatchRead(BaseModel):
    """Similar transaction matches for a draft row."""

    row_id: UUID
    transaction_ids: List[UUID] = Field(default_factory=list)


class ImportPreviewAccountContextRead(BaseModel):
    """Per-account context returned by preview to support category suggestions."""

    account_id: UUID
    recent_transactions: List[ImportRelatedTransactionRead] = Field(default_factory=list)
    similar_transactions: List[ImportRelatedTransactionRead] = Field(default_factory=list)
    similar_by_row: List[ImportPreviewRowSimilarMatchRead] = Field(default_factory=list)


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
    accounts: List[ImportPreviewAccountContextRead] = Field(default_factory=list)


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


class ImportCategoryOption(BaseModel):
    """Category metadata provided to Bedrock suggestion endpoint."""

    id: UUID
    name: str = Field(min_length=1, max_length=120)
    category_type: str = Field(min_length=1, max_length=32)


class ImportCategoryHistoryItem(BaseModel):
    """Previously categorized transaction used as context for suggestions."""

    description: str = Field(min_length=1, max_length=250)
    category_id: UUID


class ImportCategorySuggestTransaction(BaseModel):
    """Draft transaction needing a category suggestion."""

    id: UUID
    description: str = Field(min_length=1, max_length=250)
    amount: Optional[str] = Field(default=None, max_length=32)
    occurred_at: Optional[str] = Field(default=None, max_length=32)


class ImportCategorySuggestRequest(BaseModel):
    """Request payload for Bedrock-based category suggestions (no DB access)."""

    categories: List[ImportCategoryOption]
    history: List[ImportCategoryHistoryItem] = Field(default_factory=list)
    transactions: List[ImportCategorySuggestTransaction]
    model_id: Optional[str] = Field(default=None, max_length=160)
    max_tokens: Optional[int] = Field(default=None, ge=50, le=4000)


class ImportCategorySuggestionRead(BaseModel):
    """Single suggestion result for a draft transaction."""

    id: UUID
    category_id: Optional[UUID] = None
    confidence: float = Field(ge=0.0, le=1.0)
    reason: Optional[str] = Field(default=None, max_length=220)


class ImportCategorySuggestResponse(BaseModel):
    """Response payload for Bedrock-based category suggestions."""

    suggestions: List[ImportCategorySuggestionRead]


__all__ = [
    "ImportErrorRead",
    "ImportPreviewFile",
    "ImportPreviewRequest",
    "ImportPreviewFileRead",
    "ImportRelatedTransactionRead",
    "ImportPreviewRowSimilarMatchRead",
    "ImportPreviewAccountContextRead",
    "ImportPreviewRowRead",
    "ImportPreviewResponse",
    "ImportCommitRow",
    "ImportCommitRequest",
    "ImportCommitResponse",
    "ImportCategoryOption",
    "ImportCategoryHistoryItem",
    "ImportCategorySuggestTransaction",
    "ImportCategorySuggestRequest",
    "ImportCategorySuggestionRead",
    "ImportCategorySuggestResponse",
]
