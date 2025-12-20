# pyright: reportGeneralTypeIssues=false
"""Validation helpers for shared finance logic."""

from __future__ import annotations

from decimal import Decimal
from typing import TYPE_CHECKING, Callable, Iterable, Protocol, Sequence, TypeVar, Union
from uuid import UUID

from .enums import TransactionType
from .finance import coerce_decimal

if TYPE_CHECKING:  # pragma: no cover
    from apps.api.models import TransactionLeg

Number = Union[int, float, Decimal]
T = TypeVar("T")


class SupportsAmount(Protocol):
    amount: Number


class SupportsTransactionLeg(Protocol):
    account_id: UUID | None
    amount: Number


def _to_decimal(value: Number) -> Decimal:
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def ensure_balanced_legs(
    legs: Iterable[Union[Number, SupportsAmount, T]],
    *,
    accessor: Callable[[T], Number] | None = None,
    tolerance: Decimal = Decimal("0.01"),
) -> None:
    """Raise if the provided leg amounts do not sum to ~0.

    Args:
        legs: Iterable of amounts or objects carrying an ``amount`` attribute.
        accessor: Optional callable to extract the numeric amount when ``legs``
            contains custom objects beyond ``SupportsAmount``.
        tolerance: Absolute tolerance used when comparing against zero.

    Raises:
        ValueError: If the net sum exceeds the permitted tolerance.
    """

    total = Decimal("0")
    for leg in legs:
        if isinstance(leg, (int, float, Decimal)):
            value = leg
        elif hasattr(leg, "amount"):
            value = leg.amount  # type: ignore[assignment]
        elif accessor is not None:
            value = accessor(leg)
        else:
            raise TypeError("Leg lacks an amount value and no accessor was provided")

        total += _to_decimal(value)

    if total.copy_abs() > tolerance:
        raise ValueError(f"Transaction legs are imbalanced by {total}")


def validate_transaction_legs(
    transaction_type: TransactionType,
    legs: Sequence[SupportsTransactionLeg | "TransactionLeg"],
) -> None:
    """Validate transactional legs for consistency and correctness.

    Ensures a transaction has at least two legs, each with non-zero amounts,
    a balanced total, and both positive and negative entries. Transfer
    transactions additionally require legs to reference at least two distinct
    accounts.
    """

    if len(legs) < 2:
        raise ValueError("Transactions require at least two legs")

    zero_amount = Decimal("0")
    has_positive = False
    has_negative = False
    unique_accounts: set[UUID] = set()
    amounts: list[Decimal] = []

    for leg in legs:
        if leg.account_id is None:
            raise ValueError("Transaction legs require an account reference")

        amount = coerce_decimal(leg.amount)
        if amount == zero_amount:
            raise ValueError("Transaction legs must carry a non-zero amount")

        amounts.append(amount)
        unique_accounts.add(leg.account_id)

        if amount > zero_amount:
            has_positive = True
        elif amount < zero_amount:
            has_negative = True

    if not (has_positive and has_negative):
        raise ValueError("Transactions must include positive and negative legs")

    ensure_balanced_legs(amounts)

    if transaction_type == TransactionType.TRANSFER and len(unique_accounts) < 2:
        raise ValueError("Transfers require at least two distinct accounts")


__all__ = ["ensure_balanced_legs", "validate_transaction_legs"]
