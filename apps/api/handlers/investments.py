"""Serverless HTTP handlers for investment snapshots."""

from __future__ import annotations

from typing import Any, Dict, Optional

from decimal import Decimal
from pydantic import ValidationError

from ..schemas import (
    InvestmentHoldingRead,
    InvestmentMetricsResponse,
    InvestmentTransactionListResponse,
    InvestmentTransactionRead,
    NordnetParseRequest,
    NordnetParseResponse,
    NordnetSnapshotCreate,
    NordnetSnapshotListResponse,
    NordnetSnapshotRead,
    NordnetSnapshotResponse,
)
from ..services import InvestmentSnapshotService
from ..shared import session_scope
from .utils import (
    ensure_engine,
    get_query_params,
    json_response,
    parse_body,
    reset_engine_state,
)


def reset_handler_state() -> None:
    reset_engine_state()


def create_nordnet_snapshot(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    parsed_body = parse_body(event)

    try:
        payload = NordnetSnapshotCreate.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = InvestmentSnapshotService(session)
        try:
            snapshot = service.create_nordnet_snapshot(payload)
        except ValueError as exc:
            return json_response(400, {"error": str(exc)})
        response = NordnetSnapshotResponse(
            snapshot=NordnetSnapshotRead.model_validate(snapshot)
        ).model_dump(mode="json")

    return json_response(201, response)


def list_nordnet_snapshots(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    limit: Optional[int] = None
    raw_limit = params.get("limit")
    if raw_limit is not None:
        try:
            limit = max(1, min(200, int(raw_limit)))
        except (TypeError, ValueError):
            return json_response(400, {"error": "limit must be an integer"})

    with session_scope() as session:
        service = InvestmentSnapshotService(session)
        snapshots = service.list_snapshots(limit=limit)
        response = NordnetSnapshotListResponse(
            snapshots=[NordnetSnapshotRead.model_validate(item) for item in snapshots]
        ).model_dump(mode="json")

    return json_response(200, response)


def list_investment_transactions(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
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

    with session_scope() as session:
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
    params = get_query_params(event)
    benchmark_param = params.get("benchmark") or "^OMXS30"
    benchmark_symbols = [sym.strip() for sym in benchmark_param.split(",") if sym.strip()]
    start_param = params.get("start_date")
    end_param = params.get("end_date")
    start_date = datetime.fromisoformat(start_param).date() if start_param else None
    end_date = datetime.fromisoformat(end_param).date() if end_param else None
    with session_scope() as session:
        service = InvestmentSnapshotService(session)
        snapshots = service.list_snapshots()
        txs = service.list_transactions()
        if not snapshots:
            return json_response(200, InvestmentMetricsResponse(
                performance={
                    "total_value": 0,
                    "invested": 0,
                    "realized_pl": 0,
                    "unrealized_pl": 0,
                    "twr": None,
                    "irr": None,
                    "as_of": datetime.utcnow().date(),
                    "benchmark_symbol": None,
                    "benchmark_change_pct": None,
                },
                holdings=[],
                snapshots=[],
                transactions=[],
            ).model_dump(mode="json"))

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
            benchmarks_payload.append(
                {"symbol": sym, "change_pct": change, "series": series or []}
            )
        performance = {
            "total_value": sum(_safe_decimal(h.value_sek) for h in holdings),
            "invested": invested,
            "realized_pl": realized,
            "unrealized_pl": unrealized,
            "twr": _compute_twr(txs, performance_end=_safe_decimal(latest.portfolio_value) or 0),
            "irr": _compute_irr(txs, performance_end=_safe_decimal(latest.portfolio_value) or 0),
            "as_of": latest.snapshot_date,
            "benchmarks": benchmarks_payload,
        }

        response = InvestmentMetricsResponse(
            performance=performance,
            holdings=[InvestmentHoldingRead.model_validate(h) for h in holdings],
            snapshots=[NordnetSnapshotRead.model_validate(s) for s in snapshots],
            transactions=[InvestmentTransactionRead.model_validate(tx) for tx in txs],
        ).model_dump(mode="json")

    return json_response(200, response)


def _safe_decimal(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal(0)


def _calculate_pl(holdings, transactions, as_of_date):
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


def _compute_twr(transactions, performance_end: Decimal):
    # Simplified: treat all transactions as cash flows, compute holding-period return
    cashflows = [_safe_decimal(-tx.amount_sek) for tx in transactions]
    invested = sum(cf for cf in cashflows if cf < 0)
    if invested == 0:
        return None
    return float((performance_end + sum(cashflows)) / abs(invested) - 1)


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
            float(-amt * (day / 365)) / ((1 + rate) ** (day / 365 + 1))
            for amt, day in days
        )
        if f_prime == 0:
            break
        rate -= f / f_prime
    return float(rate)
def parse_nordnet_export(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    parsed_body = parse_body(event)
    try:
        payload = NordnetParseRequest.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = InvestmentSnapshotService(session)
        parsed = service.parse_nordnet_export(
            payload.raw_text,
            payload.manual_payload,
        )
        response = NordnetParseResponse(
            report_type=parsed.get("report_type"),
            snapshot_date=parsed.get("snapshot_date"),
            portfolio_value=parsed.get("portfolio_value"),
            parsed_payload=parsed,
        ).model_dump(mode="json")

    return json_response(200, response)


__all__ = [
    "create_nordnet_snapshot",
    "list_nordnet_snapshots",
    "parse_nordnet_export",
    "list_investment_transactions",
    "investment_metrics",
    "reset_handler_state",
]
