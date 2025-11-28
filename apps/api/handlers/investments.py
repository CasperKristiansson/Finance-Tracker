"""Serverless HTTP handlers for investment snapshots."""

from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import ValidationError

from ..schemas import (
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
    "reset_handler_state",
]
