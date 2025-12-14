"""Enumeration definitions for Finance Tracker domain concepts."""

from __future__ import annotations

from enum import Enum


class StrEnum(str, Enum):
    """Enum subclass that serializes as its string value."""

    def __str__(self) -> str:  # pragma: no cover - trivial
        return str(self.value)


class CreatedSource(StrEnum):
    """Identifies how a record was created."""

    MANUAL = "manual"
    IMPORT = "import"
    SYSTEM = "system"


class AccountType(StrEnum):
    NORMAL = "normal"
    DEBT = "debt"
    INVESTMENT = "investment"


class CategoryType(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"
    ADJUSTMENT = "adjustment"
    LOAN = "loan"
    INTEREST = "interest"


class TransactionType(StrEnum):
    INCOME = "income"
    EXPENSE = "expense"
    TRANSFER = "transfer"
    ADJUSTMENT = "adjustment"
    INVESTMENT_EVENT = "investment_event"


class SystemAccountCode(StrEnum):
    RETAINED_EARNINGS = "retained_earnings"
    INTEREST_EXPENSE = "interest_expense"
    UNASSIGNED = "unassigned"


class InterestCompound(StrEnum):
    DAILY = "daily"
    MONTHLY = "monthly"
    YEARLY = "yearly"


class LoanEventType(StrEnum):
    DISBURSEMENT = "disbursement"
    PAYMENT_PRINCIPAL = "payment_principal"
    PAYMENT_INTEREST = "payment_interest"
    INTEREST_ACCRUAL = "interest_accrual"
    FEE = "fee"


class TaxEventType(StrEnum):
    PAYMENT = "payment"
    REFUND = "refund"


class BudgetPeriod(StrEnum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class BankImportType(StrEnum):
    CIRCLE_K_MASTERCARD = "circle_k_mastercard"
    SEB = "seb"
    SWEDBANK = "swedbank"


class ThemePreference(StrEnum):
    """UI theme preference scoped per user."""

    LIGHT = "light"
    DARK = "dark"
    SYSTEM = "system"


__all__ = [
    "StrEnum",
    "CreatedSource",
    "AccountType",
    "CategoryType",
    "TransactionType",
    "SystemAccountCode",
    "InterestCompound",
    "LoanEventType",
    "TaxEventType",
    "BudgetPeriod",
    "BankImportType",
    "ThemePreference",
]
