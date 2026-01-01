"""Serverless HTTP handlers for investment snapshots."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import ValidationError

from ..models import Account, InvestmentSnapshot
from ..schemas import (
    InvestmentOverviewResponse,
    InvestmentSnapshotCreateRequest,
    InvestmentSnapshotCreateResponse,
    InvestmentTransactionListResponse,
    InvestmentTransactionRead,
)
from ..services import InvestmentSnapshotService
from ..shared import AccountType, session_scope
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


def investment_overview(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)

    with session_scope(user_id=user_id) as session:
        service = InvestmentSnapshotService(session)
        payload = service.investment_overview()
        response = InvestmentOverviewResponse.model_validate(payload).model_dump(mode="json")

    return json_response(200, response)


def create_investment_snapshot(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /investments/snapshots."""

    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)

    try:
        data = InvestmentSnapshotCreateRequest.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        account = session.get(Account, data.account_id)
        if account is None or account.account_type != AccountType.INVESTMENT:
            return json_response(404, {"error": "Investment account not found"})

        parsed_payload = {"accounts": {account.name: float(data.balance)}}
        snapshot = InvestmentSnapshot(
            user_id=user_id,
            provider="manual",
            report_type="balance_update",
            account_name=account.name,
            snapshot_date=data.snapshot_date,
            portfolio_value=data.balance,
            raw_text=data.notes or "Manual investment balance update",
            parsed_payload=parsed_payload,
            cleaned_payload=None,
            bedrock_metadata=None,
        )
        session.add(snapshot)
        session.flush()
        snapshot_id = snapshot.id

    response = InvestmentSnapshotCreateResponse(
        snapshot_id=snapshot_id,
        account_id=data.account_id,
        snapshot_date=data.snapshot_date,
        balance=data.balance,
    )
    return json_response(201, response.model_dump(mode="json"))


__all__ = [
    "list_investment_transactions",
    "reset_handler_state",
    "investment_overview",
    "create_investment_snapshot",
]
