"""Serverless HTTP handlers for loan operations."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict

from pydantic import ValidationError

from ..schemas import (
    LoanCreateRequest,
    LoanEventListQuery,
    LoanEventRead,
    LoanRead,
    LoanScheduleQuery,
    LoanScheduleRead,
    LoanUpdate,
)
from ..services import LoanService
from ..shared import session_scope
from .utils import (
    ensure_engine,
    extract_path_uuid,
    get_query_params,
    get_user_id,
    json_response,
    parse_body,
    reset_engine_state,
)


def reset_handler_state() -> None:
    reset_engine_state()


def create_loan(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)

    try:
        data = LoanCreateRequest.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = LoanService(session)
        try:
            loan = service.attach_loan(
                data.account_id,
                loan_kwargs=data.model_dump(exclude={"account_id"}),
            )
        except LookupError:
            return json_response(404, {"error": "Account not found"})
        except ValueError as exc:
            return json_response(400, {"error": str(exc)})

        response = LoanRead.model_validate(loan)
    return json_response(201, response.model_dump(mode="json"))


def update_loan(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)
    account_id = extract_path_uuid(event, param_names=("account_id", "accountId"))
    if account_id is None:
        return json_response(400, {"error": "Account ID missing from path"})

    try:
        data = LoanUpdate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    update_fields = data.model_dump(exclude_unset=True)

    with session_scope(user_id=user_id) as session:
        service = LoanService(session)
        try:
            loan = service.update_loan(account_id, update_fields)
        except LookupError:
            return json_response(404, {"error": "Loan not found"})

        response = LoanRead.model_validate(loan)
    return json_response(200, response.model_dump(mode="json"))


def list_loan_events(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    account_id = extract_path_uuid(event, param_names=("account_id", "accountId"))
    if account_id is None:
        return json_response(400, {"error": "Account ID missing from path"})

    params = get_query_params(event)
    try:
        query = LoanEventListQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = LoanService(session)
        try:
            events = service.list_events(
                account_id,
                limit=query.limit,
                offset=query.offset,
            )
        except LookupError:
            return json_response(404, {"error": "Loan not found"})

        response = [LoanEventRead.model_validate(event) for event in events]
    return json_response(
        200,
        {"events": [item.model_dump(mode="json") for item in response]},
    )


def get_loan_schedule(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    account_id = extract_path_uuid(event, param_names=("account_id", "accountId"))
    if account_id is None:
        return json_response(400, {"error": "Account ID missing from path"})

    params = get_query_params(event)
    try:
        query = LoanScheduleQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    as_of_date = query.as_of_date or datetime.now(timezone.utc).date()
    generated_at = datetime.now(timezone.utc)

    with session_scope(user_id=user_id) as session:
        service = LoanService(session)
        try:
            loan = service.get_loan(account_id)
        except LookupError:
            return json_response(404, {"error": "Loan not found"})

        schedule_entries = service.generate_schedule(
            account_id,
            as_of_date=as_of_date,
            periods=query.periods,
        )
        loan_id = loan.id

    response = LoanScheduleRead(
        account_id=account_id,
        loan_id=loan_id,
        generated_at=generated_at,
        as_of_date=as_of_date,
        schedule=schedule_entries,
    )
    return json_response(200, response.model_dump(mode="json"))


__all__ = [
    "create_loan",
    "update_loan",
    "list_loan_events",
    "get_loan_schedule",
    "reset_handler_state",
]
