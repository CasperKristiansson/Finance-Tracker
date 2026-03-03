"""DynamoDB-backed staging store for import draft sessions."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

import boto3
from boto3.dynamodb.conditions import Attr
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

_CONNECTIONS_TABLE_ENV = "IMPORT_SUGGESTIONS_CONNECTIONS_TABLE"
_DRAFT_KEY_PREFIX = "draft#"
_DRAFT_ITEM_TYPE = "import_draft"
_DRAFT_STATUS_DRAFT = "draft"
_DRAFT_STATUS_COMMITTED = "committed"
_DRAFT_TTL_SECONDS = 60 * 60 * 24 * 30
_DYNAMODB_CONFIG = Config(
    connect_timeout=3,
    read_timeout=10,
    retries={"max_attempts": 2},
)


def save_import_draft_preview(
    *,
    user_id: str,
    preview: dict[str, Any],
    note: str | None,
) -> None:
    """Persist an import preview snapshot for resume workflows."""

    table = _get_table()
    if table is None:
        raise RuntimeError("Draft store unavailable")

    import_batch_id = preview.get("import_batch_id")
    if not import_batch_id:
        raise ValueError("import_batch_id is required")
    batch_id_text = str(import_batch_id)
    key = _draft_pk(batch_id_text)

    now = datetime.now(timezone.utc)
    created_at = now.isoformat()
    try:
        existing = table.get_item(Key={"connection_id": key}).get("Item")
        if isinstance(existing, dict) and existing.get("created_at"):
            created_at = str(existing["created_at"])
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError("Draft store unavailable") from exc

    item = {
        "connection_id": key,
        "item_type": _DRAFT_ITEM_TYPE,
        "import_batch_id": batch_id_text,
        "user_id": user_id,
        "status": _DRAFT_STATUS_DRAFT,
        "note": note,
        "created_at": created_at,
        "updated_at": now.isoformat(),
        "preview": _to_dynamodb_value(preview),
        "expires_at": int(now.timestamp()) + _DRAFT_TTL_SECONDS,
    }
    try:
        table.put_item(Item=item)
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError("Draft store unavailable") from exc


def get_import_draft_preview(
    *,
    user_id: str,
    import_batch_id: UUID,
) -> dict[str, Any] | None:
    """Load a draft preview for a user/batch."""

    item = _get_item(import_batch_id=import_batch_id, strict=True)
    if not item or str(item.get("user_id")) != user_id:
        return None
    preview = item.get("preview")
    if not isinstance(preview, dict):
        return None
    return preview


def list_import_draft_summaries(*, user_id: str) -> list[dict[str, Any]]:
    """List resumable draft sessions for a user."""

    table = _get_table()
    if table is None:
        raise RuntimeError("Draft store unavailable")

    items: list[dict[str, Any]] = []
    scan_kwargs: dict[str, Any] = {
        "ConsistentRead": True,
        "FilterExpression": (
            Attr("item_type").eq(_DRAFT_ITEM_TYPE)
            & Attr("user_id").eq(user_id)
            & Attr("status").eq(_DRAFT_STATUS_DRAFT)
        ),
    }
    try:
        while True:
            response = table.scan(**scan_kwargs)
            page_items = response.get("Items") or []
            for entry in page_items:
                if isinstance(entry, dict):
                    items.append(entry)
            last_evaluated_key = response.get("LastEvaluatedKey")
            if not last_evaluated_key:
                break
            scan_kwargs["ExclusiveStartKey"] = last_evaluated_key
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError("Draft store unavailable") from exc
    summaries: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        preview = item.get("preview")
        if not isinstance(preview, dict):
            continue
        files = preview.get("files")
        rows = preview.get("rows")
        if not isinstance(files, list) or not isinstance(rows, list):
            continue
        summaries.append(
            {
                "import_batch_id": item.get("import_batch_id"),
                "note": item.get("note"),
                "created_at": item.get("created_at"),
                "updated_at": item.get("updated_at"),
                "file_count": len(files),
                "row_count": len(rows),
                "error_count": sum(
                    int(file.get("error_count") or 0) for file in files if isinstance(file, dict)
                ),
                "file_names": [
                    str(file.get("filename"))
                    for file in files
                    if isinstance(file, dict) and file.get("filename")
                ],
            }
        )

    summaries.sort(key=lambda entry: str(entry.get("updated_at") or ""), reverse=True)
    return summaries


def save_import_draft_rows(
    *,
    user_id: str,
    import_batch_id: UUID,
    rows: list[dict[str, Any]],
) -> str:
    """Persist draft row edits for a staged import."""

    table = _get_table()
    if table is None:
        raise RuntimeError("Draft store unavailable")

    item = _get_item(import_batch_id=import_batch_id, strict=True)
    if not item or str(item.get("user_id")) != user_id:
        raise LookupError("Import batch not found")
    if str(item.get("status") or _DRAFT_STATUS_DRAFT) == _DRAFT_STATUS_COMMITTED:
        raise ValueError("Import batch is already committed")

    preview = item.get("preview")
    if not isinstance(preview, dict):
        raise LookupError("Import batch not found")

    preview_rows = preview.get("rows")
    files = preview.get("files")
    if not isinstance(preview_rows, list) or not isinstance(files, list):
        raise LookupError("Import batch not found")

    row_by_id = {
        str(row.get("id")): row for row in preview_rows if isinstance(row, dict) and row.get("id")
    }
    valid_file_ids = {
        str(file.get("id")) for file in files if isinstance(file, dict) and file.get("id")
    }

    for row in rows:
        row_id = str(row.get("id") or "")
        existing = row_by_id.get(row_id)
        if existing is None:
            raise ValueError("Draft row references unknown row")

        file_id = row.get("file_id")
        if file_id is not None and str(file_id) not in valid_file_ids:
            raise ValueError("Draft row references unknown file")

        existing["account_id"] = row.get("account_id")
        existing["occurred_at"] = row.get("occurred_at")
        existing["amount"] = row.get("amount")
        existing["description"] = row.get("description")
        existing["draft"] = {
            "account_id": row.get("account_id"),
            "occurred_at": row.get("occurred_at"),
            "amount": row.get("amount"),
            "description": row.get("description"),
            "category_id": row.get("category_id"),
            "transfer_account_id": row.get("transfer_account_id"),
            "tax_event_type": row.get("tax_event_type"),
            "delete": bool(row.get("delete")),
        }

    now = datetime.now(timezone.utc).isoformat()
    item["preview"] = preview
    item["updated_at"] = now

    try:
        table.put_item(Item=item)
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError("Draft store unavailable") from exc

    return now


def delete_import_draft_preview(
    *,
    user_id: str,
    import_batch_id: UUID,
) -> None:
    """Delete a draft preview for a user."""

    table = _get_table()
    if table is None:
        raise RuntimeError("Draft store unavailable")

    item = _get_item(import_batch_id=import_batch_id, strict=True)
    if not item or str(item.get("user_id")) != user_id:
        raise LookupError("Import batch not found")

    try:
        table.delete_item(Key={"connection_id": _draft_pk(import_batch_id)})
    except (BotoCoreError, ClientError) as exc:
        raise RuntimeError("Draft store unavailable") from exc


def mark_import_draft_committed(
    *,
    user_id: str,
    import_batch_id: UUID,
) -> None:
    """Mark a draft as committed so it cannot be resumed/deleted."""

    table = _get_table()
    if table is None:
        return

    item = _get_item(import_batch_id=import_batch_id)
    if not item or str(item.get("user_id")) != user_id:
        return

    item["status"] = _DRAFT_STATUS_COMMITTED
    item["updated_at"] = datetime.now(timezone.utc).isoformat()
    try:
        table.put_item(Item=item)
    except (BotoCoreError, ClientError):
        return


def _get_item(*, import_batch_id: UUID, strict: bool = False) -> dict[str, Any] | None:
    table = _get_table()
    if table is None:
        if strict:
            raise RuntimeError("Draft store unavailable")
        return None
    try:
        response = table.get_item(Key={"connection_id": _draft_pk(import_batch_id)})
    except (BotoCoreError, ClientError) as exc:
        if strict:
            raise RuntimeError("Draft store unavailable") from exc
        return None
    item = response.get("Item")
    if not isinstance(item, dict):
        return None
    if item.get("item_type") != _DRAFT_ITEM_TYPE:
        return None
    return item


def _get_table():
    table_name = os.getenv(_CONNECTIONS_TABLE_ENV)
    if not table_name:
        return None
    resource = boto3.resource("dynamodb", config=_DYNAMODB_CONFIG)
    return resource.Table(table_name)


def _draft_pk(import_batch_id: UUID | str) -> str:
    return f"{_DRAFT_KEY_PREFIX}{import_batch_id}"


def _to_dynamodb_value(value: Any) -> Any:
    if isinstance(value, float):
        return Decimal(str(value))
    if isinstance(value, list):
        return [_to_dynamodb_value(item) for item in value]
    if isinstance(value, dict):
        return {str(key): _to_dynamodb_value(item) for key, item in value.items()}
    return value


__all__ = [
    "save_import_draft_preview",
    "get_import_draft_preview",
    "list_import_draft_summaries",
    "save_import_draft_rows",
    "delete_import_draft_preview",
    "mark_import_draft_committed",
]
