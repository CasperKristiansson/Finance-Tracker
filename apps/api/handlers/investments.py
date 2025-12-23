"""Serverless HTTP handlers for investment snapshots."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from ..schemas import (
    BenchmarkRead,
    InvestmentHoldingRead,
    InvestmentMetricsResponse,
    InvestmentOverviewResponse,
    InvestmentPerformanceRead,
    InvestmentTransactionListResponse,
    InvestmentTransactionRead,
    NordnetSnapshotRead,
)
from ..services import InvestmentSnapshotService
from ..shared import session_scope
from .utils import (
    ensure_engine,
    get_query_params,
    get_user_id,
    json_response,
    parse_body,
    reset_engine_state,
)


def reset_handler_state() -> None:
    reset_engine_state()


def list_investment_transactions(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    params = get_query_params(event)
    start = params.get("start")
    end = params.get("end")
    holding = params.get("holding")
    tx_type = params.get("type")
    limit_raw = params.get("limit")
    limit: Optional[int] = None
    if limit_raw is not None:
        try:
            limit = max(1, min(500, int(limit_raw)))
        except (TypeError, ValueError):
            return json_response(400, {"error": "limit must be an integer"})

    start_dt = datetime.fromisoformat(start) if start else None
    end_dt = datetime.fromisoformat(end) if end else None

    with session_scope(user_id=user_id) as session:
        service = InvestmentSnapshotService(session)
        txs = service.list_transactions(
            start=start_dt, end=end_dt, holding=holding, tx_type=tx_type, limit=limit
        )
        response = InvestmentTransactionListResponse(
            transactions=[InvestmentTransactionRead.model_validate(tx) for tx in txs]
        ).model_dump(mode="json")

    return json_response(200, response)


def investment_metrics(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    params = get_query_params(event)
    benchmark_param = params.get("benchmark") or "^OMXS30"
    benchmark_symbols = [sym.strip() for sym in benchmark_param.split(",") if sym.strip()]
    start_param = params.get("start_date")
    end_param = params.get("end_date")
    start_date = datetime.fromisoformat(start_param).date() if start_param else None
    end_date = datetime.fromisoformat(end_param).date() if end_param else None
    with session_scope(user_id=user_id) as session:
        service = InvestmentSnapshotService(session)
        snapshots = service.list_snapshots()
        txs = service.list_transactions()
        if not snapshots:
            empty_performance = InvestmentPerformanceRead(
                total_value=Decimal(0),
                invested=Decimal(0),
                realized_pl=Decimal(0),
                unrealized_pl=Decimal(0),
                twr=None,
                irr=None,
                as_of=datetime.utcnow().date(),
                benchmarks=[],
            )
            empty_response = InvestmentMetricsResponse(
                performance=empty_performance, holdings=[], snapshots=[], transactions=[]
            ).model_dump(mode="json")
            return json_response(200, empty_response)

        latest = snapshots[0]
        holdings = latest.holdings or []

        invested, realized, unrealized = _calculate_pl(holdings, txs, latest.snapshot_date)
        metrics_start = start_date or snapshots[-1].snapshot_date
        metrics_end = end_date or latest.snapshot_date
        benchmarks_payload = []
        for sym in benchmark_symbols:
            change, series = service.benchmark_change_pct(
                sym,
                start_date=metrics_start,
                end_date=metrics_end,
                return_series=True,
            )
            benchmarks_payload.append({"symbol": sym, "change_pct": change, "series": series or []})
        benchmarks_models = [BenchmarkRead.model_validate(b) for b in benchmarks_payload]
        performance = InvestmentPerformanceRead(
            total_value=sum((_safe_decimal(h.value_sek) for h in holdings), Decimal(0)),
            invested=invested,
            realized_pl=realized,
            unrealized_pl=unrealized,
            twr=_compute_twr(
                txs, performance_end=_safe_decimal(latest.portfolio_value) or Decimal(0)
            ),
            irr=_compute_irr(
                txs, performance_end=_safe_decimal(latest.portfolio_value) or Decimal(0)
            ),
            as_of=latest.snapshot_date,
            benchmarks=benchmarks_models,
        )

        response = InvestmentMetricsResponse(
            performance=performance,
            holdings=[InvestmentHoldingRead.model_validate(h) for h in holdings],
            snapshots=[NordnetSnapshotRead.model_validate(s) for s in snapshots],
            transactions=[InvestmentTransactionRead.model_validate(tx) for tx in txs],
        ).model_dump(mode="json")

    return json_response(200, response)


def sync_investment_ledger(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    parsed = parse_body(event) if event.get("body") else {}
    category_id_raw = parsed.get("category_id") if isinstance(parsed, dict) else None
    category_id = UUID(str(category_id_raw)) if category_id_raw else None
    with session_scope(user_id=user_id) as session:
        service = InvestmentSnapshotService(session)
        count = service.sync_transactions_to_ledger(default_category_id=category_id)
    return json_response(200, {"synced": count})


def investment_overview(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)

    with session_scope(user_id=user_id) as session:
        service = InvestmentSnapshotService(session)
        payload = service.investment_overview()
        response = InvestmentOverviewResponse.model_validate(payload).model_dump(mode="json")

    return json_response(200, response)


def _safe_decimal(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:  # pylint: disable=broad-exception-caught
        return Decimal(0)


def _calculate_pl(holdings, transactions, _as_of_date):
    total_value = sum(_safe_decimal(h.value_sek) for h in holdings)
    buys = Decimal(0)
    sells = Decimal(0)
    fees = Decimal(0)
    dividends = Decimal(0)
    for tx in transactions:
        amount = _safe_decimal(tx.amount_sek)
        if tx.transaction_type in ("buy", "köpt", "kopt"):
            buys += amount
        elif tx.transaction_type in ("sell", "sålt", "salt"):
            sells += amount
        elif tx.transaction_type == "dividend":
            dividends += amount
        elif tx.transaction_type == "fee":
            fees += amount
    invested = buys + fees - dividends
    realized = sells - buys
    unrealized = total_value - buys
    return invested, realized, unrealized


def _compute_twr(transactions, performance_end: Decimal) -> Optional[float]:
    # Simplified: treat all transactions as cash flows, compute holding-period return
    cashflows: list[Decimal] = [_safe_decimal(-tx.amount_sek) for tx in transactions]
    invested = sum((cf for cf in cashflows if cf < 0), Decimal(0))
    if invested == 0:
        return None
    total = performance_end + sum(cashflows, Decimal(0))
    return float(total / abs(invested) - 1)


def _compute_irr(transactions, performance_end: Decimal):
    cashflows = []
    for tx in transactions:
        cashflows.append(
            (_safe_decimal(-tx.amount_sek), tx.occurred_at.date() if tx.occurred_at else None)
        )
    if not cashflows:
        return None
    dates = [dt for _, dt in cashflows if dt]
    if not dates:
        return None
    start_date = min(dates)
    days = [(amt, (dt - start_date).days) for amt, dt in cashflows if dt]
    days.append((performance_end, max(d[1] for d in days) if days else 0))

    def npv(rate: float) -> float:
        return sum(float(amt) / ((1 + rate) ** (day / 365)) for amt, day in days)

    rate = 0.05
    for _ in range(20):
        f = npv(rate)
        f_prime = sum(
            float(-amt * (day / 365)) / ((1 + rate) ** (day / 365 + 1)) for amt, day in days
        )
        if f_prime == 0:
            break
        rate -= f / f_prime
    return float(rate)


__all__ = [
    "list_investment_transactions",
    "investment_metrics",
    "reset_handler_state",
    "investment_overview",
    "sync_investment_ledger",
]
