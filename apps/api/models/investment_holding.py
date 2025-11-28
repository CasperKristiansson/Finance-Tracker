"""Investment holding rows attached to snapshots."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, Date, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlmodel import Field, Relationship, SQLModel

from ..shared import TimestampMixin, UserOwnedMixin, UUIDPrimaryKeyMixin
from .investment_snapshot import InvestmentSnapshot


class InvestmentHolding(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Denormalized holding from a portfolio snapshot."""

    __tablename__ = "investment_holdings"

    snapshot_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("investment_snapshots.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    snapshot_date: date = Field(sa_column=Column(Date(), nullable=False))
    account_name: Optional[str] = Field(default=None, sa_column=Column(String(160)))
    name: str = Field(sa_column=Column(String(240), nullable=False))
    isin: Optional[str] = Field(default=None, sa_column=Column(String(48)))
    holding_type: Optional[str] = Field(default=None, sa_column=Column(String(32)))
    currency: Optional[str] = Field(default=None, sa_column=Column(String(8)))
    quantity: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 4)))
    price: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 4)))
    value_sek: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 2)))
    notes: Optional[str] = Field(default=None, sa_column=Column(String(255)))

    snapshot: InvestmentSnapshot = Relationship(
        sa_relationship=relationship("InvestmentSnapshot", back_populates="holdings")
    )

    __table_args__ = (
        UniqueConstraint(
            "snapshot_id",
            "name",
            "currency",
            name="uq_investment_holding_snapshot_name_currency",
        ),
    )


__all__ = ["InvestmentHolding"]
