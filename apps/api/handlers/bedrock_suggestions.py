"""Serverless handler for Bedrock-based category suggestions (no DB access)."""

from __future__ import annotations

import json
import os
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, Optional
from uuid import UUID, uuid4

import boto3
from boto3.dynamodb.conditions import Key
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from pydantic import ValidationError

from ..schemas import (
    ImportCategorySuggestionRead,
    ImportCategorySuggestJobRequest,
    ImportCategorySuggestJobResponse,
    ImportCategorySuggestRequest,
    ImportCategorySuggestResponse,
)
from .utils import get_user_id, json_response, parse_body

BEDROCK_MODEL_ID_DEFAULT = "anthropic.claude-3-haiku-20240307-v1:0"
_MAX_HISTORY = 200
_MAX_TRANSACTIONS = 200
_TOOL_NAME = "categorize_transactions"
_CONNECTIONS_TABLE_ENV = "IMPORT_SUGGESTIONS_CONNECTIONS_TABLE"
_SUGGESTIONS_QUEUE_ENV = "IMPORT_SUGGESTIONS_QUEUE_URL"
_CONNECTION_TTL_SECONDS = 3600


@dataclass(frozen=True)
class SuggestionConnection:
    connection_id: str
    endpoint: str
    client_token: str


class SuggestionError(RuntimeError):
    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


