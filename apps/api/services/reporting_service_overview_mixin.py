"""Yearly overview-style operations for reporting service."""

from __future__ import annotations

import importlib
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Dict, Iterable, List, Optional, cast
from uuid import UUID

from sqlmodel import Session

from ..repositories.reporting import ReportingRepository, TransactionAmountRow
from ..shared import AccountType, coerce_decimal
from .reporting_service_core_mixin import ReportingServiceCoreMixin


class ReportingServiceOverviewMixin(ReportingServiceCoreMixin):
    """Yearly overview and category detail report helpers."""

    session: Session
    repository: ReportingRepository

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
        ) = importlib.import_module(
            "apps.api.services.reporting"
        ).build_yearly_overview_enhancements(
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


__all__ = ["ReportingServiceOverviewMixin"]
