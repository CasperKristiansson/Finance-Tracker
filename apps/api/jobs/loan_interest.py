"""Background job helpers for loan interest accrual postings."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Iterable, List, Optional
from uuid import UUID

from sqlmodel import Session, select

from ..models import Loan, Transaction, TransactionLeg
from ..services import TransactionService
from ..shared import CreatedSource, InterestCompound, TransactionType, coerce_decimal

_DECIMAL_CENT = Decimal("0.01")


def accrue_interest(
    session: Session,
    *,
    as_of: date,
    interest_category_id: UUID,
    expense_account_id: UUID,
    loan_ids: Optional[Iterable[UUID]] = None,
) -> List[Transaction]:
    """Accrue interest for the supplied loans and post balancing entries."""

    statement = select(Loan)
    if loan_ids:
        statement = statement.where(Loan.id.in_(list(loan_ids)))  # type: ignore[arg-type]

    loans = session.exec(statement).all()
    if not loans:
        return []

    posting_ts = datetime.combine(as_of, time.min, tzinfo=timezone.utc)
    service = TransactionService(session)
    created_transactions: List[Transaction] = []

    for loan in loans:
        interest_amount = _calculate_period_interest(loan)
        if interest_amount <= Decimal("0"):
            continue

        transaction = Transaction(
            category_id=interest_category_id,
            transaction_type=TransactionType.EXPENSE,
            description=f"Interest accrual for loan {loan.id} ({as_of.isoformat()})",
            occurred_at=posting_ts,
            posted_at=posting_ts,
            created_source=CreatedSource.SYSTEM,
        )
        legs = [
            TransactionLeg(account_id=loan.account_id, amount=interest_amount),
            TransactionLeg(account_id=expense_account_id, amount=-interest_amount),
        ]

        persisted = service.create_transaction(transaction, legs)
        loan.current_principal = (coerce_decimal(loan.current_principal) + interest_amount).quantize(
            _DECIMAL_CENT,
            rounding=ROUND_HALF_UP,
        )
        session.add(loan)
        created_transactions.append(persisted)

    session.commit()
    return created_transactions


def _calculate_period_interest(loan: Loan) -> Decimal:
    principal = coerce_decimal(loan.current_principal)
    if principal <= Decimal("0"):
        return Decimal("0")

    rate = coerce_decimal(loan.interest_rate_annual or Decimal("0"))
    if rate <= Decimal("0"):
        return Decimal("0")

    periods_per_year = {
        InterestCompound.DAILY: Decimal("365"),
        InterestCompound.MONTHLY: Decimal("12"),
        InterestCompound.YEARLY: Decimal("1"),
    }[loan.interest_compound]

    period_rate = rate / periods_per_year
    interest = (principal * period_rate).quantize(_DECIMAL_CENT, rounding=ROUND_HALF_UP)
    return interest


__all__ = ["accrue_interest"]
