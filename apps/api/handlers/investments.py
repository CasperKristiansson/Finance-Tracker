"""Serverless HTTP handlers for investment snapshots."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from ..schemas import (
    InvestmentOverviewResponse,
    InvestmentTransactionListResponse,
    InvestmentTransactionRead,
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


__all__ = [
    "list_investment_transactions",
    "reset_handler_state",
    "investment_overview",
    "sync_investment_ledger",
]
