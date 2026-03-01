from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID

from apps.api.models import Loan
from apps.api.services.loan import LoanService
from apps.api.shared import InterestCompound, LoanEventType

# mypy: ignore-errors


def _loan(
    *,
    current_principal: str = "1000",
    annual_rate: str = "0.1200",
    compound: InterestCompound = InterestCompound.MONTHLY,
    minimum_payment: str | None = None,
    expected_maturity: date | None = None,
) -> Loan:
    return Loan(
        account_id=UUID(int=1),
        origin_principal=Decimal(current_principal),
        current_principal=Decimal(current_principal),
        interest_rate_annual=Decimal(annual_rate),
        interest_compound=compound,
        minimum_payment=Decimal(minimum_payment) if minimum_payment is not None else None,
        expected_maturity_date=expected_maturity,
    )


def test_portfolio_series_empty_and_grouped_branches(session) -> None:
    service = LoanService(session)

    service.loan_repository = SimpleNamespace(  # type: ignore[assignment]
        list_all_events=lambda **_kwargs: []
    )
    assert service.portfolio_series() == []

    events = [
        SimpleNamespace(
            occurred_at=datetime(2024, 1, 1, 10, tzinfo=timezone.utc),
            event_type=LoanEventType.DISBURSEMENT,
            amount=Decimal("100"),
        ),
        SimpleNamespace(
            occurred_at=datetime(2024, 1, 1, 12, tzinfo=timezone.utc),
            event_type=LoanEventType.FEE,
            amount=Decimal("10"),
        ),
        SimpleNamespace(
            occurred_at=datetime(2024, 1, 2, 9, tzinfo=timezone.utc),
            event_type=LoanEventType.PAYMENT_PRINCIPAL,
            amount=Decimal("25"),
        ),
    ]
    service.loan_repository = SimpleNamespace(  # type: ignore[assignment]
        list_all_events=lambda **_kwargs: events
    )
    series = service.portfolio_series()
    assert [point.model_dump() for point in series] == [
        {"date": "2024-01-01", "total": Decimal("110")},
        {"date": "2024-01-02", "total": Decimal("85")},
    ]


def test_generate_schedule_branches_and_helpers(session) -> None:
    service = LoanService(session)

    service.get_loan = lambda _account_id: _loan(current_principal="0")  # type: ignore[assignment]
    assert service.generate_schedule(UUID(int=1), periods=12) == []

    loan = _loan(current_principal="1000", annual_rate="0.1200", minimum_payment="300")
    service.get_loan = lambda _account_id: loan  # type: ignore[assignment]
    schedule = service.generate_schedule(UUID(int=1), as_of_date=date(2024, 1, 31), periods=12)
    assert schedule
    assert schedule[0].due_date == date(2024, 2, 29)  # day-clamp branch in _add_months
    assert schedule[-1].remaining_principal == Decimal("0")

    assert service._monthly_rate(
        _loan(annual_rate="0", compound=InterestCompound.MONTHLY)
    ) == Decimal("0")
    assert service._monthly_rate(_loan(compound=InterestCompound.DAILY)) > Decimal("0")
    assert service._monthly_rate(_loan(compound=InterestCompound.YEARLY)) > Decimal("0")

    maturity_loan = _loan(
        current_principal="1200",
        annual_rate="0.0",
        minimum_payment=None,
        expected_maturity=date.today().replace(year=date.today().year + 1),
    )
    payment = service._determine_payment(maturity_loan, Decimal("0"), suggested_periods=0)
    assert payment > Decimal("0")
    fallback_payment = service._determine_payment(
        _loan(current_principal="500", annual_rate="0.0"),
        Decimal("-2"),
        suggested_periods=2,
    )
    assert fallback_payment == Decimal("500.00")

    assert service._event_delta(
        SimpleNamespace(event_type=LoanEventType.PAYMENT_INTEREST, amount=Decimal("5"))
    ) == Decimal("-5")
    assert service._event_delta(
        SimpleNamespace(event_type="unknown", amount=Decimal("5"))
    ) == Decimal("0")
    assert service._days_in_month(2024, 2) == 29
    assert service._days_in_month(2024, 12) == 31
    assert service._months_between(date(2024, 1, 1), date(2024, 1, 1)) == 0


def test_portfolio_series_truthy_iterable_without_events(session) -> None:
    service = LoanService(session)

    class _TruthyEmpty:
        def __bool__(self):
            return True

        def __iter__(self):
            return iter(())

    service.loan_repository = SimpleNamespace(  # type: ignore[assignment]
        list_all_events=lambda **_kwargs: _TruthyEmpty()
    )
    assert service.portfolio_series() == []
