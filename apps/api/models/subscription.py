"""Subscription model for recurring transactions."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID

from sqlalchemy import Boolean, Column, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlmodel import Field, Relationship, SQLModel

from ..shared import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:  # pragma: no cover
    from .category import Category
    from .transaction import Transaction


class Subscription(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """Represents a user-defined subscription matcher."""

    __tablename__ = "subscriptions"

    name: str = Field(sa_column=Column(String(120), nullable=False))
    matcher_text: str = Field(sa_column=Column(String(255), nullable=False))
    matcher_amount_tolerance: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(18, 2), nullable=True),
    )
    matcher_day_of_month: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, nullable=True),
    )
    category_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default="true"),
    )

    if TYPE_CHECKING:  # pragma: no cover
        category: Optional["Category"]
        transactions: List["Transaction"]

    category: Optional["Category"] = Relationship(
        sa_relationship=relationship("Category"),
    )
    transactions: List["Transaction"] = Relationship(
        back_populates="subscription",
        sa_relationship=relationship("Transaction", back_populates="subscription"),
    )


__all__ = ["Subscription"]


Subscription.model_rebuild()
