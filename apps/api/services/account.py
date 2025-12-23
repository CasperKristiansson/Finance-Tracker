"""Domain service layer for accounts."""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, cast
from uuid import UUID

from sqlmodel import Session, select

from ..models import Account, BalanceSnapshot, Loan, Transaction, TransactionLeg
from ..models.investment_snapshot import InvestmentSnapshot
from ..repositories.account import AccountRepository
from ..repositories.transaction import TransactionRepository
from ..services.transaction import TransactionService
from ..shared import AccountType, TransactionType, coerce_decimal


class AccountService:
    """Higher-level operations that coordinate account-related tasks."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = AccountRepository(session)
        self.transaction_repository = TransactionRepository(session)

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

        balance = self._account_balance(account, as_of=as_of)
        return account, balance

    def list_accounts_with_balance(
        self,
        *,
        include_inactive: bool = False,
        as_of: Optional[datetime] = None,
    ) -> List[Tuple[Account, Decimal]]:
        accounts = self.repository.list_accounts(include_inactive=include_inactive)
        results: List[Tuple[Account, Decimal]] = []
        for account in accounts:
            balance = self._account_balance(account, as_of=as_of)
            results.append((account, balance))
        return results

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

    def update_account(
        self,
        account_id: UUID,
        **updates,
    ) -> Account:
        account = self.repository.get(account_id, with_relationships=True)
        if account is None:
            raise LookupError("Account not found")
        return self.repository.update_fields(account, **updates)

    def calculate_account_balance(
        self,
        account_id: UUID,
        *,
        as_of: Optional[datetime] = None,
    ) -> Decimal:
        return self.repository.calculate_balance(account_id, as_of=as_of)

    def reconcile_account(
        self,
        account_id: UUID,
        *,
        captured_at: datetime,
        reported_balance: Decimal,
        description: str | None = None,
        category_id: UUID | None = None,
    ) -> dict[str, object]:
        account = self.repository.get(account_id, with_relationships=True)
        if account is None:
            raise LookupError("Account not found")

        ledger_balance = self.repository.calculate_balance(account_id, as_of=captured_at)
        delta = reported_balance - ledger_balance

        snapshot = BalanceSnapshot(
            account_id=account_id,
            captured_at=captured_at,
            balance=reported_balance,
        )
        snapshot_saved = self.repository.create_snapshot(snapshot)

        adjustment_transaction: Transaction | None = None

        if delta != 0:
            # Create a reconciliation transaction to bring ledger in sync.
            offset_account = self._get_or_create_offset_account()
            legs = [
                TransactionLeg(account_id=account_id, amount=delta),
                TransactionLeg(account_id=offset_account.id, amount=-delta),
            ]
            tx_type = TransactionType.INCOME if delta > 0 else TransactionType.EXPENSE
            adjustment_transaction = Transaction(
                category_id=category_id,
                transaction_type=tx_type,
                description=description or "Balance reconciliation",
                notes=None,
                external_id=None,
                occurred_at=captured_at,
                posted_at=captured_at,
            )
            txn_service = TransactionService(self.session)
            adjustment_transaction = txn_service.create_transaction(adjustment_transaction, legs)

        return {
            "snapshot": snapshot_saved,
            "delta": delta,
            "transaction": adjustment_transaction,
            "ledger_balance": ledger_balance,
        }

    def reconciliation_state(self, account_id: UUID) -> dict[str, object]:
        account = self.repository.get(account_id, with_relationships=True)
        if account is None:
            raise LookupError("Account not found")

        if account.account_type == AccountType.INVESTMENT:
            snapshot = self._latest_investment_snapshot(as_of=None)
            balance = self._investment_balance(account.name, snapshot)
            captured_at = (
                datetime.combine(snapshot.snapshot_date, time.min, tzinfo=timezone.utc)
                if snapshot is not None
                else None
            )
            return {
                "last_captured_at": captured_at,
                "last_reported_balance": balance,
                "current_balance": balance,
                "delta_since_snapshot": Decimal("0"),
            }

        latest = self.repository.latest_snapshot(account_id)
        current = self.repository.calculate_balance(account_id)
        last_captured_at = getattr(latest, "captured_at", None)
        last_balance = getattr(latest, "balance", None)
        delta = None
        if latest is not None and last_balance is not None:
            delta = current - last_balance
        return {
            "last_captured_at": last_captured_at,
            "last_reported_balance": last_balance,
            "current_balance": current,
            "delta_since_snapshot": delta,
        }

    def _account_balance(self, account: Account, *, as_of: Optional[datetime] = None) -> Decimal:
        if account.account_type != AccountType.INVESTMENT:
            return self.repository.calculate_balance(account.id, as_of=as_of)

        snapshot = self._latest_investment_snapshot(as_of=as_of)
        return self._investment_balance(account.name, snapshot)

    def _latest_investment_snapshot(
        self, *, as_of: Optional[datetime]
    ) -> InvestmentSnapshot | None:
        target_date: date | None = as_of.date() if as_of else None
        statement = select(InvestmentSnapshot)
        if target_date is not None:
            statement = statement.where(cast(Any, InvestmentSnapshot.snapshot_date) <= target_date)
        statement = statement.order_by(cast(Any, InvestmentSnapshot.snapshot_date).desc()).limit(1)
        return self.session.exec(statement).first()

    @staticmethod
    def _investment_balance(account_name: str, snapshot: InvestmentSnapshot | None) -> Decimal:
        if snapshot is None:
            return Decimal("0")
        payload = getattr(snapshot, "parsed_payload", None) or {}
        accounts = payload.get("accounts") if isinstance(payload, dict) else None
        if isinstance(accounts, dict):
            if account_name in accounts:
                raw_value = accounts.get(account_name)
                if isinstance(raw_value, (int, float, Decimal)):
                    return coerce_decimal(raw_value)
                return Decimal("0")
            # Fallback: case-insensitive match for renamed accounts.
            lower_map = {str(key).lower(): val for key, val in accounts.items()}
            if account_name.lower() in lower_map:
                raw_value = lower_map[account_name.lower()]
                if isinstance(raw_value, (int, float, Decimal)):
                    return coerce_decimal(raw_value)
                return Decimal("0")
        return Decimal("0")

    def _get_or_create_offset_account(self) -> Account:
        if hasattr(self, "_offset_account"):
            return getattr(self, "_offset_account")
        account = self.repository.session.exec(
            select(Account).where(cast(Any, Account.is_active).is_(False), Account.name == "Offset")
        ).one_or_none()
        if account is None:
            account = Account(
                name="Offset",
                account_type=AccountType.NORMAL,
                is_active=False,
            )
            self.repository.save(account)
        setattr(self, "_offset_account", account)
        return account


__all__ = ["AccountService"]
