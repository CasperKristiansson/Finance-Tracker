"""Forecasting and projection mixin for reporting service."""

from __future__ import annotations

import calendar
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Iterable, List, Optional, cast
from uuid import UUID

from ..repositories.reporting import NetWorthPoint, ReportingRepository
from ..shared import coerce_decimal


class ReportingProjectionMixin:
    """Cashflow forecast and net-worth projection operations."""

    repository: ReportingRepository

    def net_worth_history(
        self,
        *,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> List[NetWorthPoint]:
        raise NotImplementedError

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

        mean_sq = sum((r * r for r in residuals), Decimal("0")) / Decimal(len(residuals))
        residual_std = mean_sq.sqrt() if mean_sq > 0 else Decimal("0")

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
                    cagr = (end_value / start_value) ** (Decimal("1") / years) - Decimal("1")
                except (InvalidOperation, ZeroDivisionError, OverflowError):  # pragma: no cover
                    cagr = None

        def _median(values: list[Decimal]) -> Decimal:
            ordered = sorted(values)
            n = len(ordered)
            mid = n // 2
            if n % 2 == 1:
                return ordered[mid]
            return (ordered[mid - 1] + ordered[mid]) / Decimal("2")

        def _linear_fit(values: list[Decimal]) -> tuple[Decimal, Decimal]:
            """Return (intercept, slope) for y=a+b*t via closed-form OLS."""

            n = len(values)
            t = list(range(n))
            sum_t = Decimal(sum(t))
            sum_y = sum(values, Decimal("0"))
            sum_tt = Decimal(sum(i * i for i in t))
            sum_ty = sum((Decimal(i) * y for i, y in zip(t, values)), Decimal("0"))
            denom = (Decimal(n) * sum_tt) - (sum_t * sum_t)
            slope = (Decimal(n) * sum_ty - sum_t * sum_y) / denom
            intercept = (sum_y - slope * sum_t) / Decimal(n)
            return intercept, slope

        def _forecast_series(
            method: str,
            *,
            train_values: list[Decimal],
            train_deltas: list[Decimal],
            steps: int,
        ) -> list[Decimal]:
            if not train_values or steps <= 0:
                return []

            last = train_values[-1]

            if method == "median_delta":
                window = train_deltas[-min(len(train_deltas), 12) :]
                delta = _median(window)
                return [last + (delta * Decimal(i)) for i in range(1, steps + 1)]

            if method == "sma_delta":
                window = train_deltas[-min(len(train_deltas), 12) :]
                delta = sum(window, Decimal("0")) / Decimal(len(window))
                return [last + (delta * Decimal(i)) for i in range(1, steps + 1)]

            if method == "ewma_delta":
                alpha = Decimal("0.35")
                smoothed = train_deltas[0]
                for item in train_deltas[1:]:
                    smoothed = alpha * item + (Decimal("1") - alpha) * smoothed
                return [last + (smoothed * Decimal(i)) for i in range(1, steps + 1)]

            if method == "linear":
                window_len = min(len(train_values), 36)
                fit = _linear_fit(train_values[-window_len:])
                intercept, slope = fit
                start_t = Decimal(window_len - 1)
                # Predict future points relative to end of the window.
                return [intercept + slope * (start_t + Decimal(i)) for i in range(1, steps + 1)]

            if method == "cagr":
                first = train_values[0]
                if first <= 0 or last <= 0:
                    return []
                try:
                    growth = (last / first) ** (Decimal("1") / Decimal(len(train_values) - 1))
                except (InvalidOperation, ZeroDivisionError, OverflowError):  # pragma: no cover
                    return []
                return [last * (growth ** Decimal(i)) for i in range(1, steps + 1)]

            return []  # pragma: no cover

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

        weights: dict[str, Decimal] = {}
        if mae_by_method:
            eps = max(Decimal("1"), _median(list(mae_by_method.values())) * Decimal("0.05"))
            raw_weights = {m: Decimal("1") / (mae + eps) for m, mae in mae_by_method.items()}
            total_weight = sum(raw_weights.values(), Decimal("0"))
            weights = {m: w / total_weight for m, w in raw_weights.items()}
            recommended_method = "ensemble"
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
        def _ensemble_at(step_idx: int) -> Decimal:
            total = Decimal("0")
            for method, weight in weights.items():
                rows = projection_methods[method]
                total += weight * coerce_decimal(cast(Decimal, rows[step_idx]["net_worth"]))
            return total

        points: list[dict[str, object]] = []
        point_values: list[Decimal] = []
        if recommended_method == "ensemble":
            for idx in range(1, months + 1):
                point_values.append(_ensemble_at(idx - 1))
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
                for method, weight in weights.items():
                    pred_series = _forecast_series(
                        method,
                        train_values=train_vals,
                        train_deltas=train_dels,
                        steps=1,
                    )
                    pred_total += weight * pred_series[0]
                predicted = pred_total
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
        recent_delta = sum(recent_window, Decimal("0")) / Decimal(len(recent_window))
        insights.append(f"Recent average monthly change: {recent_delta:.0f}")
        if cagr is not None:
            insights.append(f"Approx CAGR: {(cagr * Decimal('100')):.1f}%")
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
