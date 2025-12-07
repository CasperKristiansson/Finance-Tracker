"""Reporting aggregation helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple, cast
from uuid import UUID

from sqlalchemy import Table, desc, func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import Session, select

from ..models import Account, Transaction, TransactionLeg
from ..models.investment_snapshot import InvestmentSnapshot
from ..shared import TransactionType, coerce_decimal, get_default_user_id

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
class QuarterlyTotals:
    """Aggregate totals for a specific quarter."""

    year: int
    quarter: int
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
        self.user_id: str = str(session.info.get("user_id") or get_default_user_id())
        self._excluded_account_ids: set[UUID] = set(
            acc_id
            for acc_id in session.exec(
                select(Account.id).where(
                    Account.user_id == self.user_id,
                    cast(Any, Account.name).in_(["Offset", "Unassigned"]),
                )
            ).all()
        )

    def get_monthly_totals(
        self,
        *,
        year: Optional[int] = None,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[MonthlyTotals]:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
            start_date=start_date,
            end_date=end_date,
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
        subscription_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[YearlyTotals]:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
            start_date=start_date,
            end_date=end_date,
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
        subscription_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> LifetimeTotals:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
            start_date=start_date,
            end_date=end_date,
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

    def average_daily_net(self, *, days: int = 90) -> Decimal:
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

    def latest_investment_value(self) -> Decimal:
        """Best-effort latest investment portfolio value."""

        statement = (
            select(
                cast(Any, InvestmentSnapshot.snapshot_date),
                cast(Any, InvestmentSnapshot.portfolio_value),
            )
            .order_by(cast(Any, InvestmentSnapshot.snapshot_date).desc())
            .limit(1)
        )
        statement = statement.where(InvestmentSnapshot.user_id == self.user_id)
        row = self.session.exec(statement).first()
        if not row:
            return Decimal("0")
        _, value = row
        return coerce_decimal(value or 0)

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

    def get_quarterly_totals(
        self,
        *,
        year: Optional[int] = None,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[QuarterlyTotals]:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
        )

        buckets: Dict[tuple[int, int], DecimalTotals] = {}

        for occurred_at, amount in legs:
            if year is not None and occurred_at.year != year:
                continue
            quarter = (occurred_at.month - 1) // 3 + 1
            key = (occurred_at.year, quarter)
            income, expense = buckets.get(key, (Decimal("0"), Decimal("0")))
            income, expense = self._accumulate(amount, income, expense)
            buckets[key] = (income, expense)

        results: List[QuarterlyTotals] = []
        for yr, qtr in sorted(buckets.keys()):
            income, expense = buckets[(yr, qtr)]
            net = income - expense
            results.append(
                QuarterlyTotals(year=yr, quarter=qtr, income=income, expense=expense, net=net)
            )
        return results

    def get_range_monthly_totals(
        self,
        *,
        start_date: date,
        end_date: date,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[MonthlyTotals]:
        return self.get_monthly_totals(
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
            start_date=start_date,
            end_date=end_date,
        )

    def _fetch_legs(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
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
        if subscription_ids:
            statement = statement.where(
                transaction_table.c.subscription_id.in_(list(subscription_ids))
            )
        if start_date:
            statement = statement.where(transaction_table.c.occurred_at >= start_date)
        if end_date:
            statement = statement.where(transaction_table.c.occurred_at <= end_date)

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
    "QuarterlyTotals",
    "LifetimeTotals",
    "NetWorthPoint",
]