def suggest_import_categories(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /imports/suggest-categories."""

    _ = get_user_id(event)
    parsed_body = parse_body(event)

    try:
        request = ImportCategorySuggestRequest.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    try:
        suggestions = _suggest_with_bedrock(request)
    except SuggestionError as exc:
        return json_response(exc.status_code, {"error": str(exc)})

    payload_out = ImportCategorySuggestResponse(suggestions=suggestions).model_dump(mode="json")
    return json_response(200, payload_out)


def connect_import_suggestions(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    params = event.get("queryStringParameters") or {}
    client_id = params.get("client_id") or params.get("clientId")
    client_token = params.get("token") or params.get("client_token") or params.get("clientToken")
    if not client_id or not client_token:
        return {"statusCode": 400, "body": "Missing client_id or token"}

    request_context = event.get("requestContext") or {}
    connection_id = request_context.get("connectionId")
    domain_name = request_context.get("domainName")
    stage = request_context.get("stage")
    if not connection_id or not domain_name or not stage:
        return {"statusCode": 400, "body": "Invalid websocket context"}

    endpoint = f"https://{domain_name}/{stage}"
    if not _store_connection(
        connection_id=connection_id,
        client_id=client_id,
        client_token=str(client_token),
        endpoint=endpoint,
    ):
        return {"statusCode": 503, "body": "Connection store unavailable"}

    return {"statusCode": 200, "body": "connected"}


def disconnect_import_suggestions(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    request_context = event.get("requestContext") or {}
    connection_id = request_context.get("connectionId")
    if not connection_id:
        return {"statusCode": 400, "body": "Missing connection id"}

    _remove_connection(connection_id)
    return {"statusCode": 200, "body": "disconnected"}


def enqueue_import_category_suggestions(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    _ = get_user_id(event)
    parsed_body = parse_body(event)

    try:
        request = ImportCategorySuggestJobRequest.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    queue_url = os.getenv(_SUGGESTIONS_QUEUE_ENV)
    if not queue_url:
        return json_response(503, {"error": "Suggestion queue unavailable"})

    connection = _fetch_connection_by_client(request.client_id)
    if connection is None:
        return json_response(409, {"error": "Suggestions websocket not connected"})
    if connection.client_token != request.client_token:
        return json_response(403, {"error": "Client token mismatch"})

    job_id = uuid4()
    message_payload = request.model_dump(mode="json")
    message_payload["job_id"] = str(job_id)

    sqs = boto3.client("sqs")
    sqs.send_message(QueueUrl=queue_url, MessageBody=json.dumps(message_payload))

    response_payload = ImportCategorySuggestJobResponse(job_id=job_id).model_dump(mode="json")
    return json_response(202, response_payload)


def process_import_category_suggestions(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    for record in event.get("Records", []):
        body = record.get("body") or ""
        try:
            payload = json.loads(body) if body else {}
            job_id = payload.get("job_id")
            request = ImportCategorySuggestJobRequest.model_validate(payload)
        except (ValueError, ValidationError):
            continue

        message: dict[str, Any]
        try:
            suggestions = _suggest_with_bedrock(request)
            message = {
                "type": "import_suggestions",
                "job_id": job_id,
                "client_id": str(request.client_id),
                "suggestions": [item.model_dump(mode="json") for item in suggestions],
            }
        except SuggestionError as exc:
            message = {
                "type": "import_suggestions_error",
                "job_id": job_id,
                "client_id": str(request.client_id),
                "error": str(exc),
            }

        _send_to_client(request.client_id, request.client_token, message)

    return {"batchItemFailures": []}


def _suggest_with_bedrock(
    request: ImportCategorySuggestRequest,
) -> list[ImportCategorySuggestionRead]:
    client = _get_bedrock_client()
    if client is None:
        raise SuggestionError("Bedrock client unavailable", status_code=503)

    (
        prompt_data,
        category_by_id,
        signature_to_ids,
        rep_id_to_signature,
    ) = _prepare_prompt_data(request)
    model_id, payload = _build_bedrock_payload(prompt_data, request)

    try:
        response = client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(payload),
        )
    except (BotoCoreError, ClientError) as exc:  # pragma: no cover - environment dependent
        raise SuggestionError(f"Bedrock invocation failed: {exc}") from exc

    raw_body = response.get("body")
    if raw_body is None:
        raise SuggestionError("Empty Bedrock response")

    body_text = raw_body.read().decode("utf-8")
    parsed = _safe_json_loads(body_text)
    parsed_json = _extract_tool_input(parsed=parsed, tool_name=_TOOL_NAME)
    if parsed_json is None:
        output_text = _extract_output_text(parsed)
        parsed_json = _extract_json(output_text)
    if isinstance(parsed_json, list):
        parsed_json = {"suggestions": parsed_json}
    if not isinstance(parsed_json, dict):
        stop_reason = _extract_stop_reason(parsed)
        if stop_reason == "max_tokens":
            raise SuggestionError(
                (
                    "Bedrock response was truncated (max_tokens). "
                    "Increase max_tokens or reduce the number of transactions."
                )
            )
        raise SuggestionError("Bedrock response was not valid JSON")

    return _parse_suggestions(
        parsed_json=parsed_json,
        category_by_id=category_by_id,
        signature_to_ids=signature_to_ids,
        rep_id_to_signature=rep_id_to_signature,
    )


def _prepare_prompt_data(
    request: ImportCategorySuggestRequest,
) -> tuple[dict[str, Any], dict[UUID, Any], dict[str, list[UUID]], dict[UUID, str]]:
    category_by_id = {cat.id: cat for cat in request.categories}
    category_payload = [
        {"id": str(cat.id), "name": cat.name, "type": cat.category_type}
        for cat in request.categories
    ]
    history_payload = []
    for item in request.history[:_MAX_HISTORY]:
        category = category_by_id.get(item.category_id)
        history_payload.append(
            {
                "description": item.description,
                "category_id": str(item.category_id),
                "category_name": category.name if category else None,
            }
        )

    signature_to_ids: dict[str, list[UUID]] = {}
    signature_to_payload: dict[str, dict[str, Any]] = {}
    rep_id_to_signature: dict[UUID, str] = {}
    for tx in request.transactions[:_MAX_TRANSACTIONS]:
        signature = _signature(tx.description)
        signature_to_ids.setdefault(signature, []).append(tx.id)
        if signature not in signature_to_payload:
            signature_to_payload[signature] = {
                "id": str(tx.id),
                "description": tx.description,
                "amount": tx.amount,
                "occurred_at": tx.occurred_at,
                "count": 1,
            }
            rep_id_to_signature[tx.id] = signature
        else:
            signature_to_payload[signature]["count"] = (
                int(signature_to_payload[signature]["count"]) + 1
            )

    tx_payload = list(signature_to_payload.values())

    prompt_data = {
        "categories": category_payload,
        "history": history_payload,
        "transactions": tx_payload,
    }
    return prompt_data, category_by_id, signature_to_ids, rep_id_to_signature


def _build_bedrock_payload(
    prompt_data: dict[str, Any],
    request: ImportCategorySuggestRequest,
) -> tuple[str, dict[str, Any]]:
    system = (
        "You suggest transaction categories for a personal finance app.\n"
        "Rules:\n"
        "- You MUST choose category_id from categories.id, or null if unsure.\n"
        "- Prefer matching past behavior from history when applicable.\n"
        "- Confidence must be between 0 and 0.99.\n"
        "- Keep reason short (<= 60 characters).\n"
        "- Use the provided tool and do not output any prose.\n"
    )
    user_text = json.dumps(prompt_data, ensure_ascii=False)

    model_id = request.model_id or BEDROCK_MODEL_ID_DEFAULT
    max_tokens = request.max_tokens or 1200
    tools = [
        {
            "name": _TOOL_NAME,
            "description": "Return category suggestions for the given transactions.",
            "input_schema": {
                "type": "object",
                "properties": {
                    "suggestions": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string"},
                                "category_id": {"type": ["string", "null"]},
                                "confidence": {"type": "number"},
                                "reason": {"type": "string"},
                            },
                            "required": ["id", "category_id", "confidence"],
                        },
                    }
                },
                "required": ["suggestions"],
            },
        }
    ]
    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "system": system,
        "messages": [{"role": "user", "content": [{"type": "text", "text": user_text}]}],
        "tools": tools,
        "tool_choice": {"type": "tool", "name": _TOOL_NAME},
        "max_tokens": max_tokens,
        "temperature": 0.0,
        "top_p": 0.9,
    }
    return model_id, payload


def _parse_suggestions(
    *,
    parsed_json: dict[str, Any],
    category_by_id: dict[UUID, Any],
    signature_to_ids: dict[str, list[UUID]],
    rep_id_to_signature: dict[UUID, str],
) -> list[ImportCategorySuggestionRead]:
    raw_suggestions = parsed_json.get("suggestions")
    if not isinstance(raw_suggestions, list):
        raw_suggestions = []

    suggestions: list[ImportCategorySuggestionRead] = []
    for item in raw_suggestions:
        if not isinstance(item, dict):
            continue
        raw_id = item.get("id")
        if not isinstance(raw_id, str):
            continue
        try:
            tx_id = UUID(raw_id)
        except ValueError:
            continue

        category_id: Optional[UUID] = None
        raw_category_id = item.get("category_id")
        if isinstance(raw_category_id, str) and raw_category_id:
            try:
                category_id = UUID(raw_category_id)
            except ValueError:
                category_id = None
        if category_id is not None and category_id not in category_by_id:
            category_id = None

        raw_confidence = item.get("confidence")
        confidence = 0.6
        if isinstance(raw_confidence, (int, float, str)):
            try:
                confidence = float(raw_confidence)
            except ValueError:
                confidence = 0.6
        confidence = max(0.0, min(confidence, 0.99))

        reason = item.get("reason")
        reason_text = str(reason)[:220] if isinstance(reason, str) and reason else None

        signature = rep_id_to_signature.get(tx_id) or ""
        for original_id in signature_to_ids.get(signature, [tx_id]):
            suggestions.append(
                ImportCategorySuggestionRead(
                    id=original_id,
                    category_id=category_id,
                    confidence=confidence,
                    reason=reason_text,
                )
            )

    return suggestions


def _get_connections_table():
    table_name = os.getenv(_CONNECTIONS_TABLE_ENV)
    if not table_name:
        return None
    return boto3.resource("dynamodb").Table(table_name)


def _store_connection(
    *,
    connection_id: str,
    client_id: str,
    client_token: str,
    endpoint: str,
) -> bool:
    table = _get_connections_table()
    if table is None:
        return False
    expires_at = int(time.time()) + _CONNECTION_TTL_SECONDS
    table.put_item(
        Item={
            "connection_id": connection_id,
            "client_id": client_id,
            "client_token": client_token,
            "endpoint": endpoint,
            "expires_at": expires_at,
        }
    )
    return True


def _remove_connection(connection_id: str) -> None:
    table = _get_connections_table()
    if table is None:
        return
    table.delete_item(Key={"connection_id": connection_id})


def _fetch_connection_by_client(client_id: UUID) -> Optional[SuggestionConnection]:
    table = _get_connections_table()
    if table is None:
        return None
    response = table.query(
        IndexName="client_id-index",
        KeyConditionExpression=Key("client_id").eq(str(client_id)),
        Limit=1,
    )
    items = response.get("Items") or []
    if not items:
        return None
    item = items[0]
    connection_id = item.get("connection_id")
    endpoint = item.get("endpoint")
    client_token = item.get("client_token")
    if not connection_id or not endpoint or not client_token:
        return None
    return SuggestionConnection(
        connection_id=str(connection_id),
        endpoint=str(endpoint),
        client_token=str(client_token),
    )


def _post_to_connection(connection: SuggestionConnection, payload: dict[str, Any]) -> None:
    client = boto3.client("apigatewaymanagementapi", endpoint_url=connection.endpoint)
    try:
        client.post_to_connection(
            ConnectionId=connection.connection_id,
            Data=json.dumps(payload).encode("utf-8"),
        )
    except ClientError as exc:  # pragma: no cover - environment dependent
        code = exc.response.get("Error", {}).get("Code")
        if code == "GoneException":
            _remove_connection(connection.connection_id)
            return
        raise


def _send_to_client(client_id: UUID, client_token: str, payload: dict[str, Any]) -> None:
    connection = _fetch_connection_by_client(client_id)
    if connection is None:
        return
    if connection.client_token != client_token:
        return
    _post_to_connection(connection, payload)


def _safe_json_loads(text: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _extract_stop_reason(parsed: Any) -> str | None:
    if not isinstance(parsed, dict):
        return None
    stop_reason = parsed.get("stop_reason")
    return stop_reason if isinstance(stop_reason, str) else None


def _extract_tool_input(*, parsed: Any, tool_name: str) -> dict[str, Any] | list[Any] | None:
    if not isinstance(parsed, dict):
        return None

    content = parsed.get("content")
    if not isinstance(content, list):
        return None

    for item in content:
        if not isinstance(item, dict):
            continue
        if item.get("type") != "tool_use":
            continue
        if item.get("name") != tool_name:
            continue
        tool_input = item.get("input")
        if isinstance(tool_input, dict):
            return tool_input
        if isinstance(tool_input, list):
            return tool_input
        if isinstance(tool_input, str):
            parsed_input = _safe_json_loads(tool_input)
            if isinstance(parsed_input, (dict, list)):
                return parsed_input

    return None


def _extract_output_text(parsed: Any) -> str:
    if not isinstance(parsed, dict):
        return ""

    output_text = parsed.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    content = parsed.get("content")
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            text = item.get("text")
            if isinstance(text, str) and text:
                parts.append(text)
        return "".join(parts).strip()

    completion = parsed.get("completion")
    if isinstance(completion, str) and completion.strip():
        return completion

    return ""


def _extract_json(text: str) -> Any:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(json)?\\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\\s*```$", "", cleaned)
    parsed = _safe_json_loads(cleaned)
    if parsed is not None:
        return parsed

    obj_match = re.search(r"\\{.*\\}", cleaned, flags=re.DOTALL)
    if obj_match:
        parsed_obj = _safe_json_loads(obj_match.group(0))
        if parsed_obj is not None:
            return parsed_obj

    arr_match = re.search(r"\\[.*\\]", cleaned, flags=re.DOTALL)
    if arr_match:
        return _safe_json_loads(arr_match.group(0))

    return None


def _get_bedrock_client():
    region = os.getenv("BEDROCK_REGION") or "eu-west-1"
    try:
        return boto3.client(
            "bedrock-runtime",
            region_name=region,
            config=Config(connect_timeout=3, read_timeout=12, retries={"max_attempts": 2}),
        )
    except (BotoCoreError, ClientError):  # pragma: no cover - environment dependent
        return None


def _signature(description: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\\s]", " ", (description or "")).lower()
    cleaned = re.sub(r"\\s+", " ", cleaned).strip()
    cleaned = re.sub(r"\\b\\d+\\b", "", cleaned).strip()
    return cleaned[:120]


__all__ = [
    "suggest_import_categories",
    "connect_import_suggestions",
    "disconnect_import_suggestions",
    "enqueue_import_category_suggestions",
    "process_import_category_suggestions",
]
