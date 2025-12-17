"""Serverless HTTP handlers for imports (stateless preview + commit)."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from ..schemas import (
    ImportCommitRequest,
    ImportCommitResponse,
    ImportPreviewRequest,
    ImportPreviewResponse,
)
from ..services import ImportService
from ..shared import session_scope
from .utils import ensure_engine, get_user_id, json_response, parse_body, reset_engine_state


def reset_handler_state() -> None:
    reset_engine_state()


def preview_imports(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /imports/preview."""

    ensure_engine()
    user_id = get_user_id(event)
    parsed_body = parse_body(event)

    try:
        data = ImportPreviewRequest.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = ImportService(session)
        try:
            preview = service.preview_import(data)
        except LookupError as exc:
            return json_response(404, {"error": str(exc)})
        except ValueError as exc:
            return json_response(400, {"error": str(exc)})

    response = ImportPreviewResponse.model_validate(preview).model_dump(mode="json")
    return json_response(200, response)


def commit_imports(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /imports/commit."""

    ensure_engine()
    user_id = get_user_id(event)
    parsed_body = parse_body(event)

    try:
        data = ImportCommitRequest.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    try:
        with session_scope(user_id=user_id) as session:
            service = ImportService(session)
            result = service.commit_import(data)
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    except ValueError as exc:
        return json_response(400, {"error": str(exc)})

    response = ImportCommitResponse.model_validate(result).model_dump(mode="json")
    return json_response(200, response)


__all__ = [
    "preview_imports",
    "commit_imports",
    "reset_handler_state",
]
