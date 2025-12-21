# pyright: reportGeneralTypeIssues=false
"""Service layer for transaction operations."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Iterable, List, Optional, Sequence, cast
from uuid import UUID

from sqlalchemy.orm import selectinload
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
from ..schemas import ReturnSummary
from ..shared import (
    CategoryType,
    LoanEventType,
    ReturnStatus,
    TransactionType,
    coerce_decimal,
    ensure_balanced_legs,
    get_default_user_id,
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

        if transaction.return_parent_id is not None:
            transaction.transaction_type = TransactionType.RETURN
            if transaction.return_status is None:
                transaction.return_status = ReturnStatus.PENDING

        category = self._get_category(transaction.category_id)
        self._ensure_subscription_exists(transaction.subscription_id)
        transaction.transaction_type = self._infer_transaction_type(
            prepared_legs,
            category,
            transaction.transaction_type,
        )
        if transaction.transaction_type is not TransactionType.RETURN:
            transaction.return_parent_id = None
            transaction.return_status = None

        self._validate_transaction_legs(transaction.transaction_type, prepared_legs)
        if transaction.transaction_type is TransactionType.RETURN:
            parent = self._resolve_return_parent(transaction.return_parent_id)
            self._validate_return_transaction(
                prepared_legs=prepared_legs,
                parent=parent,
            )

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

    def mark_transaction_as_return(
        self, transaction_id: UUID, *, return_parent_id: UUID
    ) -> Transaction:
        transaction = self.repository.get(transaction_id)
        if transaction is None:
            raise LookupError("Transaction not found")
        current_user = str(self.session.info.get("user_id") or get_default_user_id())
        if transaction.user_id != current_user:
            raise LookupError("Transaction not found")
        if transaction_id == return_parent_id:
            raise ValueError("A transaction cannot return itself")

        parent = self._resolve_return_parent(return_parent_id)
        legs = (
            transaction.legs
            if getattr(transaction, "legs", None)
            else list(
                self.session.exec(
                    select(TransactionLeg).where(TransactionLeg.transaction_id == transaction.id)
                ).all()
            )
        )

        self._validate_transaction_legs(TransactionType.RETURN, legs)
        self._validate_return_transaction(prepared_legs=legs, parent=parent)

        transaction.return_parent_id = return_parent_id
        transaction.transaction_type = TransactionType.RETURN
        transaction.return_status = ReturnStatus.PENDING
        self.session.add(transaction)
        self.session.commit()
        self.session.refresh(transaction)
        return transaction

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
        if fallback == TransactionType.RETURN:
            return TransactionType.RETURN
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

        has_positive = any(coerce_decimal(leg.amount) > 0 for leg in legs)
        has_negative = any(coerce_decimal(leg.amount) < 0 for leg in legs)

        if has_positive and has_negative:
            return TransactionType.TRANSFER

        return fallback

    def _validate_transaction_legs(
        self,
        transaction_type: TransactionType,
        legs: Sequence[TransactionLeg],
    ) -> None:
        if len(legs) < 2:
            raise ValueError("Transactions require at least two legs")

        ensure_balanced_legs([leg.amount for leg in legs])

        has_positive = any(coerce_decimal(leg.amount) > 0 for leg in legs)
        has_negative = any(coerce_decimal(leg.amount) < 0 for leg in legs)

        if not (has_positive and has_negative):
            raise ValueError("Transactions must include positive and negative legs")

        if transaction_type == TransactionType.TRANSFER:
            unique_accounts = {leg.account_id for leg in legs}
            if len(unique_accounts) < 2:
                raise ValueError("Transfers require at least two distinct accounts")

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

    def _resolve_return_parent(self, return_parent_id: Optional[UUID]) -> Transaction:
        if return_parent_id is None:
            raise ValueError("Return transactions require a parent reference")

        parent = self.repository.get(return_parent_id)
        if parent is None:
            raise ValueError("Return parent transaction not found")

        current_user = str(self.session.info.get("user_id") or get_default_user_id())
        if parent.user_id != current_user:
            raise ValueError("Return parent must belong to the same user")
        if parent.transaction_type is TransactionType.RETURN:
            raise ValueError("Return parent cannot be a return transaction")

        return parent

    def _leg_amounts_by_account(
        self, legs: Iterable[TransactionLeg]
    ) -> dict[UUID, Decimal]:  # pragma: no cover - thin mapper
        totals: dict[UUID, Decimal] = {}
        for leg in legs:
            amount = coerce_decimal(leg.amount)
            totals[leg.account_id] = totals.get(leg.account_id, Decimal("0")) + amount
        return totals

    def _validate_return_transaction(
        self,
        *,
        prepared_legs: Iterable[TransactionLeg],
        parent: Transaction,
    ) -> None:
        candidate_totals = self._leg_amounts_by_account(prepared_legs)

        if not hasattr(parent, "legs") or not parent.legs:
            parent_legs = list(
                self.session.exec(
                    select(TransactionLeg).where(TransactionLeg.transaction_id == parent.id)
                ).all()
            )
        else:  # pragma: no cover - exercised in handler tests
            parent_legs = parent.legs

        parent_totals = self._leg_amounts_by_account(parent_legs)
        if set(candidate_totals.keys()) != set(parent_totals.keys()):
            raise ValueError("Return transactions must reference the same accounts as the parent")

        for account_id, amount in candidate_totals.items():
            if amount + parent_totals[account_id] != Decimal("0"):
                raise ValueError("Return transaction legs must offset parent leg amounts")

    def _largest_leg_amount(self, legs: Iterable[TransactionLeg]) -> Decimal:
        return max(
            (coerce_decimal(leg.amount).copy_abs() for leg in legs),
            default=Decimal("0"),
        )

    def _load_legs(self, transaction: Transaction) -> list[TransactionLeg]:
        if getattr(transaction, "legs", None):
            return list(transaction.legs)
        statement = (
            select(TransactionLeg)
            .where(TransactionLeg.transaction_id == transaction.id)
            .options(selectinload(TransactionLeg.account))  # type: ignore[arg-type]
        )
        return list(self.session.exec(statement).all())

    def _build_return_summary(self, transaction: Transaction, parent: Transaction) -> ReturnSummary:
        return_legs = self._load_legs(transaction)
        parent_legs = self._load_legs(parent)
        accounts = {
            getattr(leg.account, "name", None)
            for leg in parent_legs
            if getattr(leg, "account", None) is not None
        }

        return ReturnSummary(
            return_id=transaction.id,
            return_status=transaction.return_status or ReturnStatus.PENDING,
            return_occurred_at=transaction.occurred_at,
            return_amount=str(self._largest_leg_amount(return_legs)),
            parent_id=parent.id,
            parent_description=parent.description,
            parent_occurred_at=parent.occurred_at,
            parent_amount=str(self._largest_leg_amount(parent_legs)),
            accounts=sorted(filter(None, accounts)),
        )

    def build_return_summary(self, transaction: Transaction, parent: Transaction) -> ReturnSummary:
        return self._build_return_summary(transaction, parent)

    def list_returns(self) -> list[ReturnSummary]:
        returns = list(
            self.session.exec(
                select(Transaction).where(cast(Any, Transaction.return_parent_id).is_not(None))
            ).all()
        )
        parent_ids = {tx.return_parent_id for tx in returns if tx.return_parent_id}
        parents = {}
        if parent_ids:
            parents = {
                tx.id: tx
                for tx in self.session.exec(
                    select(Transaction).where(cast(Any, Transaction.id).in_(parent_ids))
                ).all()
            }

        summaries: list[ReturnSummary] = []
        for transaction in returns:
            parent_id = transaction.return_parent_id
            if parent_id is None:
                continue
            parent = parents.get(parent_id)
            if parent is None:
                continue
            summaries.append(self.build_return_summary(transaction, parent))
        return summaries

    def update_return(
        self, *, transaction_id: UUID, action: str
    ) -> tuple[Transaction, Optional[Transaction]]:
        transaction = self.repository.get(transaction_id)
        if transaction is None or transaction.return_parent_id is None:
            raise LookupError("Return not found")
        if transaction.transaction_type is not TransactionType.RETURN:
            raise ValueError("Transaction is not a return")

        parent: Optional[Transaction] = None
        if transaction.return_parent_id is not None:
            parent = self._resolve_return_parent(transaction.return_parent_id)

        if action == "mark_processed":
            transaction.return_status = ReturnStatus.PROCESSED
        elif action == "detach":
            transaction.return_parent_id = None
            transaction.return_status = None
        else:
            raise ValueError("Unsupported return action")

        self.session.add(transaction)
        self.session.commit()
        self.session.refresh(transaction)
        return transaction, parent


__all__ = ["TransactionService"]
