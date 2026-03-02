"""Balance/history query methods for reporting repository."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterable, List, Optional, Tuple, cast
from uuid import UUID

from sqlalchemy import Table, func
from sqlmodel import select

from ..models import Account, Transaction, TransactionLeg
from ..shared import AccountType, coerce_decimal
from .reporting_core_mixin import ReportingCoreMixin
from .reporting_types import NetWorthPoint


class ReportingBalanceMixin(ReportingCoreMixin):
    """Time-series and account-balance helpers."""

    def get_net_worth_history(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> List[NetWorthPoint]:
        transaction_table = cast(Table, getattr(Transaction, "__table__"))
        leg_table = cast(Table, getattr(TransactionLeg, "__table__"))

        period_column = func.date(transaction_table.c.occurred_at)

        statement = (
            select(period_column.label("period"), func.sum(leg_table.c.amount).label("delta"))
            .join_from(
                leg_table, transaction_table, leg_table.c.transaction_id == transaction_table.c.id
            )
            .group_by(period_column)
            .order_by(period_column.asc())
        )

        statement = statement.where(transaction_table.c.user_id == self.user_id)
        statement = statement.where(leg_table.c.user_id == self.user_id)

        if account_ids:
            statement = statement.where(leg_table.c.account_id.in_(list(account_ids)))
        elif self._excluded_account_ids:
            statement = statement.where(
                ~leg_table.c.account_id.in_(list(self._excluded_account_ids))
            )

        rows = self.session.exec(statement).all()

        history: List[NetWorthPoint] = []
        running_total = Decimal("0")

        for period_value, delta in rows:
            period = self._coerce_date(period_value)
            running_total += coerce_decimal(delta)
            history.append(NetWorthPoint(period=period, net_worth=running_total))

        return history

    def list_account_ids_by_type(
        self, account_type: AccountType, *, account_ids: Optional[Iterable[UUID]] = None
    ) -> List[UUID]:
        statement = select(Account.id).where(
            Account.user_id == self.user_id,
            Account.account_type == account_type,
        )
        if account_ids:
            statement = statement.where(cast(Any, Account.id).in_(list(account_ids)))
        return list(self.session.exec(statement).all())

    def sum_legs_before(
        self, *, before: datetime, account_ids: Optional[Iterable[UUID]] = None
    ) -> Decimal:
        transaction_table = cast(Table, getattr(Transaction, "__table__"))
        leg_table = cast(Table, getattr(TransactionLeg, "__table__"))
        before_value = self._normalize_datetime(before)

        statement = (
            select(func.coalesce(func.sum(leg_table.c.amount), 0))
            .join_from(
                leg_table, transaction_table, leg_table.c.transaction_id == transaction_table.c.id
            )
            .where(transaction_table.c.occurred_at < before_value)
        )
        statement = statement.where(transaction_table.c.user_id == self.user_id)
        statement = statement.where(leg_table.c.user_id == self.user_id)

        if account_ids:
            statement = statement.where(leg_table.c.account_id.in_(list(account_ids)))
        elif self._excluded_account_ids:
            statement = statement.where(
                ~leg_table.c.account_id.in_(list(self._excluded_account_ids))
            )

        scalar_result = cast(Any, self.session.exec(statement))
        if hasattr(scalar_result, "scalar_one"):
            result = scalar_result.scalar_one()
        elif hasattr(scalar_result, "one"):
            row = scalar_result.one()
            result = row[0] if isinstance(row, tuple) else row
        elif hasattr(scalar_result, "first"):
            row = scalar_result.first()
            result = row[0] if row and isinstance(row, tuple) else (row or 0)
        else:
            result = scalar_result or 0
        return coerce_decimal(result)

    def daily_deltas_between(
        self,
        *,
        start: datetime,
        end: datetime,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> List[Tuple[date, Decimal]]:
        transaction_table = cast(Table, getattr(Transaction, "__table__"))
        leg_table = cast(Table, getattr(TransactionLeg, "__table__"))
        day_column = func.date(transaction_table.c.occurred_at)
        start_value = self._normalize_datetime(start)
        end_value = self._normalize_datetime(end)

        statement = (
            select(day_column.label("day"), func.sum(leg_table.c.amount).label("delta"))
            .join_from(
                leg_table, transaction_table, leg_table.c.transaction_id == transaction_table.c.id
            )
            .where(transaction_table.c.occurred_at >= start_value)
            .where(transaction_table.c.occurred_at < end_value)
            .group_by(day_column)
            .order_by(day_column.asc())
        )

        statement = statement.where(transaction_table.c.user_id == self.user_id)
        statement = statement.where(leg_table.c.user_id == self.user_id)

        if account_ids:
            statement = statement.where(leg_table.c.account_id.in_(list(account_ids)))
        elif self._excluded_account_ids:
            statement = statement.where(
                ~leg_table.c.account_id.in_(list(self._excluded_account_ids))
            )

        rows = self.session.exec(statement).all()
        return [(self._coerce_date(day), coerce_decimal(delta)) for day, delta in rows]

    def average_daily_net(
        self, *, days: int = 90, account_ids: Optional[Iterable[UUID]] = None
    ) -> Decimal:
        """Compute average daily net change over a rolling window."""

        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        transaction_table = cast(Table, getattr(Transaction, "__table__"))
        leg_table = cast(Table, getattr(TransactionLeg, "__table__"))
        day_column = func.date(transaction_table.c.occurred_at)

        statement = (
            select(day_column.label("day"), func.sum(leg_table.c.amount).label("delta"))
            .join_from(
                leg_table, transaction_table, leg_table.c.transaction_id == transaction_table.c.id
            )
            .where(transaction_table.c.occurred_at >= cutoff)
            .group_by(day_column)
        )

        statement = statement.where(transaction_table.c.user_id == self.user_id)
        statement = statement.where(leg_table.c.user_id == self.user_id)

        if account_ids:
            statement = statement.where(leg_table.c.account_id.in_(list(account_ids)))
        elif self._excluded_account_ids:
            statement = statement.where(
                ~leg_table.c.account_id.in_(list(self._excluded_account_ids))
            )

        rows = self.session.exec(statement).all()
        if not rows:
            return Decimal("0")
        total = sum(coerce_decimal(delta) for _day, delta in rows)
        return total / Decimal(len(rows))

    def current_balance_total(self, account_ids: Optional[Iterable[UUID]] = None) -> Decimal:
        """Sum balances across accounts."""

        leg_table = cast(Table, getattr(TransactionLeg, "__table__"))
        statement = select(func.coalesce(func.sum(leg_table.c.amount), 0)).where(
            leg_table.c.user_id == self.user_id
        )
        if account_ids:
            statement = statement.where(leg_table.c.account_id.in_(list(account_ids)))
        elif self._excluded_account_ids:
            statement = statement.where(
                ~leg_table.c.account_id.in_(list(self._excluded_account_ids))
            )
        scalar_result = cast(Any, self.session.exec(statement))

        if hasattr(scalar_result, "scalar_one"):
            result = scalar_result.scalar_one()
        elif hasattr(scalar_result, "one"):
            row = scalar_result.one()
            result = row[0] if isinstance(row, tuple) else row
        elif hasattr(scalar_result, "first"):
            row = scalar_result.first()
            result = row[0] if row and isinstance(row, tuple) else (row or 0)
        else:
            result = scalar_result or 0

        return coerce_decimal(result)


__all__ = ["ReportingBalanceMixin"]
