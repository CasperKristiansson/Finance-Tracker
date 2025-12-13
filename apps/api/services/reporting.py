"""Service layer for reporting aggregation helpers."""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
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


class ReportingService:
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
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[MonthlyTotals]:
        return self.repository.get_monthly_totals(
            year=year,
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
        )

    def yearly_report(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[YearlyTotals]:
        return self.repository.get_yearly_totals(
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
        )

    def total_report(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> LifetimeTotals:
        return self.repository.get_total_summary(
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
            start_date=start_date,
            end_date=end_date,
        )

    def net_worth_history(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> List[NetWorthPoint]:
        return self.repository.get_net_worth_history(account_ids=account_ids)

    def cashflow_forecast(
        self,
        *,
        days: int = 60,
        threshold: Decimal = Decimal("0"),
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        current_balance = self.repository.current_balance_total(account_ids=account_ids)
        avg_daily = self.repository.average_daily_net(account_ids=account_ids)
        points: list[tuple[str, Decimal]] = []
        alert_at: Optional[str] = None
        running = current_balance
        for day in range(1, days + 1):
            running += avg_daily
            iso = (datetime.now(timezone.utc).date() + timedelta(days=day)).isoformat()
            points.append((iso, running))
            if alert_at is None and running < threshold:
                alert_at = iso
        return {
            "starting_balance": current_balance,
            "average_daily": avg_daily,
            "points": [{"date": d, "balance": v} for d, v in points],
            "alert_below_threshold_at": alert_at,
            "threshold": threshold,
        }

    @staticmethod
    def _add_months(start: date, months: int) -> date:
        month_index = (start.month - 1) + months
        year = start.year + (month_index // 12)
        month = (month_index % 12) + 1
        day = min(start.day, calendar.monthrange(year, month)[1])
        return date(year, month, day)

    def net_worth_projection(
        self,
        *,
        months: int = 36,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        history = self.repository.get_net_worth_history(account_ids=account_ids)

        investment_value = (
            self.repository.latest_investment_value() if account_ids is None else Decimal("0")
        )
        current = self.repository.current_balance_total(account_ids=account_ids) + investment_value

        if not history:
            return {"current": current, "cagr": None, "points": []}

        monthly: dict[tuple[int, int], tuple[date, Decimal]] = {}
        for point in history:
            key = (point.period.year, point.period.month)
            monthly[key] = (point.period, point.net_worth)
        monthly_points = [monthly[key] for key in sorted(monthly.keys())]

        end_period, end_value = monthly_points[-1]
        if investment_value:
            end_value += investment_value

        # Prefer a 12-month CAGR window when available; fallback to earliest positive value.
        cagr: Decimal | None = None
        start_idx = max(0, len(monthly_points) - 13)
        start_period, start_value = monthly_points[start_idx]
        if start_value <= 0:
            for i in range(start_idx, -1, -1):
                candidate_period, candidate_value = monthly_points[i]
                if candidate_value > 0:
                    start_period, start_value = candidate_period, candidate_value
                    break

        months_span = (end_period.year - start_period.year) * 12 + (
            end_period.month - start_period.month
        )
        years = Decimal(str(months_span / 12)) if months_span else Decimal("0")
        if years > 0 and start_value > 0 and end_value > 0:
            try:
                cagr = (end_value / start_value) ** (Decimal("1") / years) - Decimal("1")
            except (InvalidOperation, ZeroDivisionError, OverflowError):  # pragma: no cover
                cagr = None

        # If CAGR isn't computable, fall back to linear projection from recent monthly deltas.
        monthly_delta = Decimal("0")
        recent = monthly_points[-7:] if len(monthly_points) > 1 else []
        if len(recent) >= 2:
            deltas: list[Decimal] = []
            for (_prev_period, prev_value), (_next_period, next_value) in zip(recent, recent[1:]):
                deltas.append(next_value - prev_value)
            if deltas:
                monthly_delta = sum(deltas, Decimal("0")) / Decimal(len(deltas))

        points: list[dict[str, object]] = []
        monthly_rate = (cagr / Decimal(12)) if cagr is not None else None
        for idx in range(1, months + 1):
            target_date = self._add_months(end_period, idx)
            if monthly_rate is not None:
                projected = current * (Decimal("1") + monthly_rate) ** Decimal(idx)
            else:
                projected = current + (monthly_delta * Decimal(idx))
            points.append({"date": target_date.isoformat(), "net_worth": projected})

        return {"current": current, "cagr": cagr, "points": points}

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
    def _classify_income_expense(row: TransactionAmountRow) -> Tuple[Decimal, Decimal]:
        """Returns income, expense contributions (transfers excluded)."""

        amount = coerce_decimal(row.amount)
        if row.transaction_type == TransactionType.TRANSFER:
            return Decimal("0"), Decimal("0")
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
        start = datetime(year, 1, 1, tzinfo=timezone.utc)
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        prev_start = datetime(year - 1, 1, 1, tzinfo=timezone.utc)
        prev_end = datetime(year, 1, 1, tzinfo=timezone.utc)

        rows = self.repository.fetch_transaction_amounts(
            start=start, end=end, account_ids=account_ids
        )
        prev_rows = self.repository.fetch_transaction_amounts(
            start=prev_start, end=prev_end, account_ids=account_ids
        )

        monthly_income = [Decimal("0") for _ in range(12)]
        monthly_expense = [Decimal("0") for _ in range(12)]

        expense_by_category: Dict[str, Dict[str, object]] = {}
        merchants: Dict[str, Dict[str, object]] = {}
        largest_expenses: List[Dict[str, object]] = []
        subscriptions_current: Dict[str, Dict[str, object]] = {}

        for row in rows:
            month_idx = row.occurred_at.month - 1
            income, expense = self._classify_income_expense(row)
            monthly_income[month_idx] += income
            monthly_expense[month_idx] += expense

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

                if row.subscription_id:
                    sid = str(row.subscription_id)
                    if sid not in subscriptions_current:
                        subscriptions_current[sid] = {"id": sid, "count": 0, "total": Decimal("0")}
                    subscriptions_current[sid]["count"] = (
                        cast(int, subscriptions_current[sid]["count"]) + 1
                    )
                    subscriptions_current[sid]["total"] = (
                        cast(Decimal, subscriptions_current[sid]["total"]) + expense
                    )

        total_income = sum(monthly_income, Decimal("0"))
        total_expense = sum(monthly_expense, Decimal("0"))
        net_savings = total_income - total_expense
        savings_rate = (net_savings / total_income * Decimal("100")) if total_income > 0 else None

        avg_monthly_spend = (total_expense / Decimal("12")) if total_expense > 0 else Decimal("0")
        biggest_income_month = max(range(12), key=lambda idx: monthly_income[idx])
        biggest_expense_month = max(range(12), key=lambda idx: monthly_expense[idx])

        # Month-end time series.
        net_worth_series = self._month_end_balance_series(year=year, account_ids=account_ids)
        debt_ids = self.repository.list_account_ids_by_type(
            AccountType.DEBT, account_ids=account_ids
        )
        debt_series = (
            self._month_end_balance_series(year=year, account_ids=debt_ids) if debt_ids else []
        )

        # Investments only apply to full net worth (no account filter).
        investments_by_month: List[Decimal] = [Decimal("0") for _ in range(12)]
        if account_ids is None:
            snapshots = self.repository.list_investment_snapshots_until(end=date(year, 12, 31))
            snap_idx = 0
            latest = Decimal("0")
            month_ends = self._month_end_dates(year)
            for month_idx, month_end in enumerate(month_ends):
                while snap_idx < len(snapshots) and snapshots[snap_idx][0] <= month_end:
                    latest = snapshots[snap_idx][1]
                    snap_idx += 1
                investments_by_month[month_idx] = latest

        net_worth_points = [
            {"date": d.isoformat(), "net_worth": bal + investments_by_month[idx]}
            for idx, (d, bal) in enumerate(net_worth_series)
        ]
        debt_points = [
            {"date": d.isoformat(), "debt": -bal if bal < 0 else bal} for d, bal in debt_series
        ]

        # Top categories (top 8 + other).
        categories_sorted = sorted(
            expense_by_category.values(),
            key=lambda item: cast(Decimal, item["total"]),
            reverse=True,
        )
        top = categories_sorted[:8]
        rest = categories_sorted[8:]
        other_total = sum((cast(Decimal, item["total"]) for item in rest), Decimal("0"))
        other_monthly = [Decimal("0") for _ in range(12)]
        for item in rest:
            for idx, value in enumerate(cast(List[Decimal], item["monthly"])):
                other_monthly[idx] += value
        category_breakdown = [
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
            category_breakdown.append(
                {
                    "category_id": None,
                    "name": "Other",
                    "total": other_total,
                    "monthly": other_monthly,
                    "icon": None,
                    "color_hex": None,
                    "transaction_count": sum(cast(int, item["transaction_count"]) for item in rest),
                }
            )

        # Merchant YoY changes.
        prev_merchants: Dict[str, Decimal] = {}
        prev_subscriptions: set[str] = set()
        prev_subscription_avg: Dict[str, Decimal] = {}
        prev_counts: Dict[str, int] = {}
        for row in prev_rows:
            income, expense = self._classify_income_expense(row)
            if expense <= 0:
                continue
            mkey = self._merchant_key(row.description)
            prev_merchants[mkey] = prev_merchants.get(mkey, Decimal("0")) + expense
            if row.subscription_id:
                sid = str(row.subscription_id)
                prev_subscriptions.add(sid)
                prev_counts[sid] = prev_counts.get(sid, 0) + 1
                prev_subscription_avg[sid] = prev_subscription_avg.get(sid, Decimal("0")) + expense
        for sid, total in prev_subscription_avg.items():
            count = prev_counts.get(sid) or 1
            prev_subscription_avg[sid] = total / Decimal(count)

        merchants_rows = []
        for entry in merchants.values():
            merchant_name = cast(str, entry["merchant"])
            amount = cast(Decimal, entry["amount"])
            prev_amount = prev_merchants.get(merchant_name, Decimal("0"))
            change_pct = None
            if prev_amount > 0:
                change_pct = (amount - prev_amount) / prev_amount * Decimal("100")
            merchants_rows.append(
                {
                    "merchant": merchant_name,
                    "amount": amount,
                    "transaction_count": entry["transaction_count"],
                    "yoy_change_pct": change_pct,
                }
            )
        merchants_rows.sort(key=lambda item: cast(Decimal, item["amount"]), reverse=True)

        largest_expenses.sort(key=lambda item: cast(Decimal, item["amount"]), reverse=True)

        # Category changes YoY (ranked by increased spend).
        prev_category_totals: Dict[str, Decimal] = {}
        for row in prev_rows:
            _, expense = self._classify_income_expense(row)
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
            (self._classify_income_expense(row)[1] for row in prev_rows), Decimal("0")
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
        # Subscriptions signal (basic).
        new_subs = [sid for sid in subscriptions_current if sid not in prev_subscriptions]
        if new_subs:
            insights.append(f"Subscriptions: {len(new_subs)} new this year.")
        increased = 0
        for sid, payload in subscriptions_current.items():
            avg_now = cast(Decimal, payload["total"]) / Decimal(cast(int, payload["count"]) or 1)
            avg_prev = prev_subscription_avg.get(sid)
            if avg_prev is not None and avg_prev > 0 and avg_now > avg_prev * Decimal("1.15"):
                increased += 1
        if increased:
            insights.append(f"Subscriptions: {increased} appear to have increased price.")

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
            "top_merchants": merchants_rows[:10],
            "largest_transactions": largest_expenses[:10],
            "category_changes": category_changes[:10],
            "insights": insights[:6],
        }

    def yearly_category_detail(
        self,
        *,
        year: int,
        category_id: UUID,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        start = datetime(year, 1, 1, tzinfo=timezone.utc)
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        rows = self.repository.fetch_transaction_amounts(
            start=start, end=end, account_ids=account_ids
        )

        monthly = [Decimal("0") for _ in range(12)]
        merchants: Dict[str, Dict[str, object]] = {}
        for row in rows:
            if row.category_id != category_id:
                continue
            _, expense = self._classify_income_expense(row)
            if expense <= 0:
                continue
            idx = row.occurred_at.month - 1
            monthly[idx] += expense
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
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[QuarterlyTotals]:
        return self.repository.get_quarterly_totals(
            year=year,
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
        )

    def date_range_report(
        self,
        *,
        start_date: date,
        end_date: date,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[MonthlyTotals]:
        return self.repository.get_range_monthly_totals(
            start_date=start_date,
            end_date=end_date,
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
        )


__all__ = [
    "ReportingService",
    "MonthlyTotals",
    "YearlyTotals",
    "QuarterlyTotals",
    "LifetimeTotals",
    "NetWorthPoint",
]
