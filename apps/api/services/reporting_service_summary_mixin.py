"""Summary report operations for reporting service."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Tuple
from uuid import UUID

from sqlmodel import Session

from ..repositories.reporting import (
    LifetimeTotals,
    MonthlyTotals,
    QuarterlyTotals,
    ReportingRepository,
    TransactionAmountRow,
    YearlyTotals,
)
from .reporting_service_core_mixin import ReportingServiceCoreMixin
from .reporting_total import build_total_overview


class ReportingServiceSummaryMixin(ReportingServiceCoreMixin):
    """Monthly/yearly/quarterly/date-range and summary operations."""

    session: Session
    repository: ReportingRepository

    def monthly_report(
        self,
        *,
        year: Optional[int] = None,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
    ) -> List[MonthlyTotals]:
        if year is not None:
            start = datetime(year, 1, 1, tzinfo=timezone.utc)
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            start = datetime(1900, 1, 1, tzinfo=timezone.utc)
            end = datetime.now(timezone.utc) + timedelta(days=1)

        rows = self._filtered_transaction_amounts(
            start=start,
            end=end,
            account_ids=account_ids,
            category_ids=category_ids,
        )

        buckets: Dict[date, Tuple[Decimal, Decimal, Decimal, Decimal]] = {}
        account_scoped = account_ids is not None
        for row in rows:
            income, expense, adjustment_inflow, adjustment_outflow = self._classify_flows(
                row, account_scoped=account_scoped
            )
            if income == 0 and expense == 0 and adjustment_inflow == 0 and adjustment_outflow == 0:
                continue
            period = date(row.occurred_at.year, row.occurred_at.month, 1)
            inc, exp, adj_in, adj_out = buckets.get(
                period, (Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0"))
            )
            buckets[period] = (
                inc + income,
                exp + expense,
                adj_in + adjustment_inflow,
                adj_out + adjustment_outflow,
            )

        results: List[MonthlyTotals] = []
        for period in sorted(buckets.keys()):
            income, expense, adjustment_inflow, adjustment_outflow = buckets[period]
            adjustment_net = adjustment_inflow - adjustment_outflow
            results.append(
                MonthlyTotals(
                    period=period,
                    income=income,
                    expense=expense,
                    adjustment_inflow=adjustment_inflow,
                    adjustment_outflow=adjustment_outflow,
                    adjustment_net=adjustment_net,
                    net=income - expense + adjustment_net,
                )
            )
        return results

    def yearly_report(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
    ) -> List[YearlyTotals]:
        start = datetime(1900, 1, 1, tzinfo=timezone.utc)
        end = datetime.now(timezone.utc) + timedelta(days=1)
        rows = self._filtered_transaction_amounts(
            start=start,
            end=end,
            account_ids=account_ids,
            category_ids=category_ids,
        )

        buckets: Dict[int, Tuple[Decimal, Decimal, Decimal, Decimal]] = {}
        account_scoped = account_ids is not None
        for row in rows:
            income, expense, adjustment_inflow, adjustment_outflow = self._classify_flows(
                row, account_scoped=account_scoped
            )
            if income == 0 and expense == 0 and adjustment_inflow == 0 and adjustment_outflow == 0:
                continue
            inc, exp, adj_in, adj_out = buckets.get(
                row.occurred_at.year, (Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0"))
            )
            buckets[row.occurred_at.year] = (
                inc + income,
                exp + expense,
                adj_in + adjustment_inflow,
                adj_out + adjustment_outflow,
            )

        results: List[YearlyTotals] = []
        for yr in sorted(buckets.keys()):
            income, expense, adjustment_inflow, adjustment_outflow = buckets[yr]
            adjustment_net = adjustment_inflow - adjustment_outflow
            results.append(
                YearlyTotals(
                    year=yr,
                    income=income,
                    expense=expense,
                    adjustment_inflow=adjustment_inflow,
                    adjustment_outflow=adjustment_outflow,
                    adjustment_net=adjustment_net,
                    net=income - expense + adjustment_net,
                )
            )
        return results

    def total_report(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> LifetimeTotals:
        start = datetime.combine(
            start_date or date(1900, 1, 1), datetime.min.time(), tzinfo=timezone.utc
        )
        end_bound = end_date or date.today()
        end = datetime.combine(
            end_bound + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
        )

        rows = self._filtered_transaction_amounts(
            start=start,
            end=end,
            account_ids=account_ids,
            category_ids=category_ids,
        )

        income_total = Decimal("0")
        expense_total = Decimal("0")
        adjustment_inflow = Decimal("0")
        adjustment_outflow = Decimal("0")
        account_scoped = account_ids is not None
        for row in rows:
            income, expense, adj_in, adj_out = self._classify_flows(
                row, account_scoped=account_scoped
            )
            income_total += income
            expense_total += expense
            adjustment_inflow += adj_in
            adjustment_outflow += adj_out
        adjustment_net = adjustment_inflow - adjustment_outflow
        return LifetimeTotals(
            income=income_total,
            expense=expense_total,
            adjustment_inflow=adjustment_inflow,
            adjustment_outflow=adjustment_outflow,
            adjustment_net=adjustment_net,
            net=income_total - expense_total + adjustment_net,
        )

    def total_overview(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        account_id_list = list(account_ids) if account_ids is not None else None
        as_of = date.today()
        history = self.net_worth_history(account_ids=account_id_list)
        net_worth_points = [(point.period, point.net_worth) for point in history]

        def classify_income_expense(row: TransactionAmountRow) -> Tuple[Decimal, Decimal]:
            return self._classify_income_expense(row, account_scoped=account_id_list is not None)

        return build_total_overview(
            session=self.session,
            repository=self.repository,
            as_of=as_of,
            account_id_list=account_id_list,
            net_worth_points=net_worth_points,
            classify_income_expense=classify_income_expense,
            merchant_key=self._merchant_key,
        )

    def dashboard_overview(
        self,
        *,
        year: int,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        monthly = self.monthly_report(year=year, account_ids=account_ids, category_ids=None)
        total = self.total_report(account_ids=account_ids, category_ids=None)
        net_worth = self.net_worth_history(account_ids=account_ids)
        return {
            "year": year,
            "monthly": monthly,
            "total": total,
            "net_worth": net_worth,
        }

    def quarterly_report(
        self,
        *,
        year: Optional[int] = None,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
    ) -> List[QuarterlyTotals]:
        if year is not None:
            start = datetime(year, 1, 1, tzinfo=timezone.utc)
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            start = datetime(1900, 1, 1, tzinfo=timezone.utc)
            end = datetime.now(timezone.utc) + timedelta(days=1)

        rows = self._filtered_transaction_amounts(
            start=start,
            end=end,
            account_ids=account_ids,
            category_ids=category_ids,
        )

        buckets: Dict[tuple[int, int], Tuple[Decimal, Decimal, Decimal, Decimal]] = {}
        account_scoped = account_ids is not None
        for row in rows:
            income, expense, adjustment_inflow, adjustment_outflow = self._classify_flows(
                row, account_scoped=account_scoped
            )
            if income == 0 and expense == 0 and adjustment_inflow == 0 and adjustment_outflow == 0:
                continue
            quarter = (row.occurred_at.month - 1) // 3 + 1
            key = (row.occurred_at.year, quarter)
            inc, exp, adj_in, adj_out = buckets.get(
                key, (Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0"))
            )
            buckets[key] = (
                inc + income,
                exp + expense,
                adj_in + adjustment_inflow,
                adj_out + adjustment_outflow,
            )

        results: List[QuarterlyTotals] = []
        for yr, qtr in sorted(buckets.keys()):
            income, expense, adjustment_inflow, adjustment_outflow = buckets[(yr, qtr)]
            adjustment_net = adjustment_inflow - adjustment_outflow
            results.append(
                QuarterlyTotals(
                    year=yr,
                    quarter=qtr,
                    income=income,
                    expense=expense,
                    adjustment_inflow=adjustment_inflow,
                    adjustment_outflow=adjustment_outflow,
                    adjustment_net=adjustment_net,
                    net=income - expense + adjustment_net,
                )
            )
        return results

    def date_range_report(
        self,
        *,
        start_date: date,
        end_date: date,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        source: Optional[str] = None,
    ) -> List[MonthlyTotals]:
        start = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
        end = datetime.combine(
            end_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
        )

        rows = self._filtered_transaction_amounts(
            start=start,
            end=end,
            account_ids=account_ids,
            category_ids=category_ids,
        )
        if source:
            rows = [row for row in rows if self._merchant_key(row.description) == source]

        buckets: Dict[date, Tuple[Decimal, Decimal, Decimal, Decimal]] = {}
        account_scoped = account_ids is not None
        for row in rows:
            income, expense, adjustment_inflow, adjustment_outflow = self._classify_flows(
                row, account_scoped=account_scoped
            )
            if income == 0 and expense == 0 and adjustment_inflow == 0 and adjustment_outflow == 0:
                continue
            period = date(row.occurred_at.year, row.occurred_at.month, 1)
            inc, exp, adj_in, adj_out = buckets.get(
                period, (Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0"))
            )
            buckets[period] = (
                inc + income,
                exp + expense,
                adj_in + adjustment_inflow,
                adj_out + adjustment_outflow,
            )

        results: List[MonthlyTotals] = []
        for period in sorted(buckets.keys()):
            income, expense, adjustment_inflow, adjustment_outflow = buckets[period]
            adjustment_net = adjustment_inflow - adjustment_outflow
            results.append(
                MonthlyTotals(
                    period=period,
                    income=income,
                    expense=expense,
                    adjustment_inflow=adjustment_inflow,
                    adjustment_outflow=adjustment_outflow,
                    adjustment_net=adjustment_net,
                    net=income - expense + adjustment_net,
                )
            )
        return results

    def refresh_materialized_views(
        self,
        view_names: Iterable[str],
        *,
        concurrently: bool = False,
    ) -> None:
        self.repository.refresh_materialized_views(
            view_names,
            concurrently=concurrently,
        )


__all__ = ["ReportingServiceSummaryMixin"]
