"""Pydantic schemas for import operations."""

from __future__ import annotations

import base64
from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError

from ..shared import BankImportType


class ImportFile(BaseModel):
    """Single file payload for import."""

    filename: str = Field(min_length=1, max_length=160)
    content_base64: str = Field(min_length=1)
    account_id: Optional[UUID] = None
    bank_type: BankImportType

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


class ExampleTransaction(BaseModel):
    """User-provided example to guide AI categorization."""

    description: str = Field(min_length=1, max_length=250)
    amount: str
    category_hint: str = Field(min_length=1, max_length=120)


class ImportBatchCreate(BaseModel):
    """Request payload for creating an import batch."""

    files: List[ImportFile]
    note: Optional[str] = Field(default=None, max_length=255)
    examples: Optional[List[ExampleTransaction]] = None


class ImportBatchRead(BaseModel):
    """Representation of an import batch."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    file_count: int
    total_rows: int
    total_errors: int
    status: str
    files: Optional[List["ImportFileRead"]] = None


class ImportFileRead(BaseModel):
    """File metadata returned from imports."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    filename: str
    account_id: Optional[UUID] = None
    row_count: int
    error_count: int
    status: str
    bank_type: BankImportType
    preview_rows: List[dict[str, Any]] = Field(default_factory=list)
    errors: List["ImportErrorRead"] = Field(default_factory=list)


class ImportRowRead(BaseModel):
    """Parsed row staged for review."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    file_id: UUID
    row_index: int
    data: dict[str, Any]
    suggested_category: Optional[str] = None
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


class ImportErrorRead(BaseModel):
    """Error details for a row in an import file."""

    model_config = ConfigDict(from_attributes=True)

    row_number: int
    message: str


class ImportBatchListResponse(BaseModel):
    """Response for listing import batches."""

    imports: List[ImportBatchRead]


class ImportSessionRead(BaseModel):
    """Staged import session returned to the client."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    source_name: Optional[str] = None
    note: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    file_count: int
    total_rows: int
    total_errors: int
    status: str
    files: List[ImportFileRead] = Field(default_factory=list)
    rows: List[ImportRowRead] = Field(default_factory=list)


class ImportSessionResponse(BaseModel):
    """Response wrapper for a single import session."""

    import_session: ImportSessionRead


class ImportCommitRow(BaseModel):
    """Overrides for committing a staged row."""

    row_id: UUID
    category_id: Optional[UUID] = None
    account_id: Optional[UUID] = None
    transfer_account_id: Optional[UUID] = None
    description: Optional[str] = None
    amount: Optional[str] = None
    occurred_at: Optional[datetime] = None
    subscription_id: Optional[UUID] = None
    delete: bool = False


class ImportCommitRequest(BaseModel):
    """Payload to commit a staged import session."""

    rows: List[ImportCommitRow]


__all__ = [
    "ImportFile",
    "ImportBatchCreate",
    "ImportBatchRead",
    "ImportBatchListResponse",
    "ImportFileRead",
    "ImportErrorRead",
    "ExampleTransaction",
    "ImportRowRead",
    "ImportSessionRead",
    "ImportSessionResponse",
    "ImportCommitRow",
    "ImportCommitRequest",
]
