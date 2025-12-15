"""Service layer for reporting aggregation helpers."""

# pylint: disable=too-many-lines

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
from .reporting_total import build_total_overview
from .reporting_yearly import build_yearly_overview_enhancements

# pylint: disable=too-many-lines


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
            subscription_ids=subscription_ids,
        )

        buckets: Dict[date, Tuple[Decimal, Decimal]] = {}
        account_scoped = account_ids is not None
        for row in rows:
            income, expense = self._classify_income_expense(row, account_scoped=account_scoped)
            if income == 0 and expense == 0:
                continue
            period = date(row.occurred_at.year, row.occurred_at.month, 1)
            inc, exp = buckets.get(period, (Decimal("0"), Decimal("0")))
            buckets[period] = (inc + income, exp + expense)

        results: List[MonthlyTotals] = []
        for period in sorted(buckets.keys()):
            income, expense = buckets[period]
            results.append(
                MonthlyTotals(period=period, income=income, expense=expense, net=income - expense)
            )
        return results

    def yearly_report(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[YearlyTotals]:
        start = datetime(1900, 1, 1, tzinfo=timezone.utc)
        end = datetime.now(timezone.utc) + timedelta(days=1)
        rows = self._filtered_transaction_amounts(
            start=start,
            end=end,
            account_ids=account_ids,
            category_ids=category_ids,
            subscription_ids=subscription_ids,
        )

        buckets: Dict[int, Tuple[Decimal, Decimal]] = {}
        account_scoped = account_ids is not None
        for row in rows:
            income, expense = self._classify_income_expense(row, account_scoped=account_scoped)
            if income == 0 and expense == 0:
                continue
            inc, exp = buckets.get(row.occurred_at.year, (Decimal("0"), Decimal("0")))
            buckets[row.occurred_at.year] = (inc + income, exp + expense)

        results: List[YearlyTotals] = []
        for yr in sorted(buckets.keys()):
            income, expense = buckets[yr]
            results.append(
                YearlyTotals(year=yr, income=income, expense=expense, net=income - expense)
            )
        return results

    def total_report(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
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
            subscription_ids=subscription_ids,
        )

        income_total = Decimal("0")
        expense_total = Decimal("0")
        account_scoped = account_ids is not None
        for row in rows:
            income, expense = self._classify_income_expense(row, account_scoped=account_scoped)
            income_total += income
            expense_total += expense
        return LifetimeTotals(
            income=income_total, expense=expense_total, net=income_total - expense_total
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
        if not all_days:
            return []

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

    def cashflow_forecast(
        self,
        *,
        days: int = 60,
        threshold: Decimal = Decimal("0"),
        lookback_days: int = 180,
        model: str = "ensemble",
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> dict[str, object]:
        current_balance = self.repository.current_balance_total(account_ids=account_ids)
        avg_daily = self.repository.average_daily_net(days=90, account_ids=account_ids)

        today = datetime.now(timezone.utc).date()
        start = datetime.combine(
            today - timedelta(days=lookback_days), datetime.min.time(), tzinfo=timezone.utc
        )
        end = datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        history = self.repository.daily_deltas_between(
            start=start,
            end=end,
            account_ids=account_ids,
        )

        # Build a complete daily series (missing days treated as zero delta).
        hist_by_day = {day: coerce_decimal(delta) for day, delta in history}
        days_in_window = max(1, (end.date() - start.date()).days)
        window_days: list[date] = [start.date() + timedelta(days=i) for i in range(days_in_window)]
        series = [(d, hist_by_day.get(d, Decimal("0"))) for d in window_days]

        if model == "simple" or len(series) < 30:
            simple_alert_at: Optional[str] = None
            running = current_balance
            simple_points: list[dict[str, object]] = []
            for step in range(1, days + 1):
                running += avg_daily
                target = today + timedelta(days=step)
                iso = target.isoformat()
                simple_points.append(
                    {"date": iso, "balance": running, "delta": avg_daily, "baseline": avg_daily}
                )
                if simple_alert_at is None and running < threshold:
                    simple_alert_at = iso
            return {
                "starting_balance": current_balance,
                "average_daily": avg_daily,
                "threshold": threshold,
                "alert_below_threshold_at": simple_alert_at,
                "points": simple_points,
                "model": "simple",
                "lookback_days": lookback_days,
                "residual_std": None,
                "weekday_averages": None,
                "monthday_averages": None,
            }

        weekday_totals = [Decimal("0")] * 7
        weekday_counts = [0] * 7
        monthday_totals = [Decimal("0")] * 31
        monthday_counts = [0] * 31
        total = Decimal("0")
        for day, delta in series:
            total += delta
            w = day.weekday()
            weekday_totals[w] += delta
            weekday_counts[w] += 1
            md_idx = day.day - 1
            if 0 <= md_idx < 31:
                monthday_totals[md_idx] += delta
                monthday_counts[md_idx] += 1

        overall = total / Decimal(len(series)) if series else Decimal("0")
        weekday_means = [
            (weekday_totals[i] / Decimal(weekday_counts[i])) if weekday_counts[i] else overall
            for i in range(7)
        ]
        monthday_means: list[Optional[Decimal]] = []
        for i in range(31):
            if monthday_counts[i] >= 3:
                monthday_means.append(monthday_totals[i] / Decimal(monthday_counts[i]))
            else:
                monthday_means.append(None)

        # Blend weekday and month-day seasonality.
        def predict_delta(target_day: date) -> tuple[Decimal, Decimal, Decimal]:
            baseline = overall if model != "ensemble" else avg_daily
            weekday_mean = weekday_means[target_day.weekday()]
            monthday_mean = monthday_means[target_day.day - 1] if target_day.day <= 31 else None

            weekday_component = weekday_mean - baseline
            monthday_component = (
                (monthday_mean - baseline) if monthday_mean is not None else Decimal("0")
            )

            weekday_weight = Decimal(min(1.0, weekday_counts[target_day.weekday()] / 26.0))
            monthday_weight = Decimal(
                min(1.0, monthday_counts[target_day.day - 1] / 6.0) if target_day.day <= 31 else 0.0
            )
            predicted = (
                baseline
                + (weekday_component * weekday_weight)
                + (monthday_component * monthday_weight)
            )
            return (
                predicted,
                baseline,
                (weekday_component * weekday_weight) + (monthday_component * monthday_weight),
            )

        # Residual standard deviation for uncertainty bands.
        residuals: list[Decimal] = []
        for day, actual in series[-min(len(series), 180) :]:
            predicted, baseline, seasonal = predict_delta(day)
            _ = baseline
            _ = seasonal
            residuals.append(actual - predicted)

        if residuals:
            mean_sq = sum((r * r for r in residuals), Decimal("0")) / Decimal(len(residuals))
            residual_std = mean_sq.sqrt() if mean_sq > 0 else Decimal("0")
        else:
            residual_std = Decimal("0")

        z = Decimal("1.28")  # ~80% interval
        alert_at: Optional[str] = None
        running = current_balance
        points: list[dict[str, object]] = []
        for step in range(1, days + 1):
            target = today + timedelta(days=step)
            delta, baseline, seasonal_total = predict_delta(target)
            running += delta
            sigma = residual_std * Decimal(str(step)).sqrt()
            low = running - (z * sigma)
            high = running + (z * sigma)
            iso = target.isoformat()
            points.append(
                {
                    "date": iso,
                    "balance": running,
                    "delta": delta,
                    "low": low,
                    "high": high,
                    "baseline": baseline,
                    "weekday_component": seasonal_total,  # combined for now
                    "monthday_component": None,
                }
            )
            if alert_at is None and running < threshold:
                alert_at = iso

        return {
            "starting_balance": current_balance,
            "average_daily": avg_daily,
            "threshold": threshold,
            "alert_below_threshold_at": alert_at,
            "points": points,
            "model": model,
            "lookback_days": lookback_days,
            "residual_std": residual_std,
            "weekday_averages": weekday_means,
            "monthday_averages": monthday_means,
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
        account_id_list = list(account_ids) if account_ids is not None else None
        history = self.net_worth_history(account_ids=account_id_list)

        if not history:
            current = self.repository.current_balance_total(account_ids=account_id_list)
            return {"current": current, "cagr": None, "points": []}

        # Aggregate to monthly (latest observation per month).
        monthly: dict[tuple[int, int], tuple[date, Decimal]] = {}
        for point in history:
            key = (point.period.year, point.period.month)
            existing = monthly.get(key)
            if existing is None or point.period >= existing[0]:
                monthly[key] = (point.period, coerce_decimal(point.net_worth))

        monthly_points = [monthly[key] for key in sorted(monthly.keys())]
        current_date, _ = monthly_points[-1]
        current = coerce_decimal(history[-1].net_worth)

        if len(monthly_points) < 2:
            flat_points = [
                {
                    "date": self._add_months(date.today(), idx).isoformat(),
                    "net_worth": current,
                    "low": None,
                    "high": None,
                }
                for idx in range(1, months + 1)
            ]
            return {
                "current": current,
                "cagr": None,
                "points": flat_points,
                "recommended_method": "flat",
                "methods": None,
                "insights": ["Not enough net worth history to project trends."],
            }

        monthly_values = [coerce_decimal(v) for _d, v in monthly_points]
        monthly_deltas = [b - a for a, b in zip(monthly_values, monthly_values[1:])]

        # Compute CAGR over up to the last 12 months when possible.
        cagr: Decimal | None = None
        if len(monthly_values) >= 13:
            start_value = monthly_values[-13]
            end_value = monthly_values[-1]
            if start_value > 0 and end_value > 0:
                try:
                    cagr = (end_value / start_value) ** (Decimal("1") / Decimal("1")) - Decimal("1")
                except (InvalidOperation, ZeroDivisionError, OverflowError):  # pragma: no cover
                    cagr = None
        else:
            start_value = monthly_values[0]
            end_value = monthly_values[-1]
            months_span = max(0, len(monthly_values) - 1)
            if months_span and start_value > 0 and end_value > 0:
                try:
                    years = Decimal(str(months_span / 12))
                    if years > 0:
                        cagr = (end_value / start_value) ** (Decimal("1") / years) - Decimal("1")
                except (InvalidOperation, ZeroDivisionError, OverflowError):  # pragma: no cover
                    cagr = None

        def _median(values: list[Decimal]) -> Decimal:
            ordered = sorted(values)
            n = len(ordered)
            if n == 0:
                return Decimal("0")
            mid = n // 2
            if n % 2 == 1:
                return ordered[mid]
            return (ordered[mid - 1] + ordered[mid]) / Decimal("2")

        def _linear_fit(values: list[Decimal]) -> tuple[Decimal, Decimal] | None:
            """Return (intercept, slope) for y=a+b*t via closed-form OLS."""

            n = len(values)
            if n < 2:
                return None
            t = list(range(n))
            sum_t = Decimal(sum(t))
            sum_y = sum(values, Decimal("0"))
            sum_tt = Decimal(sum(i * i for i in t))
            sum_ty = sum((Decimal(i) * y for i, y in zip(t, values)), Decimal("0"))
            denom = (Decimal(n) * sum_tt) - (sum_t * sum_t)
            if denom == 0:
                return None
            slope = (Decimal(n) * sum_ty - sum_t * sum_y) / denom
            intercept = (sum_y - slope * sum_t) / Decimal(n)
            return intercept, slope

        def _forecast_series(
            method: str,
            *,
            train_values: list[Decimal],
            train_deltas: list[Decimal],
            steps: int,
        ) -> list[Decimal] | None:
            if not train_values or steps <= 0:
                return []

            last = train_values[-1]

            if method == "median_delta":
                window = train_deltas[-min(len(train_deltas), 12) :]
                if not window:
                    return None
                delta = _median(window)
                return [last + (delta * Decimal(i)) for i in range(1, steps + 1)]

            if method == "sma_delta":
                window = train_deltas[-min(len(train_deltas), 12) :]
                if not window:
                    return None
                delta = sum(window, Decimal("0")) / Decimal(len(window))
                return [last + (delta * Decimal(i)) for i in range(1, steps + 1)]

            if method == "ewma_delta":
                if not train_deltas:
                    return None
                alpha = Decimal("0.35")
                smoothed = train_deltas[0]
                for item in train_deltas[1:]:
                    smoothed = alpha * item + (Decimal("1") - alpha) * smoothed
                return [last + (smoothed * Decimal(i)) for i in range(1, steps + 1)]

            if method == "linear":
                window_len = min(len(train_values), 36)
                fit = _linear_fit(train_values[-window_len:])
                if fit is None:
                    return None
                intercept, slope = fit
                start_t = Decimal(window_len - 1)
                # Predict future points relative to end of the window.
                return [intercept + slope * (start_t + Decimal(i)) for i in range(1, steps + 1)]

            if method == "cagr":
                if len(train_values) < 2:
                    return None
                first = train_values[0]
                if first <= 0 or last <= 0:
                    return None
                try:
                    growth = (last / first) ** (Decimal("1") / Decimal(len(train_values) - 1))
                except (InvalidOperation, ZeroDivisionError, OverflowError):  # pragma: no cover
                    return None
                return [last * (growth ** Decimal(i)) for i in range(1, steps + 1)]

            return None

        methods = ["median_delta", "sma_delta", "ewma_delta", "linear", "cagr"]

        # Determine a small holdout window for backtesting.
        n_months = len(monthly_values)
        if n_months >= 18:
            holdout = 6
        elif n_months >= 12:
            holdout = 4
        elif n_months >= 6:
            holdout = 2
        else:
            holdout = 0

        mae_by_method: dict[str, Decimal] = {}
        residuals_by_method: dict[str, list[Decimal]] = {}
        for method in methods:
            errors: list[Decimal] = []
            residuals: list[Decimal] = []
            if holdout:
                for idx in range(n_months - holdout, n_months):
                    train_vals = monthly_values[:idx]
                    train_dels = [b - a for a, b in zip(train_vals, train_vals[1:])]
                    pred_series = _forecast_series(
                        method,
                        train_values=train_vals,
                        train_deltas=train_dels,
                        steps=1,
                    )
                    if not pred_series:
                        continue
                    predicted = pred_series[0]
                    actual = monthly_values[idx]
                    err = abs(actual - predicted)
                    errors.append(err)
                    residuals.append(actual - predicted)

            if errors:
                mae_by_method[method] = sum(errors, Decimal("0")) / Decimal(len(errors))
                residuals_by_method[method] = residuals

        recommended_method = None
        weights: dict[str, Decimal] = {}
        if mae_by_method:
            # Lower MAE => higher weight.
            best = min(mae_by_method.items(), key=lambda kv: kv[1])[0]
            if len(mae_by_method) >= 2 and holdout:
                eps = max(Decimal("1"), _median(list(mae_by_method.values())) * Decimal("0.05"))
                raw_weights = {m: Decimal("1") / (mae + eps) for m, mae in mae_by_method.items()}
                total_weight = sum(raw_weights.values(), Decimal("0"))
                if total_weight > 0:
                    weights = {m: w / total_weight for m, w in raw_weights.items()}
                    recommended_method = "ensemble"
                else:
                    recommended_method = best
            else:
                recommended_method = best
        else:
            recommended_method = "sma_delta"

        # Build projections per method (future points only).
        projection_methods: dict[str, list[dict[str, object]]] = {}
        for method in methods:
            series = _forecast_series(
                method,
                train_values=monthly_values,
                train_deltas=monthly_deltas,
                steps=months,
            )
            if not series:
                continue
            projection_methods[method] = [
                {
                    "date": self._add_months(current_date, idx).isoformat(),
                    "net_worth": value,
                }
                for idx, value in enumerate(series, start=1)
            ]

        # Compute ensemble series if applicable.
        def _ensemble_at(step_idx: int) -> Optional[Decimal]:
            if not weights:
                return None
            total = Decimal("0")
            used = Decimal("0")
            for method, weight in weights.items():
                rows = projection_methods.get(method)
                if not rows or step_idx >= len(rows):
                    continue
                total += weight * coerce_decimal(cast(Decimal, rows[step_idx]["net_worth"]))
                used += weight
            if used == 0:
                return None
            return total / used

        points: list[dict[str, object]] = []
        point_values: list[Decimal] = []
        if recommended_method == "ensemble":
            for idx in range(1, months + 1):
                value = _ensemble_at(idx - 1)
                if value is None:
                    break
                point_values.append(value)
        else:
            rows = projection_methods.get(recommended_method or "", [])
            if rows:
                point_values = [
                    coerce_decimal(cast(Decimal, row["net_worth"])) for row in rows[:months]
                ]

        # Uncertainty bands based on residual std of the recommended method.
        residuals = []
        if recommended_method == "ensemble" and weights and holdout:
            # Build ensemble residuals from per-method residuals.
            for idx in range(n_months - holdout, n_months):
                train_vals = monthly_values[:idx]
                train_dels = [b - a for a, b in zip(train_vals, train_vals[1:])]
                pred_total = Decimal("0")
                used = Decimal("0")
                for method, weight in weights.items():
                    pred_series = _forecast_series(
                        method,
                        train_values=train_vals,
                        train_deltas=train_dels,
                        steps=1,
                    )
                    if not pred_series:
                        continue
                    pred_total += weight * pred_series[0]
                    used += weight
                if used == 0:
                    continue
                predicted = pred_total / used
                actual = monthly_values[idx]
                residuals.append(actual - predicted)
        else:
            residuals = residuals_by_method.get(recommended_method or "", [])

        if residuals:
            mean_sq = sum((r * r for r in residuals), Decimal("0")) / Decimal(len(residuals))
            residual_std = mean_sq.sqrt() if mean_sq > 0 else Decimal("0")
        else:
            residual_std = Decimal("0")

        z = Decimal("1.28")  # ~80% interval
        for idx, value in enumerate(point_values, start=1):
            target_date = self._add_months(current_date, idx).isoformat()
            sigma = residual_std * Decimal(str(idx)).sqrt()
            low = value - (z * sigma) if residual_std > 0 else None
            high = value + (z * sigma) if residual_std > 0 else None
            points.append(
                {
                    "date": target_date,
                    "net_worth": value,
                    "low": low,
                    "high": high,
                }
            )

        insights: list[str] = []
        recent_delta = Decimal("0")
        recent_window = monthly_deltas[-min(len(monthly_deltas), 6) :]
        if recent_window:
            recent_delta = sum(recent_window, Decimal("0")) / Decimal(len(recent_window))
            insights.append(f"Recent average monthly change: {recent_delta:.0f}")
        if cagr is not None:
            insights.append(f"Approx CAGR: {(cagr * Decimal('100')):.1f}%")
        if recommended_method:
            insights.append(f"Recommended method: {recommended_method}")
        if mae_by_method:
            best_method = min(mae_by_method.items(), key=lambda kv: kv[1])[0]
            insights.append(f"Backtest best MAE: {best_method}")

        return {
            "current": current,
            "cagr": cagr,
            "points": points,
            "recommended_method": recommended_method,
            "methods": projection_methods or None,
            "insights": insights or None,
        }

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
        subscriptions_current: Dict[str, Dict[str, object]] = {}

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

        # Prior-year subscription signal inputs.
        prev_subscriptions: set[str] = set()
        prev_subscription_avg: Dict[str, Decimal] = {}
        prev_counts: Dict[str, int] = {}
        for row in prev_rows:
            income, expense = self._classify_income_expense(row, account_scoped=account_scoped)
            if expense <= 0:
                continue
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
            classify_income_expense=lambda row: self._classify_income_expense(  # noqa: E731
                row, account_scoped=account_id_list is not None
            ),
            merchant_key=self._merchant_key,
            month_end_balance_series=lambda yr, ids: self._month_end_balance_series(
                year=yr, account_ids=ids
            ),
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
        subscription_ids: Optional[Iterable[UUID]] = None,
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
            subscription_ids=subscription_ids,
        )

        buckets: Dict[tuple[int, int], Tuple[Decimal, Decimal]] = {}
        account_scoped = account_ids is not None
        for row in rows:
            income, expense = self._classify_income_expense(row, account_scoped=account_scoped)
            if income == 0 and expense == 0:
                continue
            quarter = (row.occurred_at.month - 1) // 3 + 1
            key = (row.occurred_at.year, quarter)
            inc, exp = buckets.get(key, (Decimal("0"), Decimal("0")))
            buckets[key] = (inc + income, exp + expense)

        results: List[QuarterlyTotals] = []
        for yr, qtr in sorted(buckets.keys()):
            income, expense = buckets[(yr, qtr)]
            results.append(
                QuarterlyTotals(
                    year=yr, quarter=qtr, income=income, expense=expense, net=income - expense
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
        subscription_ids: Optional[Iterable[UUID]] = None,
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
            subscription_ids=subscription_ids,
        )
        if source:
            rows = [row for row in rows if self._merchant_key(row.description) == source]

        buckets: Dict[date, Tuple[Decimal, Decimal]] = {}
        account_scoped = account_ids is not None
        for row in rows:
            income, expense = self._classify_income_expense(row, account_scoped=account_scoped)
            if income == 0 and expense == 0:
                continue
            period = date(row.occurred_at.year, row.occurred_at.month, 1)
            inc, exp = buckets.get(period, (Decimal("0"), Decimal("0")))
            buckets[period] = (inc + income, exp + expense)

        results: List[MonthlyTotals] = []
        for period in sorted(buckets.keys()):
            income, expense = buckets[period]
            results.append(
                MonthlyTotals(period=period, income=income, expense=expense, net=income - expense)
            )
        return results

    def _filtered_transaction_amounts(
        self,
        *,
        start: datetime,
        end: datetime,
        account_ids: Optional[Iterable[UUID]] = None,
        category_ids: Optional[Iterable[UUID]] = None,
        subscription_ids: Optional[Iterable[UUID]] = None,
    ) -> List[TransactionAmountRow]:
        rows = self.repository.fetch_transaction_amounts(
            start=start, end=end, account_ids=account_ids
        )
        if category_ids:
            allowed = set(category_ids)
            rows = [row for row in rows if row.category_id in allowed]
        if subscription_ids:
            allowed = set(subscription_ids)
            rows = [row for row in rows if row.subscription_id in allowed]
        return rows


__all__ = [
    "ReportingService",
    "MonthlyTotals",
    "YearlyTotals",
    "QuarterlyTotals",
    "LifetimeTotals",
    "NetWorthPoint",
]
