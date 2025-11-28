"""Investment snapshot models for Nordnet exports."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional

from sqlalchemy import Column, Date, JSON, Numeric, String, Text
from sqlmodel import Field, SQLModel

from ..shared import TimestampMixin, UUIDPrimaryKeyMixin


class InvestmentSnapshot(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """Stores a dated snapshot of an investment export."""

    __tablename__ = "investment_snapshots"

    provider: str = Field(sa_column=Column(String(80), nullable=False))
    report_type: Optional[str] = Field(default=None, sa_column=Column(String(80), nullable=True))
    account_name: Optional[str] = Field(
        default=None,
        sa_column=Column(String(160), nullable=True),
    )
    snapshot_date: date = Field(sa_column=Column(Date(), nullable=False))
    portfolio_value: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(18, 2), nullable=True),
    )
    raw_text: str = Field(sa_column=Column(Text, nullable=False))
    parsed_payload: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    cleaned_payload: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    bedrock_metadata: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )


__all__ = ["InvestmentSnapshot"]


InvestmentSnapshot.model_rebuild()
