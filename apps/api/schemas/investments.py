"""Pydantic schemas for investment snapshot endpoints."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class NordnetSnapshotCreate(BaseModel):
    """Request payload for a Nordnet export snapshot."""

    raw_text: str = Field(min_length=1)
    parsed_payload: Optional[dict[str, Any]] = None
    manual_payload: Optional[dict[str, Any]] = None
    snapshot_date: Optional[date] = None
    report_type: Optional[str] = Field(default="portfolio_report", max_length=80)
    account_name: Optional[str] = Field(default=None, max_length=160)
    portfolio_value: Optional[Decimal] = None
    use_bedrock: bool = False
    bedrock_model_id: Optional[str] = Field(default=None, max_length=160)
    bedrock_max_tokens: Optional[int] = Field(default=None, ge=50, le=2000)

    @field_validator("parsed_payload")
    @classmethod
    def ensure_parsed_payload(cls, value: Optional[dict[str, Any]]) -> Optional[dict[str, Any]]:
        if value is None:
            return value
        if not isinstance(value, dict) or not value:
            raise ValueError("parsed_payload must be a non-empty object when provided")
        return value


class NordnetSnapshotRead(BaseModel):
    """Representation of a persisted snapshot."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    provider: str
    report_type: Optional[str] = None
    account_name: Optional[str] = None
    snapshot_date: date
    portfolio_value: Optional[Decimal] = None
    raw_text: str
    parsed_payload: dict[str, Any]
    cleaned_payload: Optional[dict[str, Any]] = None
    bedrock_metadata: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


class NordnetSnapshotResponse(BaseModel):
    """Response wrapper for a single snapshot."""

    snapshot: NordnetSnapshotRead


class NordnetSnapshotListResponse(BaseModel):
    """Response wrapper for snapshot lists."""

    snapshots: list[NordnetSnapshotRead]


class NordnetParseRequest(BaseModel):
    """Request payload to pre-parse Nordnet text."""

    raw_text: str = Field(min_length=1)
    manual_payload: Optional[dict[str, Any]] = None


class NordnetParseResponse(BaseModel):
    """Parsed payload response without persistence."""

    report_type: Optional[str] = None
    snapshot_date: Optional[date] = None
    portfolio_value: Optional[Decimal] = None
    parsed_payload: dict[str, Any]


__all__ = [
    "NordnetSnapshotCreate",
    "NordnetSnapshotRead",
    "NordnetSnapshotResponse",
    "NordnetSnapshotListResponse",
    "NordnetParseRequest",
    "NordnetParseResponse",
]
