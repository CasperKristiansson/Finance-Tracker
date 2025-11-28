"""Shared handler utilities for Lambda functions."""

from __future__ import annotations

import base64
import json
import os
from datetime import datetime
from typing import Any, Dict, Optional, Sequence
from uuid import UUID

from sqlalchemy.pool import StaticPool

from ..shared import configure_engine, configure_engine_from_env, get_default_user_id, get_engine

_JSON_HEADERS = {"Content-Type": "application/json"}
_DEFAULT_CONNECT_TIMEOUT = 10
_CONNECT_TIMEOUT_ENV = "DB_CONNECT_TIMEOUT_SECONDS"


def json_response(status_code: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Return a standard JSON HTTP response payload."""

    return {
        "statusCode": status_code,
        "headers": _JSON_HEADERS,
        "body": json.dumps(payload, default=_json_default),
    }


def parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
    body = event.get("body")
    if body is None:
        return {}
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    if isinstance(body, (bytes, bytearray)):
        body = body.decode("utf-8")
    if isinstance(body, str) and body.strip():
        return json.loads(body)
    return {}


def get_query_params(event: Dict[str, Any]) -> Dict[str, Any]:
    return event.get("queryStringParameters") or {}


def get_user_id(event: Dict[str, Any]) -> str:
    """Extract the Cognito user id, preferring username over sub."""

    request_context = event.get("requestContext") or {}
    authorizer = request_context.get("authorizer") or {}
    jwt = authorizer.get("jwt") or {}
    claims = jwt.get("claims") or authorizer.get("claims") or {}

    user_id = None
    if isinstance(claims, dict):
        user_id = claims.get("username") or claims.get("cognito:username") or claims.get("sub")

    return str(user_id or get_default_user_id())


def extract_path_uuid(
    event: Dict[str, Any],
    *,
    param_names: Sequence[str],
) -> Optional[UUID]:
    path_parameters = event.get("pathParameters") or {}
    raw_id: Optional[str] = None
    for key in param_names:
        value = path_parameters.get(key)
        if value:
            raw_id = value
            break
    if raw_id is None:
        raw_path = event.get("rawPath") or event.get("path") or ""
        segments = [segment for segment in raw_path.split("/") if segment]
        if segments and len(segments) >= 2:
            raw_id = segments[-1]
    if raw_id is None:
        return None
    try:
        return UUID(raw_id)
    except ValueError:
        return None


def _json_default(obj: Any) -> Any:
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, datetime):
        return obj.isoformat()
    return str(obj)


__all__ = [
    "ensure_engine",
    "reset_engine_state",
    "json_response",
    "parse_body",
    "get_query_params",
    "get_user_id",
    "extract_path_uuid",
]
_ENGINE_INITIALIZED = False


def _read_connect_timeout() -> int:
    try:
        raw = os.environ.get(_CONNECT_TIMEOUT_ENV)
        if not raw:
            return _DEFAULT_CONNECT_TIMEOUT
        return max(3, int(raw))
    except ValueError:
        return _DEFAULT_CONNECT_TIMEOUT


def reset_engine_state() -> None:
    """Reset cached engine initialization state (primarily for tests)."""

    global _ENGINE_INITIALIZED
    _ENGINE_INITIALIZED = False


def ensure_engine() -> None:
    """Ensure a database engine is configured for handler execution."""

    global _ENGINE_INITIALIZED
    if _ENGINE_INITIALIZED:
        return

    try:
        get_engine()
        _ENGINE_INITIALIZED = True
        return
    except RuntimeError:
        pass

    database_url = os.environ.get("DATABASE_URL")
    connect_timeout = _read_connect_timeout()
    if database_url:
        kwargs: Dict[str, Any] = {}
        if database_url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
            kwargs["poolclass"] = StaticPool
        else:
            kwargs["connect_args"] = {"connect_timeout": connect_timeout}
        configure_engine(database_url, **kwargs)
    else:
        configure_engine_from_env(connect_args={"connect_timeout": connect_timeout})
    _ENGINE_INITIALIZED = True
