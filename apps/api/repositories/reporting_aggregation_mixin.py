"""Aggregate report query methods for reporting repository."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Dict, Iterable, List, Optional
from uuid import UUID

from .reporting_core_mixin import ReportingCoreMixin
from .reporting_types import (
    DecimalTotals,
    LifetimeTotals,
    MonthlyTotals,
    QuarterlyTotals,
    YearlyTotals,
)


class ReportingAggregationMixin(ReportingCoreMixin):
    """Monthly/yearly/lifetime/quarterly aggregate helpers."""

    def get_monthly_totals(
        self,
        *,
        year: Optional[int] = None,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[MonthlyTotals]:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
            start_date=start_date,
            end_date=end_date,
        )

        buckets: Dict[date, DecimalTotals] = {}

        for occurred_at, amount, tx_type in legs:
            if year is not None and occurred_at.year != year:
                continue

            period = date(occurred_at.year, occurred_at.month, 1)
            income, expense, adjustment_inflow, adjustment_outflow = buckets.get(
                period, (Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0"))
            )
            income, expense, adjustment_inflow, adjustment_outflow = self._accumulate(
                amount=amount,
                transaction_type=tx_type,
                income=income,
                expense=expense,
                adjustment_inflow=adjustment_inflow,
                adjustment_outflow=adjustment_outflow,
            )
            buckets[period] = (income, expense, adjustment_inflow, adjustment_outflow)

        results: List[MonthlyTotals] = []
        for period in sorted(buckets.keys()):
            income, expense, adjustment_inflow, adjustment_outflow = buckets[period]
            adjustment_net = adjustment_inflow - adjustment_outflow
            net = income - expense + adjustment_net
            results.append(
                MonthlyTotals(
                    period=period,
                    income=income,
                    expense=expense,
                    adjustment_inflow=adjustment_inflow,
                    adjustment_outflow=adjustment_outflow,
                    adjustment_net=adjustment_net,
                    net=net,
                )
            )
        return results

    def get_yearly_totals(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[YearlyTotals]:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
            start_date=start_date,
            end_date=end_date,
        )

        buckets: Dict[int, DecimalTotals] = {}

        for occurred_at, amount, tx_type in legs:
            income, expense, adjustment_inflow, adjustment_outflow = buckets.get(
                occurred_at.year, (Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0"))
            )
            income, expense, adjustment_inflow, adjustment_outflow = self._accumulate(
                amount=amount,
                transaction_type=tx_type,
                income=income,
                expense=expense,
                adjustment_inflow=adjustment_inflow,
                adjustment_outflow=adjustment_outflow,
            )
            buckets[occurred_at.year] = (income, expense, adjustment_inflow, adjustment_outflow)

        results: List[YearlyTotals] = []
        for year in sorted(buckets.keys()):
            income, expense, adjustment_inflow, adjustment_outflow = buckets[year]
            adjustment_net = adjustment_inflow - adjustment_outflow
            net = income - expense + adjustment_net
            results.append(
                YearlyTotals(
                    year=year,
                    income=income,
                    expense=expense,
                    adjustment_inflow=adjustment_inflow,
                    adjustment_outflow=adjustment_outflow,
                    adjustment_net=adjustment_net,
                    net=net,
                )
            )
        return results

    def get_total_summary(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> LifetimeTotals:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
            start_date=start_date,
            end_date=end_date,
        )

        income_total = Decimal("0")
        expense_total = Decimal("0")
        adjustment_inflow = Decimal("0")
        adjustment_outflow = Decimal("0")

        for _occurred_at, amount, tx_type in legs:
            income_total, expense_total, adjustment_inflow, adjustment_outflow = self._accumulate(
                amount=amount,
                transaction_type=tx_type,
                income=income_total,
                expense=expense_total,
                adjustment_inflow=adjustment_inflow,
                adjustment_outflow=adjustment_outflow,
            )

        adjustment_net = adjustment_inflow - adjustment_outflow
        net_total = income_total - expense_total + adjustment_net
        return LifetimeTotals(
            income=income_total,
            expense=expense_total,
            adjustment_inflow=adjustment_inflow,
            adjustment_outflow=adjustment_outflow,
            adjustment_net=adjustment_net,
            net=net_total,
        )

    def get_quarterly_totals(
        self,
        *,
        year: Optional[int] = None,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
    ) -> List[QuarterlyTotals]:
        legs = self._fetch_legs(
            account_ids=account_ids,
            category_ids=category_ids,
        )

        buckets: Dict[tuple[int, int], DecimalTotals] = {}

        for occurred_at, amount, tx_type in legs:
            if year is not None and occurred_at.year != year:
                continue
            quarter = (occurred_at.month - 1) // 3 + 1
            key = (occurred_at.year, quarter)
            income, expense, adjustment_inflow, adjustment_outflow = buckets.get(
                key, (Decimal("0"), Decimal("0"), Decimal("0"), Decimal("0"))
            )
            income, expense, adjustment_inflow, adjustment_outflow = self._accumulate(
                amount=amount,
                transaction_type=tx_type,
                income=income,
                expense=expense,
                adjustment_inflow=adjustment_inflow,
                adjustment_outflow=adjustment_outflow,
            )
            buckets[key] = (income, expense, adjustment_inflow, adjustment_outflow)

        results: List[QuarterlyTotals] = []
        for yr, qtr in sorted(buckets.keys()):
            income, expense, adjustment_inflow, adjustment_outflow = buckets[(yr, qtr)]
            adjustment_net = adjustment_inflow - adjustment_outflow
            net = income - expense + adjustment_net
            results.append(
                QuarterlyTotals(
                    year=yr,
                    quarter=qtr,
                    income=income,
                    expense=expense,
                    adjustment_inflow=adjustment_inflow,
                    adjustment_outflow=adjustment_outflow,
                    adjustment_net=adjustment_net,
                    net=net,
                )
            )
        return results

    def get_range_monthly_totals(
        self,
        *,
        start_date: date,
        end_date: date,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
    ) -> List[MonthlyTotals]:
        return self.get_monthly_totals(
            account_ids=account_ids,
            category_ids=category_ids,
            start_date=start_date,
            end_date=end_date,
        )


__all__ = ["ReportingAggregationMixin"]
