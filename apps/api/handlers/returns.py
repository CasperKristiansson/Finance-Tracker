"""HTTP handlers for return transaction workflows."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from ..schemas import ReturnActionRequest, ReturnListResponse
from ..services import TransactionService
from ..shared import session_scope
from .utils import ensure_engine, get_query_params, get_user_id, json_response, parse_body


def list_returns(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    params = get_query_params(event)
    status_filter = (params.get("status") or "").strip().lower() or None

    with session_scope(user_id=user_id) as session:
        service = TransactionService(session)
        items = service.list_returns()
        if status_filter:
            items = [item for item in items if item.return_status.value == status_filter]
        payload = ReturnListResponse(returns=items)
    return json_response(200, payload.model_dump(mode="json"))


def update_return(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)
    try:
        data = ReturnActionRequest.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = TransactionService(session)
        try:
            updated, parent = service.update_return(
                transaction_id=data.transaction_id, action=data.action
            )
        except LookupError:
            return json_response(404, {"error": "Return not found"})
        except ValueError as exc:
            return json_response(400, {"error": str(exc)})

        if data.action == "detach":
            return json_response(200, {"return_id": str(updated.id), "detached": True})

        summary_parent = parent
        if summary_parent is None and updated.return_parent_id is not None:
            summary_parent = service.repository.get(updated.return_parent_id)
        if summary_parent is None:
            return json_response(
                200, {"return_id": str(updated.id), "status": str(updated.return_status)}
            )

        summary = service.build_return_summary(updated, summary_parent)
        return json_response(200, summary.model_dump(mode="json"))


__all__ = ["list_returns", "update_return"]
