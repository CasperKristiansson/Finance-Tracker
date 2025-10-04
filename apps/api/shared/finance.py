"""Finance-related constants and helpers."""

from __future__ import annotations

from decimal import Decimal

from .enums import CategoryType


BASE_CURRENCY = "SEK"
DECIMAL_PLACES = Decimal("0.01")


class SignConventionError(ValueError):
    """Raised when amounts violate prescribed sign conventions."""


def coerce_decimal(value: float | int | Decimal) -> Decimal:
    """Convert numeric values to ``Decimal`` for precise arithmetic."""

    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def validate_category_amount(category: CategoryType, amount: float | int | Decimal) -> Decimal:
    """Ensure amount signs align with category expectations.

    ``CategoryType.INCOME`` requires non-negative amounts, while
    ``CategoryType.EXPENSE`` expects non-positive amounts. Other
    categories (adjustment, loan, interest) are exempt and may carry
    either sign depending on business logic.
    """

    dec_amount = coerce_decimal(amount)
    if category is CategoryType.INCOME and dec_amount < 0:
        raise SignConventionError("Income amounts must be zero or positive")
    if category is CategoryType.EXPENSE and dec_amount > 0:
        raise SignConventionError("Expense amounts must be zero or negative")
    return dec_amount


__all__ = [
    "BASE_CURRENCY",
    "DECIMAL_PLACES",
    "SignConventionError",
    "coerce_decimal",
    "validate_category_amount",
]
