# pyright: reportGeneralTypeIssues=false
"""Service layer for income tax operations."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, cast
from uuid import UUID

from sqlmodel import Session, select

from ..models import Account, TaxEvent, Transaction, TransactionLeg
from ..schemas.tax import TaxEventListItem, TaxSummaryMonthlyEntry, TaxSummaryTotals
from ..shared import (
    AccountType,
    CreatedSource,
    TaxEventType,
    TransactionType,
    coerce_decimal,
)
from .transaction import TransactionService


@dataclass(frozen=True)
class _TaxRow:
    event: TaxEvent
    transaction: Transaction
    account_id: UUID
    account_name: Optional[str]
    amount: Decimal


class TaxService:
    """Coordinates tax event persistence and summaries."""

    def __init__(self, session: Session):
        self.session = session
        self.transaction_service = TransactionService(session)

    def create_tax_event(
        self,
        *,
        account_id: UUID,
        occurred_at: datetime,
        posted_at: Optional[datetime],
        amount: Decimal,
        event_type: TaxEventType,
        description: str,
        authority: Optional[str] = "Skatteverket",
        note: Optional[str] = None,
        created_source: CreatedSource = CreatedSource.MANUAL,
        import_batch_id: Optional[UUID] = None,
    ) -> tuple[TaxEvent, Transaction]:
        account = self.session.get(Account, account_id)
        if account is None:
            raise LookupError("Account not found")

        offset_account = self._get_or_create_offset_account()

        abs_amount = coerce_decimal(amount)
        if abs_amount <= 0:
            raise ValueError("Amount must be positive")

        cash_delta = abs_amount if event_type == TaxEventType.REFUND else -abs_amount
        legs = [
            TransactionLeg(account_id=account_id, amount=cash_delta),
            TransactionLeg(account_id=offset_account.id, amount=-cash_delta),
        ]

        tx = Transaction(
            category_id=None,
            transaction_type=TransactionType.TRANSFER,
            description=description,
            notes=None,
            external_id=None,
            occurred_at=occurred_at,
            posted_at=posted_at or occurred_at,
            subscription_id=None,
            created_source=created_source,
            import_batch_id=import_batch_id,
        )
        created_tx = self.transaction_service.create_transaction(tx, legs)

        event = TaxEvent(
            transaction_id=created_tx.id,
            event_type=event_type,
            authority=authority or "Skatteverket",
            note=note,
        )
        self.session.add(event)
        self.session.commit()
        self.session.refresh(event)
        self.session.refresh(created_tx)
        return event, created_tx

    def list_events(
        self,
        *,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[TaxEventListItem]:
        rows = self._fetch_tax_rows(
            start_date=start_date, end_date=end_date, limit=limit, offset=offset
        )
        return [
            TaxEventListItem(
                id=row.event.id,
                transaction_id=row.event.transaction_id,
                occurred_at=row.transaction.occurred_at,
                description=row.transaction.description,
                event_type=row.event.event_type,
                authority=row.event.authority,
                note=row.event.note,
                account_id=row.account_id,
                account_name=row.account_name,
                amount=row.amount,
            )
            for row in rows
        ]

    def summary_for_year(
        self, *, year: int
    ) -> tuple[List[TaxSummaryMonthlyEntry], TaxSummaryTotals]:
        start = datetime(year, 1, 1, tzinfo=timezone.utc)
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        rows = self._fetch_tax_rows(start_date=start, end_date=end, limit=10_000, offset=0)

        monthly: Dict[int, Decimal] = {m: Decimal("0") for m in range(1, 13)}
        for row in rows:
            month = row.transaction.occurred_at.month
            signed = row.amount if row.event.event_type == TaxEventType.PAYMENT else -row.amount
            monthly[month] += signed

        monthly_entries = [
            TaxSummaryMonthlyEntry(month=m, net_tax_paid=monthly[m]) for m in range(1, 13)
        ]

        today = datetime.now(timezone.utc).date()
        if year == today.year:
            ytd_end = datetime.combine(
                today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
            )
            ytd_rows = self._fetch_tax_rows(
                start_date=start, end_date=ytd_end, limit=10_000, offset=0
            )
            net_tax_paid_ytd = sum(
                (
                    r.amount if r.event.event_type == TaxEventType.PAYMENT else -r.amount
                    for r in ytd_rows
                ),
                Decimal("0"),
            )
        else:
            net_tax_paid_ytd = sum((entry.net_tax_paid for entry in monthly_entries), Decimal("0"))

        last_12m_end = datetime.combine(
            today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
        )
        last_12m_start = last_12m_end - timedelta(days=365)
        last_12m_rows = self._fetch_tax_rows(
            start_date=last_12m_start,
            end_date=last_12m_end,
            limit=10_000,
            offset=0,
        )
        net_tax_paid_last_12m = sum(
            (
                r.amount if r.event.event_type == TaxEventType.PAYMENT else -r.amount
                for r in last_12m_rows
            ),
            Decimal("0"),
        )

        largest_month = None
        largest_value = None
        if any(monthly[m] != Decimal("0") for m in monthly):
            largest_month = max(monthly, key=lambda m: monthly[m])
            largest_value = monthly[largest_month]

        return (
            monthly_entries,
            TaxSummaryTotals(
                net_tax_paid_ytd=net_tax_paid_ytd,
                net_tax_paid_last_12m=net_tax_paid_last_12m,
                largest_month=largest_month,
                largest_month_value=largest_value,
            ),
        )

    def _get_or_create_offset_account(self) -> Account:
        if hasattr(self, "_offset_account"):
            return getattr(self, "_offset_account")

        statement = select(Account).where(
            cast(Any, Account.is_active).is_(False),
            Account.name == "Offset",
        )
        account = self.session.exec(statement).one_or_none()
        if account is None:
            account = Account(
                name="Offset",
                account_type=AccountType.NORMAL,
                is_active=False,
            )
            self.session.add(account)
            self.session.commit()
            self.session.refresh(account)
        else:
            account.name = account.name or "Offset"
        setattr(self, "_offset_account", account)
        return account

    def _fetch_tax_rows(
        self,
        *,
        start_date: Optional[datetime],
        end_date: Optional[datetime],
        limit: int,
        offset: int,
    ) -> List[_TaxRow]:
        offset_account = self._get_or_create_offset_account()

        statement: Any = (
            select(TaxEvent, Transaction, TransactionLeg, Account)
            .join(Transaction, cast(Any, Transaction.id) == cast(Any, TaxEvent.transaction_id))
            .join(
                TransactionLeg,
                cast(Any, TransactionLeg.transaction_id) == cast(Any, Transaction.id),
            )
            .join(Account, cast(Any, Account.id) == cast(Any, TransactionLeg.account_id))
            .where(TransactionLeg.account_id != offset_account.id)
            .order_by(cast(Any, Transaction.occurred_at).desc())
            .limit(limit)
            .offset(offset)
        )

        if start_date is not None:
            statement = statement.where(Transaction.occurred_at >= start_date)
        if end_date is not None:
            statement = statement.where(Transaction.occurred_at < end_date)

        result_rows = self.session.exec(statement).all()
        items: List[_TaxRow] = []
        for event, tx, leg, acc in result_rows:
            items.append(
                _TaxRow(
                    event=cast(TaxEvent, event),
                    transaction=cast(Transaction, tx),
                    account_id=cast(UUID, leg.account_id),
                    account_name=cast(Optional[str], acc.name),
                    amount=abs(coerce_decimal(leg.amount)),
                )
            )
        return items


__all__ = ["TaxService"]
