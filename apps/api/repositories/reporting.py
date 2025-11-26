"""Reporting aggregation helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Sequence, Tuple, cast
from uuid import UUID

from sqlalchemy import Table, desc, func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from ..models import Transaction, TransactionLeg
from ..shared import coerce_decimal

DecimalTotals = Tuple[Decimal, Decimal]


@dataclass(frozen=True)
class MonthlyTotals:
    """Aggregate totals for a specific month."""

    period: date
    income: Decimal
    expense: Decimal
    net: Decimal


@dataclass(frozen=True)
class YearlyTotals:
    """Aggregate totals for a specific year."""

    year: int
    income: Decimal
    expense: Decimal
    net: Decimal


@dataclass(frozen=True)
class LifetimeTotals:
    """Overall totals across the queried dataset."""

    income: Decimal
    expense: Decimal
    net: Decimal


@dataclass(frozen=True)
class NetWorthPoint:
    """Net worth value at a point in time."""

    period: date
    net_worth: Decimal


class ReportingRepository:
    """Provides reporting-oriented aggregation helpers."""

    def __init__(self, session: Session):
        self.session = session

    def get_monthly_totals(
        self,
        *,
        year: Optional[int] = None,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
    ) -> List[MonthlyTotals]:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
        )

        buckets: Dict[date, DecimalTotals] = {}

        for occurred_at, amount in legs:
            if year is not None and occurred_at.year != year:
                continue

            period = date(occurred_at.year, occurred_at.month, 1)
            income, expense = buckets.get(period, (Decimal("0"), Decimal("0")))
            income, expense = self._accumulate(amount, income, expense)
            buckets[period] = (income, expense)

        results: List[MonthlyTotals] = []
        for period in sorted(buckets.keys()):
            income, expense = buckets[period]
            net = income - expense
            results.append(MonthlyTotals(period=period, income=income, expense=expense, net=net))
        return results

    def get_yearly_totals(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
    ) -> List[YearlyTotals]:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
        )

        buckets: Dict[int, DecimalTotals] = {}

        for occurred_at, amount in legs:
            income, expense = buckets.get(occurred_at.year, (Decimal("0"), Decimal("0")))
            income, expense = self._accumulate(amount, income, expense)
            buckets[occurred_at.year] = (income, expense)

        results: List[YearlyTotals] = []
        for year in sorted(buckets.keys()):
            income, expense = buckets[year]
            net = income - expense
            results.append(YearlyTotals(year=year, income=income, expense=expense, net=net))
        return results

    def get_total_summary(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
    ) -> LifetimeTotals:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
        )

        income_total = Decimal("0")
        expense_total = Decimal("0")

        for _occurred_at, amount in legs:
            income_total, expense_total = self._accumulate(amount, income_total, expense_total)

        net_total = income_total - expense_total
        return LifetimeTotals(income=income_total, expense=expense_total, net=net_total)

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

        if account_ids:
            statement = statement.where(leg_table.c.account_id.in_(list(account_ids)))

        rows = self.session.exec(statement).all()

        history: List[NetWorthPoint] = []
        running_total = Decimal("0")

        for period_value, delta in rows:
            period = self._coerce_date(period_value)
            running_total += coerce_decimal(delta)
            history.append(NetWorthPoint(period=period, net_worth=running_total))

        return history

    def refresh_materialized_views(
        self,
        view_names: Iterable[str],
        *,
        concurrently: bool = False,
    ) -> None:
        """Refresh materialized views when supported by the database."""

        bind = self.session.get_bind()
        dialect = getattr(bind, "dialect", None)
        if dialect is None or getattr(dialect, "name", "") != "postgresql":
            # SQLite (tests) and other engines simply skip refresh logic.
            return

        keyword = " CONCURRENTLY" if concurrently else ""
        for view_name in view_names:
            statement = text(f"REFRESH MATERIALIZED VIEW{keyword} {view_name}")
            try:
                self.session.execute(statement)
                self.session.commit()
            except SQLAlchemyError:
                self.session.rollback()
                raise

    def _fetch_legs(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
    ) -> Sequence[Tuple[datetime, Decimal]]:
        transaction_table = cast(Table, getattr(Transaction, "__table__"))
        leg_table = cast(Table, getattr(TransactionLeg, "__table__"))

        statement = (
            select(transaction_table.c.occurred_at, leg_table.c.amount)
            .join_from(
                leg_table, transaction_table, leg_table.c.transaction_id == transaction_table.c.id
            )
            .order_by(desc(transaction_table.c.occurred_at))
        )

        if account_ids:
            statement = statement.where(leg_table.c.account_id.in_(list(account_ids)))
        if category_ids:
            statement = statement.where(transaction_table.c.category_id.in_(list(category_ids)))

        rows = self.session.exec(statement).all()
        return [(occurred_at, coerce_decimal(amount)) for occurred_at, amount in rows]

    @staticmethod
    def _accumulate(
        amount: Decimal,
        income: Decimal,
        expense: Decimal,
    ) -> DecimalTotals:
        amount = coerce_decimal(amount)
        if amount > 0:
            income += amount
        elif amount < 0:
            expense += -amount
        return income, expense

    @staticmethod
    def _coerce_date(raw: object) -> date:
        if isinstance(raw, date):
            return raw
        return date.fromisoformat(str(raw))


__all__ = [
    "ReportingRepository",
    "MonthlyTotals",
    "YearlyTotals",
    "LifetimeTotals",
    "NetWorthPoint",
]
