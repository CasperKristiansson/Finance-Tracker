"""Dynamo/Bedrock import preview builder without RDS dependencies."""

from __future__ import annotations

import base64
import binascii
from typing import Any
from uuid import uuid4

from ...schemas import ImportPreviewRequest, ImportPreviewResponse
from .parsers import parse_bank_rows_auto
from .suggestions import suggest_categories
from .transfers import match_transfers
from .utils import is_date_like, is_decimal


def build_import_preview(payload: ImportPreviewRequest) -> dict[str, Any]:
    """Parse file payloads and build preview data without database lookups."""

    response_files: list[dict[str, Any]] = []
    response_rows: list[dict[str, Any]] = []

    for file_payload in payload.files:
        file_id = uuid4()
        file_errors: list[tuple[int, str]] = []
        rows: list[dict[str, Any]] = []
        bank_import_type = None

        decoded = _decode_base64(file_payload.content_base64)
        detected_bank_type, parse_result = parse_bank_rows_auto(
            filename=file_payload.filename,
            content=decoded,
        )
        parsed_rows, parse_errors = parse_result
        rows = parsed_rows
        file_errors.extend(parse_errors)
        bank_import_type = detected_bank_type
        if bank_import_type is None:
            file_errors.append((0, "Unable to detect bank import type"))

        column_map: dict[str, str] | None = (
            {"date": "date", "description": "description", "amount": "amount"} if rows else None
        )
        file_errors.extend(_validate_rows(rows, column_map))

        category_suggestions = suggest_categories(rows, column_map or {}, {})
        transfers = match_transfers(rows, column_map or {})

        preview_rows = rows[:5]
        decorated_preview_rows: list[dict[str, Any]] = []
        for idx, row in enumerate(preview_rows):
            decorated = dict(row)
            suggestion = category_suggestions.get(idx)
            transfer = transfers.get(idx)
            if suggestion:
                decorated["suggested_category"] = suggestion.category
                decorated["suggested_confidence"] = round(suggestion.confidence, 2)
                if suggestion.reason:
                    decorated["suggested_reason"] = suggestion.reason
            if transfer:
                decorated["transfer_match"] = transfer
            decorated_preview_rows.append(decorated)

        error_payloads = [{"row_number": row, "message": msg} for row, msg in file_errors]

        response_files.append(
            {
                "id": file_id,
                "filename": file_payload.filename,
                "account_id": file_payload.account_id,
                "bank_import_type": bank_import_type,
                "row_count": len(rows),
                "error_count": len(file_errors),
                "errors": error_payloads,
                "preview_rows": decorated_preview_rows,
            }
        )

        for idx, row in enumerate(rows, start=1):
            row_id = uuid4()
            occurred_at = str(row.get("date") or "")
            amount = str(row.get("amount") or "")
            description = str(row.get("description") or "")

            suggestion = category_suggestions.get(idx - 1)
            suggested_category_name: str | None = None
            suggested_confidence: float | None = None
            suggested_reason: str | None = None
            if suggestion:
                suggested_category_name = suggestion.category
                suggested_confidence = round(suggestion.confidence, 2)
                suggested_reason = suggestion.reason

            response_rows.append(
                {
                    "id": row_id,
                    "file_id": file_id,
                    "row_index": idx,
                    "account_id": file_payload.account_id,
                    "occurred_at": occurred_at,
                    "amount": amount,
                    "description": description,
                    "suggested_category_id": None,
                    "suggested_category_name": suggested_category_name,
                    "suggested_confidence": suggested_confidence,
                    "suggested_reason": suggested_reason,
                    "transfer_match": transfers.get(idx - 1),
                    "rule_applied": False,
                    "rule_type": None,
                    "rule_summary": None,
                }
            )

    return ImportPreviewResponse.model_validate(
        {
            "import_batch_id": uuid4(),
            "files": response_files,
            "rows": response_rows,
            "accounts": [],
        }
    ).model_dump(mode="python")


def _decode_base64(payload: str) -> bytes:
    try:
        return base64.b64decode(payload, validate=True)
    except (binascii.Error, TypeError, ValueError) as exc:
        raise ValueError("Unable to decode file content") from exc


def _validate_rows(
    rows: list[dict[str, Any]], column_map: dict[str, str] | None
) -> list[tuple[int, str]]:
    if not rows:
        return []

    errors: list[tuple[int, str]] = []

    if column_map is None:
        errors.append((0, "Missing required columns: date, description, amount"))
        return errors

    missing_columns = [field for field, header in column_map.items() if header is None]
    if missing_columns:
        errors.append((0, f"Missing required columns: {', '.join(missing_columns)}"))
        return errors

    for idx, row in enumerate(rows, start=1):
        missing_fields = [field for field, header in column_map.items() if not row.get(header, "")]
        if missing_fields:
            errors.append((idx, f"Missing required fields: {', '.join(missing_fields)}"))
            continue

        amount_value = row[column_map["amount"]]
        if not is_decimal(amount_value):
            errors.append((idx, "Amount must be numeric"))

        date_value = row[column_map["date"]]
        if not is_date_like(date_value):
            errors.append((idx, "Date is not a valid ISO date"))

    return errors


__all__ = ["build_import_preview"]
