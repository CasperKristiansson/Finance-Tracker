"""Pydantic schemas for import operations."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic_core import PydanticCustomError


class ImportFile(BaseModel):
    """Single file payload for import."""

    filename: str = Field(min_length=1, max_length=160)
    content_base64: str = Field(min_length=1)
    account_id: Optional[UUID] = None
    template_id: Optional[str] = Field(default=None, max_length=120)

    @field_validator("content_base64")
    @classmethod
    def validate_base64(cls, value: str) -> str:
        try:
            import base64

            base64.b64decode(value, validate=True)
        except Exception as exc:  # pragma: no cover - defensive
            raise PydanticCustomError("invalid_base64", "content_base64 must be valid base64") from exc
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
    template_id: Optional[str] = None
    preview_rows: List[dict[str, Any]] = Field(default_factory=list)
    errors: List["ImportErrorRead"] = Field(default_factory=list)


class ImportErrorRead(BaseModel):
    """Error details for a row in an import file."""

    model_config = ConfigDict(from_attributes=True)

    row_number: int
    message: str


class ImportBatchListResponse(BaseModel):
    """Response for listing import batches."""

    imports: List[ImportBatchRead]


__all__ = [
    "ImportFile",
    "ImportBatchCreate",
    "ImportBatchRead",
    "ImportBatchListResponse",
    "ImportFileRead",
    "ImportErrorRead",
    "ExampleTransaction",
]
