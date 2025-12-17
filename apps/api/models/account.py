# pyright: reportGeneralTypeIssues=false
"""Account and loan related models."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List, Optional
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import Enum as SAEnum
from sqlmodel import Field, Relationship, SQLModel

from ..shared import (
    AccountType,
    InterestCompound,
    TimestampMixin,
    UserOwnedMixin,
    UUIDPrimaryKeyMixin,
)

if TYPE_CHECKING:  # pragma: no cover
    from .transaction import LoanEvent, TransactionLeg


class Account(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Represents a user-visible account (normal, debt, or investment)."""

    __tablename__ = "accounts"

    name: str = Field(default="", sa_column=Column(String(120), nullable=False, server_default=""))
    icon: str | None = Field(default=None, sa_column=Column(String(255), nullable=True))
    bank_import_type: str | None = Field(
        default=None,
        sa_column=Column(String(64), nullable=True),
    )
    account_type: AccountType = Field(sa_column=Column(SAEnum(AccountType), nullable=False))
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default="true"),
    )

    if TYPE_CHECKING:  # pragma: no cover
        balance_snapshots: List["BalanceSnapshot"]
        transaction_legs: List["TransactionLeg"]
        loan: Optional["Loan"]

    loan: Optional["Loan"] = Relationship(
        sa_relationship=relationship("Loan", back_populates="account", uselist=False)
    )
    transaction_legs: List["TransactionLeg"] = Relationship(
        sa_relationship=relationship("TransactionLeg", back_populates="account"),
    )


class Loan(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Metadata for debt accounts including interest configuration."""

    __tablename__ = "loans"

    account_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        )
    )
    origin_principal: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))
    current_principal: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))
    interest_rate_annual: Decimal = Field(sa_column=Column(Numeric(6, 4), nullable=False))
    interest_compound: InterestCompound = Field(
        sa_column=Column(SAEnum(InterestCompound), nullable=False)
    )
    minimum_payment: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(18, 2)),
    )
    expected_maturity_date: Optional[date] = Field(
        default=None,
        sa_column=Column(Date()),
    )

    if TYPE_CHECKING:  # pragma: no cover
        rate_changes: List["LoanRateChange"]
        loan_events: List["LoanEvent"]
        account: Account

    account: Account = Relationship(sa_relationship=relationship("Account", back_populates="loan"))
    loan_events: List["LoanEvent"] = Relationship(
        sa_relationship=relationship(
            "LoanEvent",
            back_populates="loan",
            cascade="all, delete-orphan",
        )
    )


class LoanRateChange(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Future-dated interest rate changes for loans."""

    __tablename__ = "loan_rate_changes"

    loan_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("loans.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    effective_date: date = Field(sa_column=Column(Date(), nullable=False))
    new_rate: Decimal = Field(sa_column=Column(Numeric(6, 4), nullable=False))

    if TYPE_CHECKING:  # pragma: no cover
        loan: Loan


class BalanceSnapshot(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Stores cached balances for an account at a specific moment."""

    __tablename__ = "balance_snapshots"

    account_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    captured_at: datetime = Field(sa_column=Column(DateTime(timezone=True), nullable=False))
    balance: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))

    if TYPE_CHECKING:  # pragma: no cover
        account: Account

    __table_args__ = (UniqueConstraint("account_id", "captured_at", name="uq_balance_snapshot"),)


__all__ = [
    "Account",
    "Loan",
    "LoanRateChange",
    "BalanceSnapshot",
]


Account.model_rebuild()
Loan.model_rebuild()
LoanRateChange.model_rebuild()
BalanceSnapshot.model_rebuild()
