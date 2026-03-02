"""Service layer for reporting aggregation helpers."""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, Tuple, cast
from uuid import UUID

from sqlmodel import Session

from ..repositories.reporting import (
    LifetimeTotals,
    MonthlyTotals,
    NetWorthPoint,
    QuarterlyTotals,
    ReportingRepository,
    TransactionAmountRow,
    YearlyTotals,
)
from ..shared import AccountType, TransactionType, coerce_decimal
from .reporting_projection_mixin import ReportingProjectionMixin
from .reporting_total import build_total_overview
from .reporting_yearly import build_yearly_overview_enhancements


class ReportingService(ReportingProjectionMixin):
    """Coordinates access to reporting aggregations and utilities."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = ReportingRepository(session)

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
        net_worth_points = [(point.period, coerce_decimal(point.net_worth)) for point in history]

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

        income, expense = ReportingService._classify_income_expense(
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

    def yearly_overview(
        self,
        *,
        year: int,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        account_id_list = list(account_ids) if account_ids is not None else None
        start = datetime(year, 1, 1, tzinfo=timezone.utc)
        year_end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        as_of_date = min(date.today(), date(year, 12, 31))
        end = datetime.combine(
            as_of_date + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc
        )
        end = min(end, year_end)
        prev_start = datetime(year - 1, 1, 1, tzinfo=timezone.utc)
        prev_end = datetime(year, 1, 1, tzinfo=timezone.utc)

        rows = self.repository.fetch_transaction_amounts(
            start=start, end=end, account_ids=account_id_list
        )
        prev_rows = self.repository.fetch_transaction_amounts(
            start=prev_start, end=prev_end, account_ids=account_id_list
        )

        monthly_income = [Decimal("0") for _ in range(12)]
        monthly_expense = [Decimal("0") for _ in range(12)]

        expense_by_category: Dict[str, Dict[str, object]] = {}
        income_by_category: Dict[str, Dict[str, object]] = {}
        merchants: Dict[str, Dict[str, object]] = {}
        largest_expenses: List[Dict[str, object]] = []

        account_scoped = account_id_list is not None
        for row in rows:
            month_idx = row.occurred_at.month - 1
            income, expense = self._classify_income_expense(row, account_scoped=account_scoped)
            monthly_income[month_idx] += income
            monthly_expense[month_idx] += expense

            if income > 0:
                category_key = str(row.category_id or "uncategorized")
                if category_key not in income_by_category:
                    income_by_category[category_key] = {
                        "category_id": row.category_id,
                        "category_name": row.category_name or "Uncategorized",
                        "icon": row.category_icon,
                        "color_hex": row.category_color_hex,
                        "total": Decimal("0"),
                        "monthly": [Decimal("0") for _ in range(12)],
                        "transaction_count": 0,
                    }
                bucket = income_by_category[category_key]
                bucket["total"] = cast(Decimal, bucket["total"]) + income
                monthly_list = cast(List[Decimal], bucket["monthly"])
                monthly_list[month_idx] += income
                bucket["transaction_count"] = cast(int, bucket["transaction_count"]) + 1

            if expense > 0:
                category_key = str(row.category_id or "uncategorized")
                if category_key not in expense_by_category:
                    expense_by_category[category_key] = {
                        "category_id": row.category_id,
                        "category_name": row.category_name or "Uncategorized",
                        "icon": row.category_icon,
                        "color_hex": row.category_color_hex,
                        "total": Decimal("0"),
                        "monthly": [Decimal("0") for _ in range(12)],
                        "transaction_count": 0,
                    }
                bucket = expense_by_category[category_key]
                bucket["total"] = cast(Decimal, bucket["total"]) + expense
                monthly_list = cast(List[Decimal], bucket["monthly"])
                monthly_list[month_idx] += expense
                bucket["transaction_count"] = cast(int, bucket["transaction_count"]) + 1

                merchant_key = self._merchant_key(row.description)
                if merchant_key not in merchants:
                    merchants[merchant_key] = {
                        "merchant": merchant_key,
                        "amount": Decimal("0"),
                        "transaction_count": 0,
                    }
                merchants[merchant_key]["amount"] = (
                    cast(Decimal, merchants[merchant_key]["amount"]) + expense
                )
                merchants[merchant_key]["transaction_count"] = (
                    cast(int, merchants[merchant_key]["transaction_count"]) + 1
                )

                largest_expenses.append(
                    {
                        "id": str(row.id),
                        "occurred_at": row.occurred_at.isoformat(),
                        "merchant": merchant_key,
                        "amount": expense,
                        "category_id": str(row.category_id) if row.category_id else None,
                        "category_name": row.category_name or "Uncategorized",
                        "notes": row.notes,
                    }
                )

        total_income = sum(monthly_income, Decimal("0"))
        total_expense = sum(monthly_expense, Decimal("0"))
        net_savings = total_income - total_expense
        savings_rate = (net_savings / total_income * Decimal("100")) if total_income > 0 else None

        avg_monthly_spend = (total_expense / Decimal("12")) if total_expense > 0 else Decimal("0")
        biggest_income_month = max(range(12), key=lambda idx: monthly_income[idx])
        biggest_expense_month = max(range(12), key=lambda idx: monthly_expense[idx])

        # Month-end time series.
        net_worth_series = self._month_end_balance_series(year=year, account_ids=account_id_list)
        debt_ids = self.repository.list_account_ids_by_type(
            AccountType.DEBT, account_ids=account_id_list
        )
        debt_series = (
            self._month_end_balance_series(year=year, account_ids=debt_ids) if debt_ids else []
        )

        # Investments only apply to full net worth (no account filter).
        if account_id_list is None:
            net_worth_history = self.net_worth_history(account_ids=None)
            month_ends = self._month_end_dates(year)
            net_worth_points: List[Dict[str, object]] = []
            idx = 0
            latest_value = Decimal("0")
            for month_end in month_ends:
                while idx < len(net_worth_history) and net_worth_history[idx].period <= month_end:
                    latest_value = coerce_decimal(net_worth_history[idx].net_worth)
                    idx += 1
                net_worth_points.append({"date": month_end.isoformat(), "net_worth": latest_value})
        else:
            net_worth_points = [
                {"date": d.isoformat(), "net_worth": bal} for d, bal in net_worth_series
            ]
        debt_points = [
            {"date": d.isoformat(), "debt": -bal if bal < 0 else bal} for d, bal in debt_series
        ]

        def build_category_breakdown(
            categories_sorted: List[Dict[str, object]],
        ) -> List[Dict[str, object]]:
            top = categories_sorted[:8]
            rest = categories_sorted[8:]
            other_total = sum((cast(Decimal, item["total"]) for item in rest), Decimal("0"))
            other_monthly = [Decimal("0") for _ in range(12)]
            for item in rest:
                for idx, value in enumerate(cast(List[Decimal], item["monthly"])):
                    other_monthly[idx] += value
            breakdown = [
                {
                    "category_id": str(item["category_id"]) if item["category_id"] else None,
                    "name": cast(str, item["category_name"]),
                    "total": cast(Decimal, item["total"]),
                    "monthly": cast(List[Decimal], item["monthly"]),
                    "icon": item["icon"],
                    "color_hex": item["color_hex"],
                    "transaction_count": item["transaction_count"],
                }
                for item in top
            ]
            if other_total > 0:
                breakdown.append(
                    {
                        "category_id": None,
                        "name": "Other",
                        "total": other_total,
                        "monthly": other_monthly,
                        "icon": None,
                        "color_hex": None,
                        "transaction_count": sum(
                            cast(int, item["transaction_count"]) for item in rest
                        ),
                    }
                )
            return breakdown

        # Expense top categories (top 8 + other).
        categories_sorted = sorted(
            expense_by_category.values(),
            key=lambda item: cast(Decimal, item["total"]),
            reverse=True,
        )
        category_breakdown = build_category_breakdown(categories_sorted)

        # Income top categories (top 8 + other).
        income_categories_sorted = sorted(
            income_by_category.values(),
            key=lambda item: cast(Decimal, item["total"]),
            reverse=True,
        )
        income_category_breakdown = build_category_breakdown(income_categories_sorted)

        merchants_rows = []
        for entry in merchants.values():
            merchant_name = cast(str, entry["merchant"])
            amount = cast(Decimal, entry["amount"])
            merchants_rows.append(
                {
                    "merchant": merchant_name,
                    "amount": amount,
                    "transaction_count": entry["transaction_count"],
                }
            )
        merchants_rows.sort(key=lambda item: cast(Decimal, item["amount"]), reverse=True)

        largest_expenses.sort(key=lambda item: cast(Decimal, item["amount"]), reverse=True)

        # Category changes YoY (ranked by increased spend).
        prev_category_totals: Dict[str, Decimal] = {}
        for row in prev_rows:
            _, expense = self._classify_income_expense(row, account_scoped=account_scoped)
            if expense <= 0:
                continue
            key = str(row.category_id or "uncategorized")
            prev_category_totals[key] = prev_category_totals.get(key, Decimal("0")) + expense

        category_changes = []
        for item in categories_sorted:
            key = str(item["category_id"] or "uncategorized")
            current_amount = cast(Decimal, item["total"])
            prev_amount = prev_category_totals.get(key, Decimal("0"))
            delta = current_amount - prev_amount
            delta_pct = None
            if prev_amount > 0:
                delta_pct = delta / prev_amount * Decimal("100")
            category_changes.append(
                {
                    "category_id": str(item["category_id"]) if item["category_id"] else None,
                    "name": cast(str, item["category_name"]),
                    "amount": current_amount,
                    "prev_amount": prev_amount,
                    "delta": delta,
                    "delta_pct": delta_pct,
                }
            )
        category_changes.sort(key=lambda item: cast(Decimal, item["delta"]), reverse=True)

        # Insights.
        insights: List[str] = []
        prev_total_expense = sum(
            (
                self._classify_income_expense(row, account_scoped=account_scoped)[1]
                for row in prev_rows
            ),
            Decimal("0"),
        )
        if prev_total_expense > 0 and total_expense > 0:
            yoy = (total_expense - prev_total_expense) / prev_total_expense * Decimal("100")
            insights.append(f"Your spend changed {yoy.quantize(Decimal('1'))}% YoY.")
        drivers = [c for c in category_changes if cast(Decimal, c["delta"]) > 0][:2]
        if drivers:
            insights.append(
                "Biggest drivers: "
                + ", ".join(
                    f"{c['name']} ({cast(Decimal, c['delta']).quantize(Decimal('1'))} kr)"
                    for c in drivers
                )
                + "."
            )
        # Unusual months: top 3 expense months if they stand out.
        expenses_float = [float(v) for v in monthly_expense]
        if any(expenses_float):
            avg = sum(expenses_float) / 12.0
            variance = sum((v - avg) ** 2 for v in expenses_float) / 12.0
            std = variance**0.5
            if std > 0:
                unusual = [
                    idx for idx, value in enumerate(expenses_float) if value > avg + (1.5 * std)
                ][:3]
                if unusual:
                    month_names = [date(year, idx + 1, 1).strftime("%B") for idx in unusual]
                    insights.append("Unusually high months: " + ", ".join(month_names) + ".")

        def _classify_income_expense(row: TransactionAmountRow) -> tuple[Decimal, Decimal]:
            return self._classify_income_expense(row, account_scoped=account_id_list is not None)

        def _month_end_balance(yr: int, ids: list[UUID] | None) -> list[tuple[date, Decimal]]:
            return self._month_end_balance_series(year=yr, account_ids=ids)

        (
            investments_summary,
            debt_overview,
            account_flows,
            income_sources_rows,
            expense_sources_rows,
        ) = build_yearly_overview_enhancements(
            session=self.session,
            repository=self.repository,
            year=year,
            start=start,
            end=end,
            as_of_date=as_of_date,
            account_id_list=account_id_list,
            rows=rows,
            classify_income_expense=_classify_income_expense,
            merchant_key=self._merchant_key,
            month_end_balance_series=_month_end_balance,
            month_end_dates=self._month_end_dates,
        )

        return {
            "year": year,
            "monthly": [
                {
                    "month": month + 1,
                    "date": date(year, month + 1, 1).isoformat(),
                    "income": monthly_income[month],
                    "expense": monthly_expense[month],
                    "net": monthly_income[month] - monthly_expense[month],
                }
                for month in range(12)
            ],
            "net_worth": net_worth_points,
            "debt": debt_points,
            "savings": {
                "income": total_income,
                "expense": total_expense,
                "saved": net_savings,
                "savings_rate_pct": savings_rate,
            },
            "stats": {
                "total_income": total_income,
                "total_expense": total_expense,
                "net_savings": net_savings,
                "savings_rate_pct": savings_rate,
                "avg_monthly_spend": avg_monthly_spend,
                "biggest_income_month": {
                    "month": biggest_income_month + 1,
                    "amount": monthly_income[biggest_income_month],
                },
                "biggest_expense_month": {
                    "month": biggest_expense_month + 1,
                    "amount": monthly_expense[biggest_expense_month],
                },
            },
            "category_breakdown": category_breakdown,
            "income_category_breakdown": income_category_breakdown,
            "top_merchants": merchants_rows[:10],
            "largest_transactions": largest_expenses[:10],
            "category_changes": category_changes[:10],
            "investments_summary": investments_summary,
            "debt_overview": debt_overview,
            "account_flows": account_flows,
            "income_sources": income_sources_rows[:50],
            "expense_sources": expense_sources_rows[:50],
            "insights": insights[:6],
        }

    def yearly_overview_range(
        self,
        *,
        start_year: int,
        end_year: int,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> list[dict[str, object]]:
        return [
            self.yearly_overview(year=year, account_ids=account_ids)
            for year in range(start_year, end_year + 1)
        ]

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

    def yearly_category_detail(
        self,
        *,
        year: int,
        category_id: UUID,
        flow: str = "expense",
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        start = datetime(year, 1, 1, tzinfo=timezone.utc)
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        rows = self.repository.fetch_transaction_amounts(
            start=start, end=end, account_ids=account_ids
        )

        monthly = [Decimal("0") for _ in range(12)]
        merchants: Dict[str, Dict[str, object]] = {}
        account_scoped = account_ids is not None
        for row in rows:
            if row.category_id != category_id:
                continue
            income, expense = self._classify_income_expense(row, account_scoped=account_scoped)
            amount = income if flow == "income" else expense
            if amount <= 0:
                continue
            idx = row.occurred_at.month - 1
            monthly[idx] += amount
            merchant_key = self._merchant_key(row.description)
            if merchant_key not in merchants:
                merchants[merchant_key] = {
                    "merchant": merchant_key,
                    "amount": Decimal("0"),
                    "transaction_count": 0,
                }
            merchants[merchant_key]["amount"] = (
                cast(Decimal, merchants[merchant_key]["amount"]) + amount
            )
            merchants[merchant_key]["transaction_count"] = (
                cast(int, merchants[merchant_key]["transaction_count"]) + 1
            )

        merchants_rows = sorted(
            merchants.values(), key=lambda item: cast(Decimal, item["amount"]), reverse=True
        )

        category_name = next(
            (
                row.category_name
                for row in rows
                if row.category_id == category_id and row.category_name
            ),
            None,
        )

        return {
            "year": year,
            "category_id": str(category_id),
            "category_name": category_name or "Category",
            "monthly": [
                {
                    "month": idx + 1,
                    "date": date(year, idx + 1, 1).isoformat(),
                    "amount": monthly[idx],
                }
                for idx in range(12)
            ],
            "top_merchants": merchants_rows[:10],
        }

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


__all__ = [
    "ReportingService",
    "MonthlyTotals",
    "YearlyTotals",
    "QuarterlyTotals",
    "LifetimeTotals",
    "NetWorthPoint",
]
