# pyright: reportGeneralTypeIssues=false
"""Service layer for transaction operations."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable, List, Optional, Sequence, cast
from uuid import UUID

from sqlmodel import Session, select

from ..models import (
    Category,
    Loan,
    LoanEvent,
    Subscription,
    Transaction,
    TransactionImportBatch,
    TransactionLeg,
)
from ..repositories.transaction import TransactionRepository
from ..shared import (
    CategoryType,
    LoanEventType,
    TransactionType,
    coerce_decimal,
    validate_transaction_legs,
)


class TransactionService:
    """Coordinates business logic for transactions and related loan events."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = TransactionRepository(session)

    def list_transactions(
        self,
        *,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
        transaction_types: Optional[Iterable["TransactionType"]] = None,
        tax_event: Optional[bool] = None,
        min_amount: Optional[Decimal] = None,
        max_amount: Optional[Decimal] = None,
        search: Optional[str] = None,
        sort_by: str = "occurred_at",
        sort_dir: str = "desc",
        limit: Optional[int] = None,
        offset: Optional[int] = None,
    ) -> List[Transaction]:
        return self.repository.list(
            start_date=start_date,
            end_date=end_date,
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
            transaction_types=transaction_types,
            tax_event=tax_event,
            min_amount=min_amount,
            max_amount=max_amount,
            search=search,
            sort_by=sort_by,
            sort_dir=sort_dir,
            limit=limit,
            offset=offset,
        )

    def create_transaction(
        self,
        transaction: Transaction,
        legs: List[TransactionLeg],
        *,
        import_batch: Optional[TransactionImportBatch] = None,
        commit: bool = True,
    ) -> Transaction:
        prepared_legs = list(legs)
        if transaction.posted_at is None:  # pragma: no cover - safeguard
            transaction.posted_at = transaction.occurred_at

        category = self._get_category(transaction.category_id)
        self._ensure_subscription_exists(transaction.subscription_id)
        transaction.transaction_type = self._infer_transaction_type(
            prepared_legs,
            category,
            transaction.transaction_type,
        )

        validate_transaction_legs(transaction.transaction_type, prepared_legs)

        created = self.repository.create(
            transaction,
            prepared_legs,
            import_batch=import_batch,
            commit=commit,
        )

        self._record_loan_events(created, category, commit=commit)
        return created

    def update_transaction(
        self,
        transaction_id: UUID,
        *,
        description: Optional[str] = None,
        notes: Optional[str] = None,
        occurred_at: Optional[datetime] = None,
        posted_at: Optional[datetime] = None,
        category_id: Optional[UUID] = None,
        subscription_id: Optional[UUID] = None,
        update_subscription: bool = False,
    ) -> Transaction:
        transaction = self.repository.get(transaction_id)
        if transaction is None:
            raise LookupError("Transaction not found")
        if update_subscription and subscription_id is not None:
            self._ensure_subscription_exists(subscription_id)
        return self.repository.update(
            transaction,
            description=description,
            notes=notes,
            occurred_at=occurred_at,
            posted_at=posted_at,
            category_id=category_id,
            subscription_id=subscription_id,
            update_subscription=update_subscription,
        )

    def delete_transaction(self, transaction_id: UUID) -> None:
        transaction = self.repository.get(transaction_id)
        if transaction is None:
            raise LookupError("Transaction not found")
        self.repository.delete(transaction)

    def add_transaction_leg(self, transaction_id: UUID, leg: TransactionLeg) -> TransactionLeg:
        transaction = self.repository.get(transaction_id)
        if transaction is None:
            raise LookupError("Transaction not found")
        return self.repository.add_leg(transaction, leg)

    def calculate_account_balance(
        self, account_id: UUID, up_to: Optional[datetime] = None
    ) -> Decimal:
        return self.repository.calculate_account_balance(account_id, up_to)

    def calculate_account_balances(self, account_ids: Iterable[UUID]) -> dict[UUID, Decimal]:
        return self.repository.calculate_account_balances(account_ids)

    def list_loan_events(self, loan_id: UUID) -> List[LoanEvent]:
        return self.repository.list_loan_events(loan_id)

    def create_loan_event(
        self,
        *,
        loan_id: UUID,
        transaction: Transaction,
        transaction_leg: Optional[TransactionLeg],
        event_type: LoanEventType,
        amount: Decimal,
        occurred_at: datetime,
        commit: bool = True,
    ) -> LoanEvent:
        return self.repository.create_loan_event(
            loan_id=loan_id,
            transaction=transaction,
            transaction_leg=transaction_leg,
            event_type=event_type,
            amount=amount,
            occurred_at=occurred_at,
            commit=commit,
        )

    def _get_category(self, category_id: Optional[UUID]) -> Optional[Category]:
        if category_id is None:
            return None
        statement = select(Category).where(Category.id == category_id)
        return self.session.exec(statement).one_or_none()

    def _ensure_subscription_exists(self, subscription_id: Optional[UUID]) -> None:
        if subscription_id is None:
            return
        subscription = self.session.get(Subscription, subscription_id)
        if subscription is None:
            raise ValueError("Subscription not found")

    def _infer_transaction_type(
        self,
        legs: Sequence[TransactionLeg],
        category: Optional[Category],
        fallback: TransactionType,
    ) -> TransactionType:
        if fallback == TransactionType.ADJUSTMENT:
            return TransactionType.ADJUSTMENT
        if category is not None:
            category_mapping = {
                CategoryType.INCOME: TransactionType.INCOME,
                CategoryType.EXPENSE: TransactionType.EXPENSE,
                CategoryType.ADJUSTMENT: TransactionType.ADJUSTMENT,
                CategoryType.INTEREST: TransactionType.EXPENSE,
                CategoryType.LOAN: TransactionType.TRANSFER,
            }
            mapped = category_mapping.get(category.category_type)
            if mapped is not None:
                return mapped
        if fallback in {TransactionType.INCOME, TransactionType.EXPENSE}:
            return fallback

        has_positive = any(coerce_decimal(leg.amount) > 0 for leg in legs)
        has_negative = any(coerce_decimal(leg.amount) < 0 for leg in legs)

        if has_positive and has_negative:
            return TransactionType.TRANSFER

        return fallback

    def _record_loan_events(
        self,
        transaction: Transaction,
        category: Optional[Category],
        *,
        commit: bool,
    ) -> None:
        if transaction.id is None:
            return

        statement = select(TransactionLeg).where(TransactionLeg.transaction_id == transaction.id)
        persisted_legs = list(self.session.exec(statement))
        if not persisted_legs:
            return

        loan_lookup = self._loan_lookup(leg.account_id for leg in persisted_legs)
        if not loan_lookup:
            return

        for leg in persisted_legs:
            loan = loan_lookup.get(leg.account_id)
            if loan is None:
                continue

            event_type = self._classify_loan_event(
                transaction_type=transaction.transaction_type,
                leg=leg,
                category=category,
            )
            if event_type is None:
                continue

            self.repository.create_loan_event(
                loan_id=loan.id,
                transaction=transaction,
                transaction_leg=leg,
                event_type=event_type,
                amount=coerce_decimal(leg.amount).copy_abs(),
                occurred_at=transaction.occurred_at,
                commit=commit,
            )

    def _loan_lookup(self, account_ids: Iterable[UUID]) -> dict[UUID, Loan]:
        unique_ids = {account_id for account_id in account_ids if account_id is not None}
        if not unique_ids:
            return {}
        condition = cast(Any, Loan.account_id).in_(list(unique_ids))
        statement = select(Loan).where(condition)
        loans = self.session.exec(statement).all()
        return {loan.account_id: loan for loan in loans}

    def _classify_loan_event(
        self,
        *,
        transaction_type: TransactionType,
        leg: TransactionLeg,
        category: Optional[Category],
    ) -> Optional[LoanEventType]:
        amount = coerce_decimal(leg.amount)
        if amount == Decimal("0"):
            return None

        if category is not None:
            if category.category_type == CategoryType.INTEREST:
                return (
                    LoanEventType.PAYMENT_INTEREST if amount < 0 else LoanEventType.INTEREST_ACCRUAL
                )
            if category.category_type == CategoryType.LOAN:
                return LoanEventType.DISBURSEMENT if amount > 0 else LoanEventType.PAYMENT_PRINCIPAL

        if transaction_type == TransactionType.TRANSFER:
            return LoanEventType.DISBURSEMENT if amount > 0 else LoanEventType.PAYMENT_PRINCIPAL

        return None


__all__ = ["TransactionService"]
