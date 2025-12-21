"""Service layer for loan operations."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import List, Optional, cast
from uuid import UUID

from sqlmodel import Session

from ..models import Loan, LoanEvent
from ..repositories.account import AccountRepository
from ..repositories.loan import LoanRepository
from ..repositories.transaction import TransactionRepository
from ..schemas.loan import LoanPortfolioSeriesPoint, LoanScheduleEntry
from ..shared import AccountType, InterestCompound, LoanEventType

_CENT = Decimal("0.01")


class LoanService:
    """Coordinates loan persistence and derived calculations."""

    def __init__(self, session: Session):
        self.session = session
        self.account_repository = AccountRepository(session)
        self.loan_repository = LoanRepository(session)
        self.transaction_repository = TransactionRepository(session)

    def attach_loan(self, account_id: UUID, loan_kwargs: dict[str, object]) -> Loan:
        account = self.account_repository.get(account_id, with_relationships=True)
        if account is None:
            raise LookupError("Account not found")
        if account.account_type != AccountType.DEBT:
            raise ValueError("Loans can only be attached to debt accounts")
        if account.loan is not None:
            raise ValueError("Account already has a linked loan")

        loan = Loan(account_id=account_id, **loan_kwargs)
        return self.loan_repository.create(loan)

    def get_loan(self, account_id: UUID) -> Loan:
        loan = self.loan_repository.get_by_account_id(account_id, with_account=True)
        if loan is None:
            raise LookupError("Loan not found")
        return loan

    def update_loan(self, account_id: UUID, fields: dict[str, object]) -> Loan:
        loan = self.get_loan(account_id)
        updated = self.loan_repository.update_fields(
            loan,
            origin_principal=cast(Optional[Decimal], fields.get("origin_principal")),
            current_principal=cast(Optional[Decimal], fields.get("current_principal")),
            interest_rate_annual=cast(Optional[Decimal], fields.get("interest_rate_annual")),
            interest_compound=cast(Optional[InterestCompound], fields.get("interest_compound")),
            minimum_payment=cast(Optional[Decimal], fields.get("minimum_payment")),
            expected_maturity_date=cast(Optional[date], fields.get("expected_maturity_date")),
        )
        return updated

    def list_events(
        self,
        account_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> List[LoanEvent]:
        loan = self.get_loan(account_id)
        return self.loan_repository.list_events(loan.id, limit=limit, offset=offset)

    def portfolio_series(
        self,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[LoanPortfolioSeriesPoint]:
        events = self.loan_repository.list_all_events(
            start_date=start_date,
            end_date=end_date,
        )
        if not events:
            return []

        running_total = Decimal("0")
        daily_delta = Decimal("0")
        current_date: Optional[date] = None
        series: List[LoanPortfolioSeriesPoint] = []

        for event in events:
            event_date = event.occurred_at.date()
            if current_date is None:
                current_date = event_date
            elif event_date != current_date:
                running_total += daily_delta
                series.append(
                    LoanPortfolioSeriesPoint(
                        date=current_date.isoformat(),
                        total=running_total,
                    )
                )
                current_date = event_date
                daily_delta = Decimal("0")

            daily_delta += self._event_delta(event)

        if current_date is not None:
            running_total += daily_delta
            series.append(
                LoanPortfolioSeriesPoint(
                    date=current_date.isoformat(),
                    total=running_total,
                )
            )

        return series

    def generate_schedule(
        self,
        account_id: UUID,
        *,
        as_of_date: Optional[date] = None,
        periods: int = 60,
    ) -> List[LoanScheduleEntry]:
        loan = self.get_loan(account_id)
        if loan.current_principal <= Decimal("0"):
            return []

        start_date = as_of_date or datetime.now(timezone.utc).date()
        monthly_rate = self._monthly_rate(loan)
        payment_amount = self._determine_payment(loan, monthly_rate, periods)

        principal = loan.current_principal
        schedule: List[LoanScheduleEntry] = []
        for period in range(1, periods + 1):
            if principal <= Decimal("0"):
                break

            interest = (principal * monthly_rate).quantize(_CENT, rounding=ROUND_HALF_UP)
            principal_component = max(payment_amount - interest, Decimal("0"))

            if principal_component >= principal:
                principal_component = principal
                payment_total = (interest + principal_component).quantize(
                    _CENT, rounding=ROUND_HALF_UP
                )
                remaining = Decimal("0")
            else:
                payment_total = payment_amount
                remaining = (principal - principal_component).quantize(
                    _CENT, rounding=ROUND_HALF_UP
                )

            schedule.append(
                LoanScheduleEntry(
                    period=period,
                    due_date=self._add_months(start_date, period),
                    payment_amount=payment_total,
                    interest_amount=interest,
                    principal_amount=principal_component,
                    remaining_principal=remaining,
                )
            )

            principal = remaining

        return schedule

    def _monthly_rate(self, loan: Loan) -> Decimal:
        rate = loan.interest_rate_annual or Decimal("0")
        if rate <= Decimal("0"):
            return Decimal("0")
        if loan.interest_compound == InterestCompound.MONTHLY:
            periods = Decimal("12")
        elif loan.interest_compound == InterestCompound.DAILY:
            periods = Decimal("12")  # approximate daily accrual into monthly view
        else:  # yearly
            periods = Decimal("12")
        return (rate / periods).quantize(Decimal("0.0000001"))

    def _determine_payment(
        self,
        loan: Loan,
        monthly_rate: Decimal,
        suggested_periods: int,
    ) -> Decimal:
        if loan.minimum_payment and loan.minimum_payment > Decimal("0"):
            return loan.minimum_payment.quantize(_CENT, rounding=ROUND_HALF_UP)

        periods = suggested_periods if suggested_periods > 0 else 1
        if loan.expected_maturity_date and loan.expected_maturity_date > date.today():
            periods = max(1, self._months_between(date.today(), loan.expected_maturity_date))

        if monthly_rate == Decimal("0"):
            payment = loan.current_principal / Decimal(periods)
        else:
            numerator = loan.current_principal * monthly_rate * (1 + monthly_rate) ** periods
            denominator = (1 + monthly_rate) ** periods - Decimal("1")
            payment = numerator / denominator if denominator != 0 else loan.current_principal

        return payment.quantize(_CENT, rounding=ROUND_HALF_UP)

    def _event_delta(self, event: LoanEvent) -> Decimal:
        if event.event_type in {
            LoanEventType.DISBURSEMENT,
            LoanEventType.INTEREST_ACCRUAL,
            LoanEventType.FEE,
        }:
            return event.amount
        if event.event_type in {
            LoanEventType.PAYMENT_PRINCIPAL,
            LoanEventType.PAYMENT_INTEREST,
        }:
            return -event.amount
        return Decimal("0")

    def _add_months(self, start: date, months: int) -> date:
        year = start.year + (start.month - 1 + months) // 12
        month = (start.month - 1 + months) % 12 + 1
        day = min(start.day, self._days_in_month(year, month))
        return date(year, month, day)

    def _days_in_month(self, year: int, month: int) -> int:
        if month == 12:
            next_month = date(year + 1, 1, 1)
        else:
            next_month = date(year, month + 1, 1)
        return (next_month - date(year, month, 1)).days

    def _months_between(self, start: date, end: date) -> int:
        return max(0, (end.year - start.year) * 12 + (end.month - start.month))


__all__ = ["LoanService"]
