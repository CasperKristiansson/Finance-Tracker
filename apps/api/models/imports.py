"""Import-related models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, List, Optional
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlmodel import Field, Relationship, SQLModel

from ..shared import TimestampMixin, UserOwnedMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:  # pragma: no cover
    from .account import Account
    from .category import Category
    from .subscription import Subscription
    from .transaction import Transaction


class ImportFile(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Stores metadata about files included in an import batch."""

    __tablename__ = "import_files"

    batch_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("transaction_import_batches.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    filename: str = Field(sa_column=Column(String(160), nullable=False))
    account_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("accounts.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    row_count: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    error_count: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    status: str = Field(default="received", sa_column=Column(String(32), nullable=False))
    bank_type: str = Field(sa_column=Column(String(64), nullable=False))
    object_key: Optional[str] = Field(
        default=None,
        sa_column=Column(String(512), nullable=True),
    )
    content_type: Optional[str] = Field(
        default=None,
        sa_column=Column(String(160), nullable=True),
    )
    size_bytes: Optional[int] = Field(
        default=None,
        sa_column=Column(Integer, nullable=True),
    )
    errors: List["ImportErrorRecord"] = Relationship(
        sa_relationship=relationship(
            "ImportErrorRecord",
            primaryjoin="ImportFile.id==ImportErrorRecord.file_id",
            cascade="all, delete-orphan",
        )
    )
    rows: List["ImportRow"] = Relationship(
        sa_relationship=relationship(
            "ImportRow",
            primaryjoin="ImportFile.id==ImportRow.file_id",
            cascade="all, delete-orphan",
        )
    )
    account: Optional["Account"] = Relationship(
        sa_relationship=relationship("Account", primaryjoin="ImportFile.account_id==Account.id")
    )
    transactions: List["Transaction"] = Relationship(
        sa_relationship=relationship(
            "Transaction",
            primaryjoin="ImportFile.id==Transaction.import_file_id",
            back_populates="import_file",
        )
    )


class ImportErrorRecord(UUIDPrimaryKeyMixin, UserOwnedMixin, SQLModel, table=True):
    """Per-row error details for an import file."""

    __tablename__ = "import_errors"

    file_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("import_files.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    row_number: int = Field(sa_column=Column(Integer, nullable=False))
    message: str = Field(sa_column=Column(String(500), nullable=False))


class ImportRow(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Parsed row stored for staged import review."""

    __tablename__ = "import_rows"

    file_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("import_files.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    row_index: int = Field(sa_column=Column(Integer, nullable=False))
    data: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    suggested_category: Optional[str] = Field(default=None, sa_column=Column(String(160)))
    suggested_confidence: Optional[float] = Field(
        default=None,
        sa_column=Column(Numeric(5, 2), nullable=True),
    )
    suggested_reason: Optional[str] = Field(default=None, sa_column=Column(String(500)))
    suggested_subscription_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PGUUID(as_uuid=True), nullable=True),
    )
    suggested_subscription_name: Optional[str] = Field(
        default=None,
        sa_column=Column(String(160), nullable=True),
    )
    suggested_subscription_confidence: Optional[float] = Field(
        default=None,
        sa_column=Column(Numeric(5, 2), nullable=True),
    )
    suggested_subscription_reason: Optional[str] = Field(
        default=None,
        sa_column=Column(String(500), nullable=True),
    )
    transfer_match: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )
    rule_applied: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )
    rule_type: Optional[str] = Field(default=None, sa_column=Column(String(40), nullable=True))
    rule_summary: Optional[str] = Field(
        default=None,
        sa_column=Column(String(255), nullable=True),
    )
    rule_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("import_rules.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


class TransactionImportBatch(
    UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True
):
    """Groups transactions imported together for auditing."""

    __tablename__ = "transaction_import_batches"

    source_name: Optional[str] = Field(
        default=None,
        sa_column=Column(String(160), nullable=True),
    )
    note: Optional[str] = Field(
        default=None,
        sa_column=Column(String(255), nullable=True),
    )

    if TYPE_CHECKING:  # pragma: no cover
        transactions: List["Transaction"]
        files: List["ImportFile"]

    files: List["ImportFile"] = Relationship(
        sa_relationship=relationship(
            "ImportFile",
            primaryjoin="TransactionImportBatch.id==ImportFile.batch_id",
            cascade="all, delete-orphan",
        )
    )


class ImportRule(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Deterministic import rule learned from user corrections."""

    __tablename__ = "import_rules"

    matcher_text: str = Field(sa_column=Column(String(255), nullable=False))
    matcher_amount: Optional[Decimal] = Field(sa_column=Column(Numeric(18, 2), nullable=True))
    amount_tolerance: Optional[Decimal] = Field(
        default=None, sa_column=Column(Numeric(18, 2), nullable=True)
    )
    matcher_day_of_month: Optional[int] = Field(sa_column=Column(Integer, nullable=True))
    category_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PGUUID(as_uuid=True), ForeignKey("categories.id", ondelete="SET NULL")),
    )
    subscription_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PGUUID(as_uuid=True), ForeignKey("subscriptions.id", ondelete="SET NULL")),
    )
    hit_count: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default="0"),
    )
    last_hit_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), nullable=True)
    )
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default="true"),
    )

    if TYPE_CHECKING:  # pragma: no cover
        category: Optional["Category"]
        subscription: Optional["Subscription"]

    category: Optional["Category"] = Relationship(sa_relationship=relationship("Category"))
    subscription: Optional["Subscription"] = Relationship(
        sa_relationship=relationship("Subscription")
    )

    __table_args__ = (
        UniqueConstraint("user_id", "matcher_text", name="uq_import_rule_user_matcher_text"),
    )


__all__ = [
    "TransactionImportBatch",
    "ImportFile",
    "ImportErrorRecord",
    "ImportRow",
    "ImportRule",
]


TransactionImportBatch.model_rebuild()
ImportFile.model_rebuild()
ImportErrorRecord.model_rebuild()
ImportRow.model_rebuild()
ImportRule.model_rebuild()
