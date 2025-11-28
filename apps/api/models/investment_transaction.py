"""Investment transactions parsed from Nordnet exports."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlmodel import Field, SQLModel

from ..shared import TimestampMixin, UUIDPrimaryKeyMixin


class InvestmentTransaction(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """Normalized investment transaction (buy/sell/dividend/fee/transfer)."""

    __tablename__ = "investment_transactions"

    snapshot_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("investment_snapshots.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    occurred_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    transaction_type: str = Field(sa_column=Column(String(32), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(String(240)))
    holding_name: Optional[str] = Field(default=None, sa_column=Column(String(240)))
    isin: Optional[str] = Field(default=None, sa_column=Column(String(48)))
    account_name: Optional[str] = Field(default=None, sa_column=Column(String(160)))
    quantity: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 4)))
    amount_sek: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))
    currency: Optional[str] = Field(default=None, sa_column=Column(String(8)))
    fee_sek: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 2)))
    notes: Optional[str] = Field(default=None, sa_column=Column(String(255)))

    __table_args__ = (
        UniqueConstraint(
            "occurred_at",
            "transaction_type",
            "description",
            "amount_sek",
            "quantity",
            name="uq_investment_tx_identity",
        ),
    )


__all__ = ["InvestmentTransaction"]
