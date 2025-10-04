"""Serverless HTTP handlers for reporting endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from pydantic import ValidationError

from ..schemas import (
    MonthlyReportEntry,
    MonthlyReportQuery,
    MonthlyReportResponse,
    TotalReportQuery,
    TotalReportRead,
    YearlyReportEntry,
    YearlyReportQuery,
    YearlyReportResponse,
)
from ..services import ReportingService
from ..shared import session_scope
from .utils import ensure_engine, get_query_params, json_response, reset_engine_state


def reset_handler_state() -> None:
    reset_engine_state()


def monthly_report(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    try:
        query = MonthlyReportQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = ReportingService(session)
        results = service.monthly_report(
            year=query.year,
            account_ids=query.account_ids,
            category_ids=query.category_ids,
        )
        payload = MonthlyReportResponse(
            results=[MonthlyReportEntry.model_validate(item) for item in results]
        )
    return json_response(200, payload.model_dump(mode="json"))


def yearly_report(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    try:
        query = YearlyReportQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = ReportingService(session)
        results = service.yearly_report(
            account_ids=query.account_ids,
            category_ids=query.category_ids,
        )
        payload = YearlyReportResponse(
            results=[YearlyReportEntry.model_validate(item) for item in results]
        )
    return json_response(200, payload.model_dump(mode="json"))


def total_report(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    try:
        query = TotalReportQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = ReportingService(session)
        result = service.total_report(
            account_ids=query.account_ids,
            category_ids=query.category_ids,
        )
        payload = TotalReportRead.model_validate(result)
    response = payload.model_dump(mode="json")
    response["generated_at"] = datetime.now(timezone.utc).isoformat()
    return json_response(200, response)


__all__ = [
    "monthly_report",
    "yearly_report",
    "total_report",
    "reset_handler_state",
]
