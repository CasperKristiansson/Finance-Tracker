"""Core helpers for reporting service calculations."""

from __future__ import annotations

import calendar
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Iterable, List, Optional, Tuple
from uuid import UUID

from ..repositories.reporting import NetWorthPoint, ReportingRepository, TransactionAmountRow
from ..shared import AccountType, TransactionType, coerce_decimal


class ReportingServiceCoreMixin:
    """Shared report-classification and balance-series helpers."""

    repository: ReportingRepository

    def net_worth_history(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> List[NetWorthPoint]:
        ledger_points = self.repository.get_net_worth_history(account_ids=account_ids)
        if account_ids is not None:
            return ledger_points

        snapshots = self.repository.list_investment_snapshots_until(end=date.today())
        if not snapshots:
            return ledger_points

        investment_account_ids = self.repository.list_account_ids_by_type(AccountType.INVESTMENT)
        investment_ledger_points = (
            self.repository.get_net_worth_history(account_ids=investment_account_ids)
            if investment_account_ids
            else []
        )

        ledger_by_day = {point.period: coerce_decimal(point.net_worth) for point in ledger_points}
        investment_ledger_by_day = {
            point.period: coerce_decimal(point.net_worth) for point in investment_ledger_points
        }
        snapshot_days = {day for day, _value in snapshots}
        all_days = sorted(
            set(ledger_by_day.keys()) | set(investment_ledger_by_day.keys()) | snapshot_days
        )

        results: List[NetWorthPoint] = []
        running_ledger = Decimal("0")
        running_investment_ledger = Decimal("0")
        snap_idx = 0
        latest_investments = Decimal("0")
        investment_ledger_at_latest_snapshot = Decimal("0")

        for day in all_days:
            if day in ledger_by_day:
                running_ledger = ledger_by_day[day]
            if day in investment_ledger_by_day:
                running_investment_ledger = investment_ledger_by_day[day]
            while snap_idx < len(snapshots) and snapshots[snap_idx][0] <= day:
                latest_investments = coerce_decimal(snapshots[snap_idx][1])
                investment_ledger_at_latest_snapshot = running_investment_ledger
                snap_idx += 1
            results.append(
                NetWorthPoint(
                    period=day,
                    net_worth=running_ledger
                    + latest_investments
                    - investment_ledger_at_latest_snapshot,
                )
            )

        today = date.today()
        if results and results[-1].period != today:
            results.append(
                NetWorthPoint(
                    period=today,
                    net_worth=running_ledger
                    + latest_investments
                    - investment_ledger_at_latest_snapshot,
                )
            )

        return results

    @staticmethod
    def _month_end_dates(year: int) -> List[date]:
        return [date(year, month, calendar.monthrange(year, month)[1]) for month in range(1, 13)]

    def _month_end_balance_series(
        self,
        *,
        year: int,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> List[Tuple[date, Decimal]]:
        start = datetime(year, 1, 1, tzinfo=timezone.utc)
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        running = self.repository.sum_legs_before(before=start, account_ids=account_ids)
        daily = self.repository.daily_deltas_between(start=start, end=end, account_ids=account_ids)

        month_ends = self._month_end_dates(year)
        results: List[Tuple[date, Decimal]] = []
        idx = 0
        for month_end in month_ends:
            while idx < len(daily) and daily[idx][0] <= month_end:
                running += daily[idx][1]
                idx += 1
            results.append((month_end, running))
        return results

    @staticmethod
    def _merchant_key(raw: Optional[str]) -> str:
        value = (raw or "").strip()
        return value if value else "Unknown"

    @staticmethod
    def _classify_flows(
        row: TransactionAmountRow, *, account_scoped: bool
    ) -> Tuple[Decimal, Decimal, Decimal, Decimal]:
        """Return income, expense, adjustment inflow/outflow for reporting views."""

        if row.transaction_type == TransactionType.TRANSFER:
            return Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0")

        if row.transaction_type == TransactionType.ADJUSTMENT:
            amount = coerce_decimal(row.amount)
            if amount > 0:
                return Decimal("0"), Decimal("0"), amount, Decimal("0")
            if amount < 0:
                return Decimal("0"), Decimal("0"), Decimal("0"), -amount
            return Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0")

        income, expense = ReportingServiceCoreMixin._classify_income_expense(
            row, account_scoped=account_scoped
        )
        return income, expense, Decimal("0"), Decimal("0")

    @staticmethod
    def _classify_income_expense(
        row: TransactionAmountRow, *, account_scoped: bool
    ) -> Tuple[Decimal, Decimal]:
        """Return income/expense totals for reports.

        When a report is scoped to specific accounts (`account_ids` filter),
        transfers represent real money in/out for those accounts and should be
        included as income/expense. When not scoped, transfers are excluded to
        avoid double-counting.
        """

        if row.transaction_type == TransactionType.TRANSFER:
            return Decimal("0"), Decimal("0")

        if account_scoped:
            return coerce_decimal(row.inflow), coerce_decimal(row.outflow)

        amount = coerce_decimal(row.amount)
        if row.transaction_type == TransactionType.INCOME:
            return (amount if amount > 0 else -amount), Decimal("0")
        if row.transaction_type == TransactionType.EXPENSE:
            return Decimal("0"), (-amount if amount < 0 else amount)
        if row.transaction_type == TransactionType.ADJUSTMENT:
            if amount >= 0:
                return amount, Decimal("0")
            return Decimal("0"), -amount
        return Decimal("0"), Decimal("0")

    def _filtered_transaction_amounts(
        self,
        *,
        start: datetime,
        end: datetime,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
    ) -> List[TransactionAmountRow]:
        rows = self.repository.fetch_transaction_amounts(
            start=start, end=end, account_ids=account_ids
        )
        if category_ids:
            allowed = set(category_ids)
            rows = [row for row in rows if row.category_id in allowed]
        return rows


__all__ = ["ReportingServiceCoreMixin"]
