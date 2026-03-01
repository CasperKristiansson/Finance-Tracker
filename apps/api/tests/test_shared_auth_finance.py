from __future__ import annotations

from decimal import Decimal

import pytest

from apps.api.shared.auth import INTEGRATION_USER_ID_ENV, get_default_user_id
from apps.api.shared.enums import CategoryType
from apps.api.shared.finance import SignConventionError, coerce_decimal, validate_category_amount


def test_get_default_user_id_uses_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(INTEGRATION_USER_ID_ENV, raising=False)
    assert get_default_user_id() == "integration-user"


def test_get_default_user_id_uses_env_override(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(INTEGRATION_USER_ID_ENV, "custom-user")
    assert get_default_user_id() == "custom-user"


def test_coerce_decimal_converts_numeric_inputs() -> None:
    existing = Decimal("4.20")
    assert coerce_decimal(existing) is existing
    assert coerce_decimal(5) == Decimal("5")
    assert coerce_decimal(1.25) == Decimal("1.25")


def test_validate_category_amount_accepts_expected_signs() -> None:
    assert validate_category_amount(CategoryType.INCOME, 100) == Decimal("100")
    assert validate_category_amount(CategoryType.EXPENSE, -10) == Decimal("-10")
    assert validate_category_amount(CategoryType.LOAN, 10) == Decimal("10")
    assert validate_category_amount(CategoryType.INTEREST, -3) == Decimal("-3")


def test_validate_category_amount_rejects_invalid_signs() -> None:
    with pytest.raises(SignConventionError, match="Income amounts"):
        validate_category_amount(CategoryType.INCOME, -1)

    with pytest.raises(SignConventionError, match="Expense amounts"):
        validate_category_amount(CategoryType.EXPENSE, 1)
