"""Transaction-related models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.types import Enum as SAEnum
from sqlmodel import Field, Relationship, SQLModel

from ..shared import (
    AuditSourceMixin,
    LoanEventType,
    TimestampMixin,
    TransactionType,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:  # pragma: no cover
    from .account import Account, Loan
    from .category import Category


class TransactionImportBatch(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
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

    transactions: List["Transaction"] = Relationship(back_populates="import_batch")


class Transaction(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    AuditSourceMixin,
    SQLModel,
    table=True,
):
    """Transaction envelope capturing shared metadata."""

    __tablename__ = "transactions"

    category_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("categories.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    transaction_type: TransactionType = Field(
        sa_column=Column(SAEnum(TransactionType), nullable=False)
    )
    description: Optional[str] = Field(
        default=None,
        sa_column=Column(String(250), nullable=True),
    )
    notes: Optional[str] = Field(
        default=None,
        sa_column=Column(String, nullable=True),
    )
    external_id: Optional[str] = Field(
        default=None,
        sa_column=Column(String(180), unique=True, nullable=True),
    )
    occurred_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    posted_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    import_batch_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("transaction_import_batches.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    category: Optional["Category"] = Relationship(back_populates="transactions")
    legs: List["TransactionLeg"] = Relationship(back_populates="transaction")
    loan_events: List["LoanEvent"] = Relationship(back_populates="transaction")
    import_batch: Optional["TransactionImportBatch"] = Relationship(
        back_populates="transactions"
    )

    __table_args__ = (
        UniqueConstraint("occurred_at", "description", "external_id", name="uq_transaction_identity"),
    )


class TransactionLeg(UUIDPrimaryKeyMixin, SQLModel, table=True):
    """Individual account impact for a transaction."""

    __tablename__ = "transaction_legs"

    transaction_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("transactions.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    account_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    amount: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))
    running_balance: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(18, 2), nullable=True),
    )

    transaction: Transaction = Relationship(back_populates="legs")
    account: "Account" = Relationship(back_populates="transaction_legs")
    loan_event: Optional["LoanEvent"] = Relationship(back_populates="transaction_leg")


class LoanEvent(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """Denormalized record of loan-related activity."""

    __tablename__ = "loan_events"

    loan_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("loans.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    transaction_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("transactions.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    transaction_leg_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("transaction_legs.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    event_type: LoanEventType = Field(
        sa_column=Column(SAEnum(LoanEventType), nullable=False)
    )
    amount: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))
    occurred_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )

    transaction: Transaction = Relationship(back_populates="loan_events")
    loan: "Loan" = Relationship(back_populates="loan_events")
    transaction_leg: Optional["TransactionLeg"] = Relationship(
        back_populates="loan_event"
    )


__all__ = [
    "Transaction",
    "TransactionLeg",
    "LoanEvent",
    "TransactionImportBatch",
]
