"""Core helper operations shared across reporting repository mixins."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Iterable, Optional, Sequence, Tuple, cast
from uuid import UUID

from sqlalchemy import Table, desc
from sqlmodel import Session, select

from ..models import Transaction, TransactionLeg
from ..shared import TransactionType, coerce_decimal
from .reporting_types import DecimalTotals


class ReportingCoreMixin:
    """Shared utility methods for reporting SQL aggregation."""

    session: Session
    user_id: str
    _excluded_account_ids: set[UUID]

    def _normalize_datetime(self, value: datetime) -> datetime:
        """SQLite stores naive datetimes; Postgres uses tz-aware timestamps."""

        bind = self.session.get_bind()
        dialect = getattr(bind, "dialect", None)
        if dialect is not None and getattr(dialect, "name", "") == "sqlite":
            return value.replace(tzinfo=None)
        return value

    def _fetch_legs(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Sequence[Tuple[datetime, Decimal, TransactionType]]:
        transaction_table = cast(Table, getattr(Transaction, "__table__"))
        leg_table = cast(Table, getattr(TransactionLeg, "__table__"))

        statement = (
            select(
                transaction_table.c.occurred_at,
                leg_table.c.amount,
                transaction_table.c.transaction_type,
            )
            .join_from(
                leg_table, transaction_table, leg_table.c.transaction_id == transaction_table.c.id
            )
            .order_by(desc(transaction_table.c.occurred_at))
        )

        statement = statement.where(transaction_table.c.user_id == self.user_id)
        statement = statement.where(leg_table.c.user_id == self.user_id)
        if account_ids:
            statement = statement.where(leg_table.c.account_id.in_(list(account_ids)))
        elif self._excluded_account_ids:
            statement = statement.where(
                ~leg_table.c.account_id.in_(list(self._excluded_account_ids))
            )
        if category_ids:
            statement = statement.where(transaction_table.c.category_id.in_(list(category_ids)))
        if start_date:
            statement = statement.where(transaction_table.c.occurred_at >= start_date)
        if end_date:
            statement = statement.where(transaction_table.c.occurred_at <= end_date)

        rows = self.session.exec(statement).all()
        return [
            (occurred_at, coerce_decimal(amount), TransactionType(str(tx_type)))
            for occurred_at, amount, tx_type in rows
        ]

    @staticmethod
    def _accumulate(
        amount: Decimal,
        transaction_type: TransactionType,
        *totals: Decimal,
        income: Decimal | None = None,
        expense: Decimal | None = None,
        adjustment_inflow: Decimal | None = None,
        adjustment_outflow: Decimal | None = None,
    ) -> DecimalTotals:
        if totals:
            if len(totals) != 4:
                raise TypeError("_accumulate expected 4 trailing totals")
            income, expense, adjustment_inflow, adjustment_outflow = totals
        if (
            income is None
            or expense is None
            or adjustment_inflow is None
            or adjustment_outflow is None
        ):
            raise TypeError("_accumulate requires income/expense/adjustment totals")
        amount = coerce_decimal(amount)
        if transaction_type == TransactionType.ADJUSTMENT:
            if amount > 0:
                adjustment_inflow += amount
            elif amount < 0:
                adjustment_outflow += -amount
            return income, expense, adjustment_inflow, adjustment_outflow
        if amount > 0:
            income += amount
        elif amount < 0:
            expense += -amount
        return income, expense, adjustment_inflow, adjustment_outflow

    @staticmethod
    def _coerce_date(raw: object) -> date:
        if isinstance(raw, date):
            return raw
        return date.fromisoformat(str(raw))


__all__ = ["ReportingCoreMixin"]
