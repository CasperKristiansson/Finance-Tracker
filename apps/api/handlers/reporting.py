"""Serverless HTTP handlers for reporting endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO, StringIO
import base64
from typing import Any, Dict, Iterable
import csv

from pydantic import ValidationError

from ..schemas import (
    ExportReportRequest,
    ExportReportResponse,
    MonthlyReportEntry,
    MonthlyReportQuery,
    MonthlyReportResponse,
    NetWorthHistoryQuery,
    NetWorthHistoryResponse,
    NetWorthPoint,
    QuarterlyReportEntry,
    QuarterlyReportQuery,
    QuarterlyReportResponse,
    DateRangeReportQuery,
    DateRangeReportResponse,
    TotalReportQuery,
    TotalReportRead,
    YearlyReportEntry,
    YearlyReportQuery,
    YearlyReportResponse,
)
from ..services import ReportingService
from ..shared import session_scope
from .utils import ensure_engine, get_query_params, json_response, parse_body, reset_engine_state


def reset_handler_state() -> None:
    reset_engine_state()


def _to_csv(headers: Iterable[str], rows: Iterable[Iterable[str]]) -> str:
    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(headers)
    for row in rows:
        writer.writerow(row)
    return buffer.getvalue()


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


def quarterly_report(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    try:
        query = QuarterlyReportQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = ReportingService(session)
        results = service.quarterly_report(
            year=query.year,
            account_ids=query.account_ids,
            category_ids=query.category_ids,
        )
        payload = QuarterlyReportResponse(
            results=[QuarterlyReportEntry.model_validate(item) for item in results]
        )
    return json_response(200, payload.model_dump(mode="json"))


def date_range_report(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    try:
        query = DateRangeReportQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = ReportingService(session)
        results = service.date_range_report(
            start_date=query.start_date,
            end_date=query.end_date,
            account_ids=query.account_ids,
            category_ids=query.category_ids,
        )
        payload = DateRangeReportResponse(
            results=[MonthlyReportEntry.model_validate(item) for item in results]
        )
    return json_response(200, payload.model_dump(mode="json"))


def net_worth_history(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    try:
        query = NetWorthHistoryQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = ReportingService(session)
        results = service.net_worth_history(account_ids=query.account_ids)
        payload = NetWorthHistoryResponse(
            points=[NetWorthPoint.model_validate(item) for item in results]
        )
    return json_response(200, payload.model_dump(mode="json"))


def export_report(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    payload = parse_body(event)

    try:
        request = ExportReportRequest.from_payload(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = ReportingService(session)
        granularity = request.granularity

        if granularity == "monthly":
            data = service.monthly_report(
                year=request.year,
                account_ids=request.account_ids,
                category_ids=request.category_ids,
            )
            headers = ["period", "income", "expense", "net"]
            rows = [
                [item.period.isoformat(), str(item.income), str(item.expense), str(item.net)]
                for item in data
            ]
            filename = f"monthly-report-{request.year or 'all'}.{request.format}"
        elif granularity == "yearly":
            data = service.yearly_report(
                account_ids=request.account_ids,
                category_ids=request.category_ids,
            )
            headers = ["year", "income", "expense", "net"]
            rows = [[item.year, str(item.income), str(item.expense), str(item.net)] for item in data]
            filename = f"yearly-report.{request.format}"
        elif granularity == "quarterly":
            data = service.quarterly_report(
                year=request.year,
                account_ids=request.account_ids,
                category_ids=request.category_ids,
            )
            headers = ["year", "quarter", "income", "expense", "net"]
            rows = [
                [item.year, item.quarter, str(item.income), str(item.expense), str(item.net)]
                for item in data
            ]
            filename = f"quarterly-report-{request.year or 'all'}.{request.format}"
        elif granularity == "total":
            item = service.total_report(
                account_ids=request.account_ids,
                category_ids=request.category_ids,
                start_date=request.start_date,
                end_date=request.end_date,
            )
            headers = ["income", "expense", "net"]
            rows = [[str(item.income), str(item.expense), str(item.net)]]
            filename = f"totals-report.{request.format}"
        else:  # net_worth
            data = service.net_worth_history(account_ids=request.account_ids)
            headers = ["period", "net_worth"]
            rows = [[point.period.isoformat(), str(point.net_worth)] for point in data]
            filename = f"net-worth-history.{request.format}"

    if request.format == "csv":
        content = _to_csv(headers, rows).encode()
        content_type = "text/csv"
    else:
        from openpyxl import Workbook

        wb = Workbook()
        ws = wb.active
        ws.append(list(headers))
        for row in rows:
            ws.append(list(row))
        stream = BytesIO()
        wb.save(stream)
        content = stream.getvalue()
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    response = ExportReportResponse(
        filename=filename,
        content_type=content_type,
        data_base64=base64.b64encode(content).decode("utf-8"),
    )
    return json_response(200, response.model_dump(mode="json"))


__all__ = [
    "monthly_report",
    "quarterly_report",
    "date_range_report",
    "export_report",
    "yearly_report",
    "total_report",
    "net_worth_history",
    "reset_handler_state",
]
