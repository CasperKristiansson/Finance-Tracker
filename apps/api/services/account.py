"""Domain service layer for accounts."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple
from uuid import UUID

from sqlmodel import Session

from ..models import Account, Loan
from ..repositories.account import AccountRepository
from ..shared import AccountType


class AccountService:
    """Higher-level operations that coordinate account-related tasks."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = AccountRepository(session)

    def create_account(
        self,
        account: Account,
        loan_kwargs: Optional[Dict[str, Any]] = None,
    ) -> Account:
        """Persist an account and optionally attach loan metadata."""

        if account.account_type == AccountType.DEBT and not loan_kwargs:
            raise ValueError("Debt accounts require loan information")
        if account.account_type != AccountType.DEBT and loan_kwargs:
            raise ValueError("Loan details supplied for non-debt account")

        saved_account = self.repository.save(account)

        if loan_kwargs:
            loan = Loan(account_id=saved_account.id, **loan_kwargs)
            self.repository.attach_loan(saved_account.id, loan)

        return saved_account

    def get_account_with_balance(
        self, account_id: UUID, *, as_of: Optional[datetime] = None
    ) -> Tuple[Account, Decimal]:
        account = self.repository.get(account_id, with_relationships=True)
        if account is None:
            raise LookupError("Account not found")

        balance = self.repository.calculate_balance(account_id, as_of=as_of)
        return account, balance

    def attach_loan(
        self,
        account_id: UUID,
        loan_kwargs: Dict[str, Any],
    ) -> Loan:
        account = self.repository.get(account_id, with_relationships=True)
        if account is None:
            raise LookupError("Account not found")
        loan = Loan(account_id=account_id, **loan_kwargs)
        return self.repository.attach_loan(account_id, loan)


__all__ = ["AccountService"]
