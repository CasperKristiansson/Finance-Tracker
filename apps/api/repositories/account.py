# pyright: reportGeneralTypeIssues=false
"""Data access layer for account entities."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlmodel import Session

from ..models import Account, Loan, Transaction, TransactionLeg
from ..shared import AccountType, coerce_decimal


class AccountRepository:
    """Encapsulates account persistence and related aggregates."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, account_id: UUID, *, with_relationships: bool = False) -> Optional[Account]:
        if with_relationships:
            statement = (
                select(Account).options(selectinload(Account.loan)).where(Account.id == account_id)
            )
            return self.session.exec(statement).scalars().one_or_none()
        return self.session.get(Account, account_id)

    def list_accounts(self, include_inactive: bool = False) -> List[Account]:
        statement = select(Account).options(selectinload(Account.loan))
        if not include_inactive:
            statement = statement.where(Account.is_active.is_(True))
        statement = statement.order_by(Account.display_order, Account.created_at)
        return list(self.session.exec(statement).scalars())

    def save(self, account: Account) -> Account:
        self.session.add(account)
        self.session.commit()
        self.session.refresh(account)
        return account

    def calculate_balance(self, account_id: UUID, *, as_of: Optional[datetime] = None) -> Decimal:
        statement = select(func.coalesce(func.sum(TransactionLeg.amount), 0)).where(
            TransactionLeg.account_id == account_id
        )

        if as_of is not None:
            statement = statement.join(Transaction, Transaction.id == TransactionLeg.transaction_id)
            statement = statement.where(Transaction.occurred_at <= as_of)

        result = self.session.exec(statement).scalar_one()
        return coerce_decimal(result)

    def attach_loan(self, account_id: UUID, loan: Loan) -> Loan:
        account = self.get(account_id)
        if account is None:
            raise ValueError("Account not found")
        if account.account_type != AccountType.DEBT:
            raise ValueError("Loans can only be attached to debt accounts")
        existing = self.session.exec(
            select(Loan).where(Loan.account_id == account_id)
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
        display_order: Optional[int] = None,
        is_active: Optional[bool] = None,
    ) -> Account:
        if display_order is not None:
            account.display_order = display_order
        if is_active is not None:
            account.is_active = is_active

        self.session.add(account)
        self.session.commit()
        self.session.refresh(account)
        return account

    def delete(self, account: Account) -> None:
        self.session.delete(account)
        self.session.commit()


__all__ = ["AccountRepository"]
