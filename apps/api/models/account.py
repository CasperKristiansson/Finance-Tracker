"""Account and loan related models."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.types import Enum as SAEnum
from sqlmodel import Field, Relationship, SQLModel

from ..shared import (
    AccountType,
    InterestCompound,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)


class Account(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """Represents a user-visible account (normal, debt, or investment)."""

    __tablename__ = "accounts"

    display_order: Optional[int] = Field(default=None)
    account_type: AccountType = Field(
        sa_column=Column(SAEnum(AccountType), nullable=False)
    )
    is_active: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default="true"),
    )

    loan: Optional["Loan"] = Relationship(back_populates="account")
    balance_snapshots: List["BalanceSnapshot"] = Relationship(back_populates="account")


class Loan(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
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
    origin_principal: Decimal = Field(
        sa_column=Column(Numeric(18, 2), nullable=False)
    )
    current_principal: Decimal = Field(
        sa_column=Column(Numeric(18, 2), nullable=False)
    )
    interest_rate_annual: Decimal = Field(
        sa_column=Column(Numeric(6, 4), nullable=False)
    )
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

    account: Account = Relationship(back_populates="loan")
    rate_changes: List["LoanRateChange"] = Relationship(back_populates="loan")


class LoanRateChange(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
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

    loan: Loan = Relationship(back_populates="rate_changes")


class BalanceSnapshot(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """Stores cached balances for an account at a specific moment."""

    __tablename__ = "balance_snapshots"

    account_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    captured_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False)
    )
    balance: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))

    account: Account = Relationship(back_populates="balance_snapshots")

    __table_args__ = (
        UniqueConstraint("account_id", "captured_at", name="uq_balance_snapshot"),
    )


__all__ = [
    "Account",
    "Loan",
    "LoanRateChange",
    "BalanceSnapshot",
]
