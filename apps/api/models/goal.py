"""Goal model for savings/progress tracking."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Column, Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlmodel import Field, SQLModel

from ..shared import TimestampMixin, UserOwnedMixin, UUIDPrimaryKeyMixin


class Goal(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Represents a user-defined financial goal."""

    __tablename__ = "goals"

    name: str = Field(sa_column=Column(String(180), nullable=False))
    target_amount: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))
    target_date: Optional[date] = Field(default=None, sa_column=Column(Date(), nullable=True))
    category_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    account_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    subscription_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    note: Optional[str] = Field(default=None, sa_column=Column(String(255), nullable=True))


__all__ = ["Goal"]


Goal.model_rebuild()
