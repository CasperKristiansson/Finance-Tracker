"""Pydantic schemas for account API endpoints."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..shared import AccountType, BankImportType, InterestCompound


class LoanCreate(BaseModel):
    """Loan details supplied when creating a debt account."""

    origin_principal: Decimal = Field(ge=Decimal("0"))
    current_principal: Decimal = Field(ge=Decimal("0"))
    interest_rate_annual: Decimal = Field(ge=Decimal("0"))
    interest_compound: InterestCompound
    minimum_payment: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    expected_maturity_date: Optional[date] = None


class LoanRead(BaseModel):
    """Loan details returned in account responses."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    account_id: UUID
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

    name: Optional[str] = None
    account_type: AccountType
    is_active: bool = True
    icon: Optional[str] = None
    bank_import_type: Optional[BankImportType] = None
    loan: Optional[LoanCreate] = None

    @model_validator(mode="after")
    def validate_loan(self) -> "AccountCreate":
        if self.account_type == AccountType.DEBT and self.loan is None:
            raise ValueError("Loan details are required for debt accounts")
        if self.account_type != AccountType.DEBT and self.loan is not None:
            raise ValueError("Loan details are only allowed for debt accounts")
        return self

    @model_validator(mode="after")
    def validate_name(self) -> "AccountCreate":
        if not self.name or not str(self.name).strip():
            self.name = "Account"
        else:
            self.name = str(self.name).strip()
        return self


class AccountUpdate(BaseModel):
    """Request payload for updating account metadata."""

    name: Optional[str] = None
    is_active: Optional[bool] = None
    icon: Optional[str] = None
    bank_import_type: Optional[BankImportType] = None

    @model_validator(mode="after")
    def ensure_fields_present(self) -> "AccountUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided for update")
        if "name" in self.model_fields_set and self.name is not None:
            if not self.name.strip():
                raise ValueError("Account name cannot be empty")
            self.name = self.name.strip()
        return self


class AccountRead(BaseModel):
    """Base response model for account data."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    account_type: AccountType
    is_active: bool
    icon: Optional[str] = None
    bank_import_type: Optional[BankImportType] = None
    created_at: datetime
    updated_at: datetime
    loan: Optional[LoanRead] = None


class AccountWithBalance(AccountRead):
    """Account response extended with current balance information."""

    balance: Decimal
    last_reconciled_at: Optional[datetime] = None
    reconciliation_gap: Optional[Decimal] = None
    needs_reconciliation: Optional[bool] = None


class ReconcileAccountRequest(BaseModel):
    """Request body for reconciling an account balance."""

    captured_at: datetime
    reported_balance: Decimal
    description: Optional[str] = None
    category_id: Optional[UUID] = None


class ReconcileAccountResponse(BaseModel):
    """Response for a reconciliation operation."""

    account_id: UUID
    reported_balance: Decimal
    ledger_balance: Decimal
    delta_posted: Decimal
    snapshot_id: UUID
    transaction_id: Optional[UUID] = None
    captured_at: datetime


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
    "ReconcileAccountRequest",
    "ReconcileAccountResponse",
]
