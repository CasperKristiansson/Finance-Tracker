"""Budget models for category allocations."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Column, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.types import Enum as SAEnum
from sqlmodel import Field, SQLModel

from ..shared import BudgetPeriod, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:  # pragma: no cover
    from .category import Category


class Budget(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """Represents a budget allocation for a category and period."""

    __tablename__ = "budgets"

    category_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("categories.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    period: BudgetPeriod = Field(sa_column=Column(SAEnum(BudgetPeriod), nullable=False))
    amount: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))
    note: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))

    __table_args__ = (
        UniqueConstraint("category_id", "period", name="uq_budget_category_period"),
    )

    if TYPE_CHECKING:  # pragma: no cover
        category: Category


__all__ = ["Budget"]


Budget.model_rebuild()
