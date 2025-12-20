from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from apps.api.repositories.reporting import TransactionAmountRow
from apps.api.services.reporting import ReportingService
from apps.api.shared import TransactionType


def _return_row(amount: str = "25.00") -> TransactionAmountRow:
    value = Decimal(amount)
    return TransactionAmountRow(
        id=uuid4(),
        occurred_at=datetime.now(timezone.utc),
        transaction_type=TransactionType.RETURN,
        description="Returned purchase",
        notes=None,
        category_id=None,
        category_name=None,
        category_icon=None,
        category_color_hex=None,
        subscription_id=None,
        amount=value,
        inflow=value,
        outflow=Decimal("0"),
    )


def test_classify_return_zeroes_out_income_and_expense_for_account_scope() -> None:
    income, expense = ReportingService._classify_income_expense(  # pylint: disable=protected-access
        _return_row(), account_scoped=True
    )

    assert income == Decimal("0")
    assert expense == Decimal("0")


def test_classify_return_zeroes_out_income_and_expense_for_global_scope() -> None:
    income, expense = ReportingService._classify_income_expense(  # pylint: disable=protected-access
        _return_row(amount="-10.50"), account_scoped=False
    )

    assert income == Decimal("0")
    assert expense == Decimal("0")
