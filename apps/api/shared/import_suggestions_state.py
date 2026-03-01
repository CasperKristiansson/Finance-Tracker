"""DynamoDB-backed state store for import suggestion jobs/results."""

from __future__ import annotations

import os
import time
from decimal import Decimal
from typing import Any
from uuid import UUID

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from pydantic import ValidationError

from ..schemas import ImportCategorySuggestionRead

_CONNECTIONS_TABLE_ENV = "IMPORT_SUGGESTIONS_CONNECTIONS_TABLE"
_STATE_KEY_PREFIX = "batch#"
_STATE_ITEM_TYPE = "import_suggestions_state"
_STATE_TTL_SECONDS = 60 * 60 * 24 * 14
_VALID_STATUSES = {"not_started", "running", "completed", "failed"}


def load_import_suggestions_state(
    import_batch_id: UUID,
    *,
    user_id: str | None = None,
) -> dict[str, Any] | None:
    """Load persisted suggestion state for an import batch."""

    table = _get_table()
    if table is None:
        return None

    try:
        response = table.get_item(
            Key={"connection_id": _state_pk(import_batch_id)},
        )
    except (BotoCoreError, ClientError):
        return None

    item = response.get("Item")
    if not isinstance(item, dict):
        return None
    item_user_id = _as_str(item.get("user_id"))
    if user_id and item_user_id and item_user_id != user_id:
        return None

    status = _normalize_status(item.get("status"))
    error = _as_str(item.get("error"))
    raw_suggestions = item.get("suggestions")
    suggestions: list[ImportCategorySuggestionRead] = []
    if isinstance(raw_suggestions, list):
        for raw in raw_suggestions:
            if not isinstance(raw, dict):
                continue
            normalized = dict(raw)
            if isinstance(normalized.get("confidence"), Decimal):
                normalized["confidence"] = float(normalized["confidence"])
            try:
                suggestions.append(ImportCategorySuggestionRead.model_validate(normalized))
            except ValidationError:  # pragma: no cover - defensive
                continue

    return {
        "status": status,
        "error": error,
        "suggestions": suggestions,
    }


def save_import_suggestions_state(
    *,
    import_batch_id: UUID,
    user_id: str,
    status: str,
    suggestions: list[ImportCategorySuggestionRead] | None = None,
    error: str | None = None,
) -> bool:
    """Persist suggestion state for an import batch."""

    table = _get_table()
    if table is None:
        return False

    normalized_status = _normalize_status(status)
    now = int(time.time())
    item: dict[str, Any] = {
        "connection_id": _state_pk(import_batch_id),
        "item_type": _STATE_ITEM_TYPE,
        "import_batch_id": str(import_batch_id),
        "user_id": user_id,
        "status": normalized_status,
        "updated_at": now,
        "expires_at": now + _STATE_TTL_SECONDS,
    }
    if error:
        item["error"] = str(error).strip()[:220]
    if suggestions is not None:
        item["suggestions"] = [entry.model_dump(mode="json") for entry in suggestions]

    try:
        table.put_item(Item=_to_dynamodb_value(item))
    except (BotoCoreError, ClientError):
        return False
    return True


def delete_import_suggestions_state(import_batch_id: UUID) -> bool:
    """Remove persisted suggestion state for an import batch."""

    table = _get_table()
    if table is None:
        return False
    try:
        table.delete_item(Key={"connection_id": _state_pk(import_batch_id)})
    except (BotoCoreError, ClientError):
        return False
    return True


def _get_table():
    table_name = os.getenv(_CONNECTIONS_TABLE_ENV)
    if not table_name:
        return None
    resource = boto3.resource(
        "dynamodb",
        config=Config(connect_timeout=1, read_timeout=1, retries={"max_attempts": 1}),
    )
    return resource.Table(table_name)


def _state_pk(import_batch_id: UUID) -> str:
    return f"{_STATE_KEY_PREFIX}{import_batch_id}"


def _normalize_status(value: Any) -> str:
    text = _as_str(value)
    if text is None:
        return "not_started"
    normalized = text.strip().lower()
    if normalized in _VALID_STATUSES:
        return normalized
    return "not_started"


def _as_str(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return str(value)


def _to_dynamodb_value(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, list):
        return [_to_dynamodb_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _to_dynamodb_value(item) for key, item in value.items()}
    return value


__all__ = [
    "load_import_suggestions_state",
    "save_import_suggestions_state",
    "delete_import_suggestions_state",
]
