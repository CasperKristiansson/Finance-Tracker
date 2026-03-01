from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from uuid import UUID, uuid4

import pytest

from apps.api.shared.enums import TransactionType
from apps.api.shared.validation import ensure_balanced_legs, validate_transaction_legs


@dataclass
class _Leg:
    account_id: UUID | None
    amount: Decimal | int | float


@dataclass
class _Carrier:
    value: Decimal


def test_ensure_balanced_legs_accepts_numbers_and_amount_attributes() -> None:
    ensure_balanced_legs([Decimal("10.00"), Decimal("-10.00")])
    ensure_balanced_legs([_Leg(account_id=uuid4(), amount=5), _Leg(account_id=uuid4(), amount=-5)])


def test_ensure_balanced_legs_supports_accessor() -> None:
    ensure_balanced_legs(
        [_Carrier(value=Decimal("2.50")), _Carrier(value=Decimal("-2.50"))],
        accessor=lambda carrier: carrier.value,
    )


def test_ensure_balanced_legs_raises_on_missing_amount_source() -> None:
    with pytest.raises(TypeError, match="no accessor"):
        ensure_balanced_legs([object()])


def test_ensure_balanced_legs_raises_on_imbalance() -> None:
    with pytest.raises(ValueError, match="imbalanced"):
        ensure_balanced_legs([Decimal("10.00"), Decimal("-9.80")], tolerance=Decimal("0.01"))


def test_validate_transaction_legs_requires_at_least_two_legs() -> None:
    with pytest.raises(ValueError, match="at least two legs"):
        validate_transaction_legs(TransactionType.EXPENSE, [_Leg(account_id=uuid4(), amount=1)])


def test_validate_transaction_legs_requires_account_reference() -> None:
    legs = [_Leg(account_id=None, amount=1), _Leg(account_id=uuid4(), amount=-1)]
    with pytest.raises(ValueError, match="account reference"):
        validate_transaction_legs(TransactionType.EXPENSE, legs)


def test_validate_transaction_legs_requires_non_zero_amount() -> None:
    legs = [_Leg(account_id=uuid4(), amount=0), _Leg(account_id=uuid4(), amount=1)]
    with pytest.raises(ValueError, match="non-zero amount"):
        validate_transaction_legs(TransactionType.EXPENSE, legs)


def test_validate_transaction_legs_requires_positive_and_negative() -> None:
    legs = [_Leg(account_id=uuid4(), amount=1), _Leg(account_id=uuid4(), amount=2)]
    with pytest.raises(ValueError, match="positive and negative"):
        validate_transaction_legs(TransactionType.EXPENSE, legs)


def test_validate_transaction_legs_checks_balance() -> None:
    legs = [_Leg(account_id=uuid4(), amount=10), _Leg(account_id=uuid4(), amount=-9)]
    with pytest.raises(ValueError, match="imbalanced"):
        validate_transaction_legs(TransactionType.EXPENSE, legs)


def test_validate_transaction_legs_requires_distinct_accounts_for_transfer() -> None:
    account_id = uuid4()
    legs = [_Leg(account_id=account_id, amount=5), _Leg(account_id=account_id, amount=-5)]
    with pytest.raises(ValueError, match="distinct accounts"):
        validate_transaction_legs(TransactionType.TRANSFER, legs)


def test_validate_transaction_legs_accepts_valid_transfer() -> None:
    legs = [_Leg(account_id=uuid4(), amount=20), _Leg(account_id=uuid4(), amount=-20)]
    validate_transaction_legs(TransactionType.TRANSFER, legs)


def test_validate_transaction_legs_accepts_balanced_multi_leg_entry() -> None:
    legs = [
        _Leg(account_id=uuid4(), amount=20),
        _Leg(account_id=uuid4(), amount=-5),
        _Leg(account_id=uuid4(), amount=-15),
    ]
    validate_transaction_legs(TransactionType.EXPENSE, legs)


def test_validate_transaction_legs_negative_branch_with_following_legs() -> None:
    legs = [
        _Leg(account_id=uuid4(), amount=-8),
        _Leg(account_id=uuid4(), amount=5),
        _Leg(account_id=uuid4(), amount=3),
    ]
    validate_transaction_legs(TransactionType.EXPENSE, legs)
