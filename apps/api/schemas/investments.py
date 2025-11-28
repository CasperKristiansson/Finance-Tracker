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
    holdings: Optional[list["InvestmentHoldingRead"]] = None


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


class InvestmentHoldingRead(BaseModel):
    """Holding row from a snapshot."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    snapshot_id: UUID
    snapshot_date: date
    account_name: Optional[str] = None
    name: str
    isin: Optional[str] = None
    holding_type: Optional[str] = None
    currency: Optional[str] = None
    quantity: Optional[Decimal] = None
    price: Optional[Decimal] = None
    value_sek: Optional[Decimal] = None
    notes: Optional[str] = None


class InvestmentTransactionRead(BaseModel):
    """Investment transaction entry."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    snapshot_id: Optional[UUID] = None
    occurred_at: datetime
    transaction_type: str
    description: Optional[str] = None
    holding_name: Optional[str] = None
    isin: Optional[str] = None
    account_name: Optional[str] = None
    quantity: Optional[Decimal] = None
    amount_sek: Decimal
    currency: Optional[str] = None
    fee_sek: Optional[Decimal] = None
    notes: Optional[str] = None


class InvestmentTransactionListResponse(BaseModel):
    """Response for listing investment transactions."""

    transactions: list[InvestmentTransactionRead]


class InvestmentPerformanceRead(BaseModel):
    """Aggregated performance metrics."""

    total_value: Decimal
    invested: Decimal
    realized_pl: Decimal
    unrealized_pl: Decimal
    twr: Optional[float] = None
    irr: Optional[float] = None
    as_of: date
    benchmarks: list["BenchmarkRead"] = Field(default_factory=list)


class BenchmarkRead(BaseModel):
    """Benchmark comparison."""

    symbol: str
    change_pct: Optional[float] = None
    series: list[tuple[str, float]] = Field(
        default_factory=list,
        description="List of (date, close) tuples",
    )


class InvestmentMetricsResponse(BaseModel):
    """Performance payload with holdings and totals."""

    performance: InvestmentPerformanceRead
    holdings: list[InvestmentHoldingRead]
    snapshots: list[NordnetSnapshotRead]
    transactions: list[InvestmentTransactionRead]


__all__ = [
    "NordnetSnapshotCreate",
    "NordnetSnapshotRead",
    "NordnetSnapshotResponse",
    "NordnetSnapshotListResponse",
    "NordnetParseRequest",
    "NordnetParseResponse",
]
