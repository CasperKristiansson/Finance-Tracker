"""Data access layer for account entities."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, List, Optional, cast
from uuid import UUID

from sqlalchemy import desc, func
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..models import Account, BalanceSnapshot, Loan, Transaction, TransactionLeg
from ..shared import AccountType, coerce_decimal

_UNSET = object()


class AccountRepository:
    """Encapsulates account persistence and related aggregates."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, account_id: UUID, *, with_relationships: bool = False) -> Optional[Account]:
        if with_relationships:
            statement = (
                select(Account)
                .options(selectinload(cast(Any, Account.loan)))
                .where(cast(Any, Account.id) == account_id)
            )
            return self.session.exec(statement).one_or_none()
        return self.session.get(Account, account_id)

    def list_accounts(self, include_inactive: bool = False) -> List[Account]:
        statement = select(Account).options(selectinload(cast(Any, Account.loan)))
        if not include_inactive:
            statement = statement.where(cast(Any, Account.is_active).is_(True))
        statement = statement.order_by(cast(Any, Account.name), cast(Any, Account.created_at))
        return list(self.session.exec(statement))

    def list_account_options(self, include_inactive: bool = False) -> List[Account]:
        statement = select(Account)
        if not include_inactive:
            statement = statement.where(cast(Any, Account.is_active).is_(True))
        statement = statement.order_by(cast(Any, Account.name), cast(Any, Account.created_at))
        return list(self.session.exec(statement))

    def save(self, account: Account) -> Account:
        self.session.add(account)
        self.session.commit()
        self.session.refresh(account)
        return account

    def calculate_balance(self, account_id: UUID, *, as_of: Optional[datetime] = None) -> Decimal:
        statement = select(func.coalesce(func.sum(TransactionLeg.amount), 0)).where(
            cast(Any, TransactionLeg.account_id) == account_id
        )

        if as_of is not None:
            statement = statement.join(
                Transaction,
                cast(Any, Transaction.id) == cast(Any, TransactionLeg.transaction_id),
            )
            statement = statement.where(cast(Any, Transaction.occurred_at) <= as_of)

        result = self.session.exec(statement).one()
        return coerce_decimal(result)

    def latest_snapshot(self, account_id: UUID) -> Optional[BalanceSnapshot]:
        statement = (
            select(BalanceSnapshot)
            .where(cast(Any, BalanceSnapshot.account_id) == account_id)
            .order_by(desc(cast(Any, BalanceSnapshot.captured_at)))
            .limit(1)
        )
        return self.session.exec(statement).one_or_none()

    def create_snapshot(self, snapshot: BalanceSnapshot) -> BalanceSnapshot:
        self.session.add(snapshot)
        self.session.commit()
        self.session.refresh(snapshot)
        return snapshot

    def attach_loan(self, account_id: UUID, loan: Loan) -> Loan:
        account = self.get(account_id)
        if account is None:
            raise ValueError("Account not found")
        if account.account_type != AccountType.DEBT:
            raise ValueError("Loans can only be attached to debt accounts")
        existing = self.session.exec(
            select(Loan).where(cast(Any, Loan.account_id) == account_id)
        ).one_or_none()
        if existing is not None:
            raise ValueError("Account already has a linked loan")

        loan.account_id = account_id
        self.session.add(loan)
        self.session.commit()
        self.session.refresh(loan)
        return loan

    def update_fields(
        self,
        account: Account,
        *,
        name: Optional[str] = None,
        is_active=_UNSET,
        icon=_UNSET,
        bank_import_type=_UNSET,
    ) -> Account:
        if name is not None:
            account.name = name
        if is_active is not _UNSET:
            account.is_active = is_active
        if icon is not _UNSET:
            account.icon = icon
        if bank_import_type is not _UNSET:
            account.bank_import_type = bank_import_type

        self.session.add(account)
        self.session.commit()
        self.session.refresh(account)
        return account

    def delete(self, account: Account) -> None:
        self.session.delete(account)
        self.session.commit()


__all__ = ["AccountRepository"]
