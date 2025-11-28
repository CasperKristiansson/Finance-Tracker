"""Service layer for investment snapshots (Nordnet exports)."""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional, Tuple

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from sqlmodel import Session

from ..models import InvestmentSnapshot
from ..repositories.investments import InvestmentSnapshotRepository
from ..schemas import NordnetSnapshotCreate
from .nordnet_parser import NordnetPreParser

BEDROCK_REGION = "eu-north-1"
BEDROCK_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0"
BEDROCK_MAX_TOKENS_DEFAULT = 500
BEDROCK_MAX_TOKENS_MIN = 100
BEDROCK_MAX_TOKENS_MAX = 2000


class InvestmentSnapshotService:
    """Coordinates persistence and optional Bedrock cleanup for Nordnet exports."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = InvestmentSnapshotRepository(session)
        self.pre_parser = NordnetPreParser()

    def create_nordnet_snapshot(self, payload: NordnetSnapshotCreate) -> InvestmentSnapshot:
        parsed_payload = payload.parsed_payload or self.parse_nordnet_export(
            payload.raw_text, payload.manual_payload
        )
        if payload.manual_payload:
            parsed_payload = self._deep_merge(parsed_payload, payload.manual_payload)
        parsed_payload = self._coerce_json_safe(parsed_payload)

        snapshot_date = payload.snapshot_date or self._extract_snapshot_date(parsed_payload)
        if snapshot_date is None:
            raise ValueError("snapshot_date could not be derived from payload")

        portfolio_value = payload.portfolio_value
        if portfolio_value is None:
            portfolio_value = self._extract_portfolio_value(parsed_payload)

        cleaned_payload: Optional[dict[str, Any]] = None
        bedrock_metadata: Optional[dict[str, Any]] = None

        if payload.use_bedrock:
            cleaned_payload, bedrock_metadata = self._clean_with_bedrock(
                payload.raw_text,
                parsed_payload,
                model_id=payload.bedrock_model_id,
                max_tokens=payload.bedrock_max_tokens,
            )
            if cleaned_payload:
                cleaned_payload = self._coerce_json_safe(cleaned_payload)
            if bedrock_metadata:
                bedrock_metadata = self._coerce_json_safe(bedrock_metadata)

        snapshot = InvestmentSnapshot(
            provider="nordnet",
            report_type=payload.report_type,
            account_name=payload.account_name,
            snapshot_date=snapshot_date,
            portfolio_value=portfolio_value,
            raw_text=payload.raw_text,
            parsed_payload=parsed_payload,
            cleaned_payload=cleaned_payload,
            bedrock_metadata=bedrock_metadata,
        )
        return self.repository.create(snapshot)

    def list_snapshots(self, limit: Optional[int] = None) -> list[InvestmentSnapshot]:
        return self.repository.list(limit=limit)

    def parse_nordnet_export(
        self, raw_text: str, manual_payload: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        parsed = self.pre_parser.parse(raw_text)
        if manual_payload:
            parsed = self._deep_merge(parsed, manual_payload)
        return self._coerce_json_safe(parsed)

    def _extract_snapshot_date(self, payload: dict[str, Any]):
        date_value = payload.get("snapshot_date")
        if date_value is None:
            return None
        if isinstance(date_value, str):
            try:
                return datetime.fromisoformat(date_value).date()
            except ValueError:
                return None
        if isinstance(date_value, datetime):
            return date_value.date()
        return date_value

    def _extract_portfolio_value(self, payload: dict[str, Any]):
        value = payload.get("portfolio_value")
        if value is None:
            return None
        try:
            if isinstance(value, (int, float)):
                return Decimal(str(value))
            return Decimal(str(value))
        except Exception:
            return None

    def _deep_merge(self, base: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
        merged = dict(base)
        for key, value in overrides.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = self._deep_merge(merged[key], value)  # type: ignore[arg-type]
            else:
                merged[key] = value
        return merged

    def _coerce_json_safe(self, value: Any):
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, list):
            return [self._coerce_json_safe(item) for item in value]
        if isinstance(value, dict):
            return {key: self._coerce_json_safe(val) for key, val in value.items()}
        return value

    def _clean_with_bedrock(
        self,
        raw_text: str,
        parsed_payload: dict[str, Any],
        *,
        model_id: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> Tuple[Optional[dict[str, Any]], Optional[dict[str, Any]]]:
        client = self._get_bedrock_client()
        if client is None:
            return None, None

        rows = self._extract_rows(parsed_payload)
        if not rows:
            return None, {"model_id": BEDROCK_MODEL_ID, "notes": "No rows to classify"}

        prompt_rows = json.dumps(rows[:40])
        prompt = (
            "Clean and classify Nordnet export rows. "
            "Return JSON with keys cleaned_rows (list) and notes (string). "
            "For each row include normalized keys: name, type (stock|fund|etf|cash|other), "
            "currency, quantity, value_sek, price, isin (if present), and any remarks. "
            "Preserve numeric values as numbers. Do not invent holdings."
            f"\nParsed rows: {prompt_rows}"
            f"\nRaw text excerpt: {raw_text[:4000]}"
        )

        tokens = max(
            BEDROCK_MAX_TOKENS_MIN,
            min(max_tokens or BEDROCK_MAX_TOKENS_DEFAULT, BEDROCK_MAX_TOKENS_MAX),
        )
        chosen_model = model_id or BEDROCK_MODEL_ID

        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}],
                }
            ],
            "max_tokens": tokens,
            "temperature": 0.2,
            "top_p": 0.9,
        }

        try:
            response = client.invoke_model(
                modelId=chosen_model,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(payload),
            )
            raw_body = response.get("body")
            if raw_body is None:
                return None, {"model_id": BEDROCK_MODEL_ID, "notes": "Empty Bedrock response"}

            body_text = raw_body.read().decode("utf-8")
            parsed = json.loads(body_text)
            output_text = (
                parsed.get("output_text") or parsed.get("content", [{}])[0].get("text") or ""
            )
            cleaned = json.loads(output_text)
            cleaned_rows = cleaned.get("cleaned_rows") or cleaned.get("rows") or cleaned
            notes = cleaned.get("notes")
            cleaned_payload: dict[str, Any] = {
                "cleaned_rows": cleaned_rows,
                "notes": notes,
                "source_row_count": len(rows),
            }
            metadata = {
                "model_id": chosen_model,
                "notes": notes,
                "requested_max_tokens": tokens,
            }
            return cleaned_payload, metadata
        except Exception:  # pragma: no cover - external dependency
            return None, {
                "model_id": chosen_model,
                "notes": "Bedrock invocation failed",
                "requested_max_tokens": tokens,
            }

    def _get_bedrock_client(self):
        try:
            return boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
        except (BotoCoreError, ClientError):  # pragma: no cover - environment dependent
            return None

    def _extract_rows(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        keys = ("rows", "holdings", "transactions")
        for key in keys:
            value = payload.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]
        return []


__all__ = ["InvestmentSnapshotService"]
