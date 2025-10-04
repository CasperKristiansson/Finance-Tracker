"""Pydantic schemas for account API endpoints."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..shared import AccountType, InterestCompound


class LoanCreate(BaseModel):
    """Loan details supplied when creating a debt account."""

    origin_principal: Decimal = Field(gt=Decimal("0"))
    current_principal: Decimal = Field(ge=Decimal("0"))
    interest_rate_annual: Decimal = Field(gt=Decimal("0"))
    interest_compound: InterestCompound
    minimum_payment: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    expected_maturity_date: Optional[date] = None


class LoanRead(BaseModel):
    """Loan details returned in account responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    origin_principal: Decimal
    current_principal: Decimal
    interest_rate_annual: Decimal
    interest_compound: InterestCompound
    minimum_payment: Optional[Decimal] = None
    expected_maturity_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime


class AccountCreate(BaseModel):
    """Request payload for creating accounts."""

    display_order: Optional[int] = None
    account_type: AccountType
    is_active: bool = True
    loan: Optional[LoanCreate] = None

    @model_validator(mode="after")
    def validate_loan(self) -> "AccountCreate":
        if self.account_type == AccountType.DEBT and self.loan is None:
            raise ValueError("Loan details are required for debt accounts")
        if self.account_type != AccountType.DEBT and self.loan is not None:
            raise ValueError("Loan details are only allowed for debt accounts")
        return self


class AccountUpdate(BaseModel):
    """Request payload for updating account metadata."""

    display_order: Optional[int] = None
    is_active: Optional[bool] = None

    @model_validator(mode="after")
    def ensure_fields_present(self) -> "AccountUpdate":
        if not any(value is not None for value in (self.display_order, self.is_active)):
            raise ValueError("At least one field must be provided for update")
        return self


class AccountRead(BaseModel):
    """Base response model for account data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    display_order: Optional[int] = None
    account_type: AccountType
    is_active: bool
    created_at: datetime
    updated_at: datetime
    loan: Optional[LoanRead] = None


class AccountWithBalance(AccountRead):
    """Account response extended with current balance information."""

    balance: Decimal


class ListAccountsQuery(BaseModel):
    """Query parameters accepted by the list accounts handler."""

    include_inactive: bool = Field(default=False, alias="include_inactive")
    as_of_date: Optional[datetime] = Field(default=None, alias="as_of_date")


class ListAccountsResponse(BaseModel):
    """Response payload for list accounts."""

    accounts: list[AccountWithBalance]


class UpdateAccountPath(BaseModel):
    """Path parameters for update account handler."""

    account_id: UUID


__all__ = [
    "LoanCreate",
    "LoanRead",
    "AccountCreate",
    "AccountUpdate",
    "AccountRead",
    "AccountWithBalance",
    "ListAccountsQuery",
    "ListAccountsResponse",
    "UpdateAccountPath",
]
