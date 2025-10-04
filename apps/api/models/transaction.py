# pyright: reportGeneralTypeIssues=false
"""Transaction-related models."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
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

    if TYPE_CHECKING:  # pragma: no cover
        transactions: List["Transaction"]


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
    occurred_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    posted_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    import_batch_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("transaction_import_batches.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    if TYPE_CHECKING:  # pragma: no cover
        category: Optional["Category"]
        legs: List["TransactionLeg"]
        loan_events: List["LoanEvent"]
        import_batch: Optional["TransactionImportBatch"]

    __table_args__ = (
        UniqueConstraint(
            "occurred_at", "description", "external_id", name="uq_transaction_identity"
        ),
    )

    legs: List["TransactionLeg"] = Relationship(
        back_populates="transaction",
        sa_relationship=relationship(
            "TransactionLeg",
            back_populates="transaction",
            cascade="all, delete-orphan",
        ),
    )
    loan_events: List["LoanEvent"] = Relationship(
        back_populates="transaction",
        sa_relationship=relationship(
            "LoanEvent",
            back_populates="transaction",
            cascade="all, delete-orphan",
        ),
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

    if TYPE_CHECKING:  # pragma: no cover
        transaction: Transaction
        account: "Account"
        loan_event: Optional["LoanEvent"]

    transaction: Transaction = Relationship(
        back_populates="legs",
        sa_relationship=relationship("Transaction", back_populates="legs"),
    )
    account: "Account" = Relationship(
        sa_relationship=relationship("Account", back_populates="transaction_legs"),
    )
    loan_event: Optional["LoanEvent"] = Relationship(
        sa_relationship=relationship("LoanEvent", back_populates="transaction_leg", uselist=False),
    )


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
    event_type: LoanEventType = Field(sa_column=Column(SAEnum(LoanEventType), nullable=False))
    amount: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))
    occurred_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))

    if TYPE_CHECKING:  # pragma: no cover
        transaction: Transaction
        loan: "Loan"
        transaction_leg: Optional["TransactionLeg"]

    loan: "Loan" = Relationship(
        back_populates="loan_events",
        sa_relationship=relationship("Loan", back_populates="loan_events"),
    )
    transaction: Transaction = Relationship(
        back_populates="loan_events",
        sa_relationship=relationship("Transaction", back_populates="loan_events"),
    )
    transaction_leg: Optional["TransactionLeg"] = Relationship(
        back_populates="loan_event",
        sa_relationship=relationship("TransactionLeg", back_populates="loan_event"),
    )


__all__ = [
    "Transaction",
    "TransactionLeg",
    "LoanEvent",
    "TransactionImportBatch",
]


Transaction.model_rebuild()
TransactionLeg.model_rebuild()
LoanEvent.model_rebuild()
TransactionImportBatch.model_rebuild()
