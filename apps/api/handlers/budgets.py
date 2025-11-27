"""Serverless HTTP handlers for budget operations."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from ..schemas import BudgetCreate, BudgetListResponse, BudgetRead, BudgetUpdate
from ..services import BudgetService
from ..shared import session_scope
from .utils import (
    ensure_engine,
    extract_path_uuid,
    json_response,
    parse_body,
    reset_engine_state,
)


def reset_handler_state() -> None:
    reset_engine_state()


def _budget_to_schema(budget) -> BudgetRead:
    return BudgetRead.model_validate(budget)


def list_budgets(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    with session_scope() as session:
        service = BudgetService(session)
        budgets = service.list_budgets()
        response = BudgetListResponse(budgets=[_budget_to_schema(b) for b in budgets])
    return json_response(200, response.model_dump(mode="json"))


def create_budget(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    payload = parse_body(event)
    try:
        data = BudgetCreate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = BudgetService(session)
        try:
            created = service.create_budget(
                category_id=data.category_id,
                period=data.period,
                amount=data.amount,
                note=data.note,
            )
        except LookupError as exc:
            return json_response(404, {"error": str(exc)})
        response = _budget_to_schema(created).model_dump(mode="json")
    return json_response(201, response)


def update_budget(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    payload = parse_body(event)
    budget_id = extract_path_uuid(event, param_names=("budget_id", "budgetId"))
    if budget_id is None:
        return json_response(400, {"error": "Budget ID missing from path"})

    try:
        data = BudgetUpdate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = BudgetService(session)
        try:
            updated = service.update_budget(
                budget_id,
                period=data.period,
                amount=data.amount,
                note=data.note,
            )
        except LookupError:
            return json_response(404, {"error": "Budget not found"})
        response = _budget_to_schema(updated).model_dump(mode="json")
    return json_response(200, response)


def delete_budget(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    budget_id = extract_path_uuid(event, param_names=("budget_id", "budgetId"))
    if budget_id is None:
        return json_response(400, {"error": "Budget ID missing from path"})
    with session_scope() as session:
        service = BudgetService(session)
        try:
            service.delete_budget(budget_id)
        except LookupError:
            return json_response(404, {"error": "Budget not found"})
    return json_response(204, {})


__all__ = [
    "list_budgets",
    "create_budget",
    "update_budget",
    "delete_budget",
    "reset_handler_state",
]
