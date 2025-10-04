# pyright: reportGeneralTypeIssues=false
"""Category and system account models."""

from __future__ import annotations

from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, Column, String
from sqlalchemy.types import Enum as SAEnum
from sqlmodel import Field, SQLModel

from ..shared import (
    CategoryType,
    SystemAccountCode,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:  # pragma: no cover - circular import guard
    from .transaction import Transaction


class Category(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """User-managed transaction categories."""

    __tablename__ = "categories"

    name: str = Field(sa_column=Column(String(120), unique=True, nullable=False))
    category_type: CategoryType = Field(
        sa_column=Column(SAEnum(CategoryType), nullable=False)
    )
    color_hex: str | None = Field(
        default=None,
        sa_column=Column(String(7), nullable=True)
    )
    is_archived: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )

    if TYPE_CHECKING:  # pragma: no cover
        transactions: List["Transaction"]


class SystemAccount(UUIDPrimaryKeyMixin, SQLModel, table=True):
    """Pre-seeded accounts for balancing double-entry postings."""

    __tablename__ = "system_accounts"

    code: SystemAccountCode = Field(
        sa_column=Column(SAEnum(SystemAccountCode), unique=True, nullable=False)
    )
    description: str | None = Field(
        default=None,
        sa_column=Column(String(255), nullable=True)
    )


__all__ = [
    "Category",
    "SystemAccount",
]


Category.model_rebuild()
SystemAccount.model_rebuild()
