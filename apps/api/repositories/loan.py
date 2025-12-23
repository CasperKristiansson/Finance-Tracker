"""Repository helpers for loan entities."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, List, Optional, cast
from uuid import UUID

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..models import Account, Loan, LoanEvent
from ..shared import AccountType, InterestCompound


class LoanRepository:
    """Data access utilities for Loan and related aggregates."""

    def __init__(self, session: Session):
        self.session = session

    def get_by_account_id(
        self,
        account_id: UUID,
        *,
        with_account: bool = False,
    ) -> Optional[Loan]:
        statement = select(Loan).where(Loan.account_id == account_id)
        if with_account:
            statement = statement.options(selectinload(Loan.account))  # type: ignore[arg-type]
        result = self.session.exec(statement)
        return result.one_or_none()

    def create(self, loan: Loan) -> Loan:
        self.session.add(loan)
        self.session.commit()
        self.session.refresh(loan)
        return loan

    def update_fields(
        self,
        loan: Loan,
        *,
        origin_principal: Optional[Decimal] = None,
        current_principal: Optional[Decimal] = None,
        interest_rate_annual: Optional[Decimal] = None,
        interest_compound: Optional[InterestCompound] = None,
        minimum_payment: Optional[Decimal] = None,
        expected_maturity_date: Optional[date] = None,
    ) -> Loan:
        if origin_principal is not None:
            loan.origin_principal = origin_principal
        if current_principal is not None:
            loan.current_principal = current_principal
        if interest_rate_annual is not None:
            loan.interest_rate_annual = interest_rate_annual
        if interest_compound is not None:
            loan.interest_compound = interest_compound
        if minimum_payment is not None:
            loan.minimum_payment = minimum_payment
        if expected_maturity_date is not None:
            loan.expected_maturity_date = expected_maturity_date

        self.session.add(loan)
        self.session.commit()
        self.session.refresh(loan)
        return loan

    def list_events(
        self,
        loan_id: UUID,
        *,
        limit: int = 50,
        offset: int = 0,
    ) -> List[LoanEvent]:
        statement = (
            select(LoanEvent)
            .where(LoanEvent.loan_id == loan_id)
            .order_by(cast(Any, LoanEvent.occurred_at).desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.session.exec(statement).all())

    def list_all_events(
        self,
        *,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[LoanEvent]:
        statement = select(LoanEvent).order_by(cast(Any, LoanEvent.occurred_at).asc())
        if start_date:
            statement = statement.where(LoanEvent.occurred_at >= start_date)
        if end_date:
            statement = statement.where(LoanEvent.occurred_at <= end_date)
        return list(self.session.exec(statement).all())

    def validate_account_can_have_loan(self, account: Account) -> None:
        if account.account_type != AccountType.DEBT:
            raise ValueError("Loans can only be attached to debt accounts")
        existing = self.get_by_account_id(account.id)
        if existing is not None:
            raise ValueError("Account already has a linked loan")


__all__ = ["LoanRepository"]
