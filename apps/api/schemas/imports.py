"""Pydantic schemas for import operations."""

from __future__ import annotations

import base64
from datetime import datetime
from typing import Any, List, Literal, Optional
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
    account_id: UUID
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
    transfer_match: Optional[dict[str, Any]] = None
    rule_applied: bool = False
    rule_type: Optional[str] = None
    rule_summary: Optional[str] = None
    draft: Optional[dict[str, Any]] = None


class ImportPreviewResponse(BaseModel):
    """Response payload for import preview."""

    import_batch_id: UUID
    suggestions_status: Literal["not_started", "running", "completed", "failed"] = "not_started"
    files: List[ImportPreviewFileRead]
    rows: List[ImportPreviewRowRead]
    accounts: List[ImportPreviewAccountContextRead] = Field(default_factory=list)


class ImportCommitRow(BaseModel):
    """Single draft transaction row submitted for commit."""

    id: UUID
    file_id: Optional[UUID] = None
    account_id: UUID
    occurred_at: str
    amount: str
    description: str
    category_id: Optional[UUID] = None
    transfer_account_id: Optional[UUID] = None
    tax_event_type: Optional[TaxEventType] = None
    delete: bool = False


class ImportCommitFile(BaseModel):
    """Metadata about the files included in a commit."""

    id: UUID
    filename: str
    account_id: UUID
    row_count: int
    error_count: int
    bank_import_type: Optional[BankImportType] = None
    content_base64: str
    content_type: Optional[str] = None

    @field_validator("content_base64")
    @classmethod
    def validate_commit_base64(cls, value: str) -> str:
        try:
            base64.b64decode(value, validate=True)
        except Exception as exc:  # pragma: no cover - defensive
            raise PydanticCustomError(
                "invalid_base64", "content_base64 must be valid base64"
            ) from exc
        return value


class ImportCommitRequest(BaseModel):
    """Payload to commit a previewed import (persists transactions)."""

    import_batch_id: Optional[UUID] = None
    note: Optional[str] = Field(default=None, max_length=255)
    rows: List[ImportCommitRow]
    files: Optional[List[ImportCommitFile]] = None


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


class ImportCategorySuggestJobRequest(ImportCategorySuggestRequest):
    """Async suggestion request payload tied to a websocket client."""

    import_batch_id: Optional[UUID] = None
    client_id: UUID
    client_token: str = Field(min_length=16, max_length=160)


class ImportCategorySuggestJobResponse(BaseModel):
    """Async suggestion response with a queued job id."""

    job_id: UUID


class ImportFileRead(BaseModel):
    """Metadata for a stored import file."""

    id: UUID
    filename: str
    account_id: Optional[UUID] = None
    account_name: Optional[str] = None
    bank_import_type: Optional[BankImportType] = None
    row_count: int
    error_count: int
    transaction_ids: List[UUID] = Field(default_factory=list)
    import_batch_id: UUID
    size_bytes: Optional[int] = None
    content_type: Optional[str] = None
    uploaded_at: datetime
    status: str


class ImportFileListResponse(BaseModel):
    """List response for stored import files."""

    files: List[ImportFileRead]


class ImportFileDownloadResponse(BaseModel):
    """Presigned download URL for a stored import file."""

    url: str


class ImportFileDownloadRequest(BaseModel):
    """Request payload for downloading a stored import file."""

    file_id: UUID


class ImportDraftRead(BaseModel):
    """Metadata for an incomplete import draft session."""

    import_batch_id: UUID
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    file_count: int
    row_count: int
    error_count: int
    file_names: List[str] = Field(default_factory=list)


class ImportDraftListResponse(BaseModel):
    """List response for incomplete import drafts."""

    drafts: List[ImportDraftRead]


class ImportDraftSaveRequest(BaseModel):
    """Save in-progress draft edits for an import batch."""

    rows: List[ImportCommitRow]


class ImportDraftSaveResponse(BaseModel):
    """Confirmation payload for draft save."""

    import_batch_id: UUID
    updated_at: datetime


class ImportDraftDeleteResponse(BaseModel):
    """Confirmation payload for draft deletion."""

    import_batch_id: UUID
    deleted: bool


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
    "ImportCommitFile",
    "ImportCommitRequest",
    "ImportCommitResponse",
    "ImportCategoryOption",
    "ImportCategoryHistoryItem",
    "ImportCategorySuggestTransaction",
    "ImportCategorySuggestRequest",
    "ImportCategorySuggestionRead",
    "ImportCategorySuggestResponse",
    "ImportCategorySuggestJobRequest",
    "ImportCategorySuggestJobResponse",
    "ImportFileRead",
    "ImportFileListResponse",
    "ImportFileDownloadRequest",
    "ImportFileDownloadResponse",
    "ImportDraftRead",
    "ImportDraftListResponse",
    "ImportDraftSaveRequest",
    "ImportDraftSaveResponse",
    "ImportDraftDeleteResponse",
]
