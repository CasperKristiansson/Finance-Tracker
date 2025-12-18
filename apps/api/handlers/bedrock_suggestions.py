"""Serverless handler for Bedrock-based category suggestions (no DB access)."""

from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, Optional
from uuid import UUID

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from pydantic import ValidationError

from ..schemas import (
    ImportCategorySuggestionRead,
    ImportCategorySuggestRequest,
    ImportCategorySuggestResponse,
)
from .utils import get_user_id, json_response, parse_body

BEDROCK_MODEL_ID_DEFAULT = "anthropic.claude-3-5-haiku-20241022-v1:0"
_MAX_HISTORY = 200
_MAX_TRANSACTIONS = 200


def suggest_import_categories(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /imports/suggest-categories."""

    _ = get_user_id(event)
    parsed_body = parse_body(event)

    try:
        request = ImportCategorySuggestRequest.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    client = _get_bedrock_client()
    if client is None:
        return json_response(503, {"error": "Bedrock client unavailable"})

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
    prompt = (
        "You suggest transaction categories for a personal finance app.\n"
        "Constraints:\n"
        "- You MUST pick category_id from categories.id, or null if unsure.\n"
        "- Prefer matching past behavior from history when applicable.\n"
        "- Return ONLY valid JSON with shape:\n"
        '  {"suggestions":[{"id":string,"category_id":string|null,"confidence":number,'
        '"reason":string}]}\n'
        "No markdown, no prose.\n"
        f"Data: {json.dumps(prompt_data, ensure_ascii=False)}"
    )

    model_id = request.model_id or BEDROCK_MODEL_ID_DEFAULT
    max_tokens = request.max_tokens or 1200
    payload = {
        "messages": [{"role": "user", "content": [{"type": "text", "text": prompt}]}],
        "max_tokens": max_tokens,
        "temperature": 0.2,
        "top_p": 0.9,
    }

    try:
        response = client.invoke_model(
            modelId=model_id,
            contentType="application/json",
            accept="application/json",
            body=json.dumps(payload),
        )
    except (BotoCoreError, ClientError) as exc:  # pragma: no cover - environment dependent
        return json_response(502, {"error": f"Bedrock invocation failed: {exc}"})

    raw_body = response.get("body")
    if raw_body is None:
        return json_response(502, {"error": "Empty Bedrock response"})

    body_text = raw_body.read().decode("utf-8")
    parsed = _safe_json_loads(body_text)
    output_text = ""
    if isinstance(parsed, dict):
        output_text = parsed.get("output_text") or parsed.get("content", [{}])[0].get("text") or ""
    parsed_json = _extract_json(output_text)
    if not isinstance(parsed_json, dict):
        return json_response(502, {"error": "Bedrock response was not valid JSON"})

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

    payload_out = ImportCategorySuggestResponse(suggestions=suggestions).model_dump(mode="json")
    return json_response(200, payload_out)


def _safe_json_loads(text: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return None


def _extract_json(text: str) -> Any:
    cleaned = text.strip()
    cleaned = re.sub(r"^```(json)?\\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\\s*```$", "", cleaned)
    parsed = _safe_json_loads(cleaned)
    if parsed is not None:
        return parsed

    match = re.search(r"\\{.*\\}", cleaned, flags=re.DOTALL)
    if not match:
        return None
    return _safe_json_loads(match.group(0))


def _get_bedrock_client():
    region = os.getenv("BEDROCK_REGION") or os.getenv("AWS_REGION") or "eu-north-1"
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
]
