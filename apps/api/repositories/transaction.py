# pyright: reportGeneralTypeIssues=false
"""Repository helpers for transaction entities."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Iterable, List, Optional
from uuid import UUID

from sqlalchemy import desc
from sqlmodel import Session, select

from ..models import LoanEvent, Transaction, TransactionImportBatch, TransactionLeg
from ..shared import LoanEventType, coerce_decimal, ensure_balanced_legs


class TransactionRepository:
    """Handles persistence and retrieval of transactions."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, transaction_id: UUID) -> Optional[Transaction]:
        return self.session.get(Transaction, transaction_id)

    def list(
        self,
        *,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> List[Transaction]:
        statement = select(Transaction).order_by(desc(Transaction.occurred_at))  # type: ignore[arg-type]

        if start_date is not None:
            statement = statement.where(Transaction.occurred_at >= start_date)
        if end_date is not None:
            statement = statement.where(Transaction.occurred_at <= end_date)
        if account_ids:
            statement = statement.join(TransactionLeg).where(
                TransactionLeg.account_id.in_(list(account_ids))  # type: ignore[attr-defined]
            )

        return list(self.session.exec(statement))

    def _validate_legs(self, legs: List[TransactionLeg]) -> None:
        if len(legs) < 2:
            raise ValueError("Transactions require at least two legs")

        zero_amount = Decimal("0")
        for leg in legs:
            if leg.account_id is None:  # pragma: no cover - defensive
                raise ValueError("Transaction legs require an account reference")
            amount = coerce_decimal(leg.amount)
            if amount == zero_amount:
                raise ValueError("Transaction legs must carry a non-zero amount")

        ensure_balanced_legs([leg.amount for leg in legs])

    def create(
        self,
        transaction: Transaction,
        legs: List[TransactionLeg],
        *,
        import_batch: Optional[TransactionImportBatch] = None,
    ) -> Transaction:
        if not legs:
            raise ValueError("Transactions require at least one leg")
        self._validate_legs(legs)

        if import_batch:
            transaction.import_batch_id = import_batch.id

        self.session.add(transaction)
        self.session.flush()

        for leg in legs:
            leg.transaction_id = transaction.id
            self.session.add(leg)

        self.session.commit()
        self.session.refresh(transaction)
        return transaction

    def add_leg(self, transaction: Transaction, leg: TransactionLeg) -> TransactionLeg:
        leg.transaction_id = transaction.id
        self.session.add(leg)
        self.session.commit()
        self.session.refresh(leg)
        return leg

    def list_by_account(self, account_id: UUID) -> List[Transaction]:
        statement = (
            select(Transaction)
            .join(TransactionLeg)
            .where(TransactionLeg.account_id == account_id)
            .order_by(desc(Transaction.occurred_at))  # type: ignore[arg-type]
        )
        return list(self.session.exec(statement))

    def calculate_account_balance(self, account_id: UUID, up_to: Optional[datetime] = None) -> Decimal:
        statement = select(TransactionLeg).where(TransactionLeg.account_id == account_id)
        if up_to is not None:
            statement = statement.join(Transaction).where(Transaction.occurred_at <= up_to)

        legs = self.session.exec(statement).all()
        total = sum(coerce_decimal(leg.amount) for leg in legs)
        return coerce_decimal(total)

    def list_loan_events(self, loan_id: UUID) -> List[LoanEvent]:
        statement = (
            select(LoanEvent)
            .where(LoanEvent.loan_id == loan_id)
            .order_by(desc(LoanEvent.occurred_at))  # type: ignore[arg-type]
        )
        return list(self.session.exec(statement))

    def create_loan_event(
        self,
        *,
        loan_id: UUID,
        transaction: Transaction,
        transaction_leg: Optional[TransactionLeg],
        event_type: LoanEventType,
        amount: Decimal,
        occurred_at: datetime,
    ) -> LoanEvent:
        event = LoanEvent(
            loan_id=loan_id,
            transaction_id=transaction.id,
            transaction_leg_id=transaction_leg.id if transaction_leg else None,
            event_type=event_type,
            amount=coerce_decimal(amount),
            occurred_at=occurred_at,
        )
        self.session.add(event)
        self.session.commit()
        self.session.refresh(event)
        return event


__all__ = ["TransactionRepository"]
