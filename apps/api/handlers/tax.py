"""Serverless HTTP handlers for tax endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from pydantic import ValidationError

from ..schemas import (
    TaxEventCreateRequest,
    TaxEventListQuery,
    TaxEventListResponse,
    TaxEventRead,
    TaxSummaryQuery,
    TaxSummaryResponse,
)
from ..services.tax import TaxService
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


def create_tax_event(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)

    try:
        data = TaxEventCreateRequest.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = TaxService(session)
        try:
            created_event, created_tx = service.create_tax_event(
                account_id=data.account_id,
                occurred_at=data.occurred_at,
                posted_at=data.posted_at,
                amount=data.amount,
                event_type=data.event_type,
                description=data.description,
                authority=data.authority,
                note=data.note,
            )
        except LookupError:
            return json_response(404, {"error": "Account not found"})
        except ValueError as exc:
            return json_response(400, {"error": str(exc)})

        response = {
            "tax_event": TaxEventRead.model_validate(created_event).model_dump(mode="json"),
            "transaction": created_tx.model_dump(mode="json"),
        }
        return json_response(201, response)


def list_tax_events(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    params = get_query_params(event)

    try:
        query = TaxEventListQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = TaxService(session)
        items = service.list_events(
            start_date=query.start_date,
            end_date=query.end_date,
            limit=query.limit,
            offset=query.offset,
        )

    payload = TaxEventListResponse(events=items)
    return json_response(200, payload.model_dump(mode="json"))


def tax_summary(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    params = get_query_params(event)

    try:
        query = TaxSummaryQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    year = query.year or datetime.now(timezone.utc).year

    with session_scope(user_id=user_id) as session:
        service = TaxService(session)
        monthly, totals = service.summary_for_year(year=year)

    payload = TaxSummaryResponse(year=year, monthly=monthly, totals=totals)
    return json_response(200, payload.model_dump(mode="json"))


__all__ = [
    "create_tax_event",
    "list_tax_events",
    "tax_summary",
    "reset_handler_state",
]
