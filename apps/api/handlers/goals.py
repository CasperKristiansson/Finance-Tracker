"""Serverless HTTP handlers for goals."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from ..models import Goal
from ..schemas import GoalCreate, GoalListResponse, GoalRead, GoalUpdate
from ..services import GoalService
from ..shared import session_scope
from .utils import ensure_engine, extract_path_uuid, get_user_id, json_response, parse_body


def list_goals(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    with session_scope(user_id=user_id) as session:
        service = GoalService(session)
        goals = service.list()
        payload = GoalListResponse(goals=[_to_schema(service, goal) for goal in goals])
    return json_response(200, payload.model_dump(mode="json"))


def create_goal(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)
    try:
        data = GoalCreate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = GoalService(session)
        goal = service.create(data.model_dump())
        response = _to_schema(service, goal).model_dump(mode="json")
    return json_response(201, response)


def update_goal(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)
    goal_id = extract_path_uuid(event, param_names=("goal_id", "goalId"))
    if goal_id is None:
        return json_response(400, {"error": "Goal ID missing from path"})

    try:
        data = GoalUpdate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = GoalService(session)
        try:
            goal = service.update(goal_id, data.model_dump(exclude_none=True))
        except LookupError:
            return json_response(404, {"error": "Goal not found"})
        response = _to_schema(service, goal).model_dump(mode="json")
    return json_response(200, response)


def delete_goal(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    goal_id = extract_path_uuid(event, param_names=("goal_id", "goalId"))
    if goal_id is None:
        return json_response(400, {"error": "Goal ID missing from path"})
    with session_scope(user_id=user_id) as session:
        service = GoalService(session)
        try:
            service.delete(goal_id)
        except LookupError:
            return json_response(404, {"error": "Goal not found"})
    return json_response(204, {})


def _to_schema(service: GoalService, goal: Goal) -> GoalRead:
    current, pct, achieved_at, achieved_delta_days = service.progress(goal)
    payload = goal.model_dump(mode="python")
    payload["current_amount"] = current
    payload["progress_pct"] = pct
    payload["achieved_at"] = achieved_at
    payload["achieved_delta_days"] = achieved_delta_days
    return GoalRead.model_validate(payload)


__all__ = ["list_goals", "create_goal", "update_goal", "delete_goal"]
