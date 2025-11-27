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


class TransactionStatus(StrEnum):
    RECORDED = "recorded"
    IMPORTED = "imported"
    REVIEWED = "reviewed"
    FLAGGED = "flagged"


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


class BudgetPeriod(StrEnum):
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


__all__ = [
    "StrEnum",
    "CreatedSource",
    "AccountType",
    "CategoryType",
    "TransactionType",
    "SystemAccountCode",
    "InterestCompound",
    "LoanEventType",
    "BudgetPeriod",
]
