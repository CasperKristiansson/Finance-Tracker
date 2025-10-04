"""Validation helpers for shared finance logic."""

from __future__ import annotations

from decimal import Decimal
from typing import Callable, Iterable, Protocol, TypeVar, Union


Number = Union[int, float, Decimal]
T = TypeVar("T")


class SupportsAmount(Protocol):
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


__all__ = ["ensure_balanced_legs"]
