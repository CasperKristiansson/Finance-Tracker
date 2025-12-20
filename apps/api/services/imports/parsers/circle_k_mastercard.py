from __future__ import annotations

from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple

from ..utils import clean_header, clean_value, parse_decimal_value
from .types import NormalizedRow, ParseResult


def parse_circle_k_mastercard(
    sheet,
    *,
    parse_date: Callable[[str], Optional[datetime]],
) -> ParseResult:
    """Parse Circle K Mastercard exports."""

    header_map: Dict[str, int] | None = None
    rows: List[NormalizedRow] = []
    errors: List[Tuple[int, str]] = []

    for idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
        cleaned = [clean_value(cell) for cell in row]
        if header_map is None:
            candidate_headers = {
                clean_header(val): pos for pos, val in enumerate(row) if val is not None
            }
            if {"datum", "belopp"}.issubset(candidate_headers.keys()):
                header_map = candidate_headers
            continue
        if not any(cleaned):
            continue
        first_cell = cleaned[0].lower() if cleaned and isinstance(cleaned[0], str) else ""
        if first_cell == "datum":
            candidate_headers = {
                clean_header(val): pos for pos, val in enumerate(row) if val is not None
            }
            if {"datum", "belopp"}.issubset(candidate_headers.keys()):
                header_map = candidate_headers
            continue
        if "totalt belopp" in first_cell:
            continue
        if "summa" in first_cell or (
            len(cleaned) > 2 and isinstance(cleaned[2], str) and "summa" in cleaned[2].lower()
        ):
            continue

        try:
            date_idx = header_map.get("datum", 0)
            date_text = cleaned[date_idx] if date_idx < len(cleaned) else ""

            description_idx = header_map.get("specifikation", 2)
            description = cleaned[description_idx] if description_idx < len(cleaned) else ""

            location_idx = header_map.get("ort", 3)
            location = cleaned[location_idx] if location_idx < len(cleaned) else ""
            if location:
                description = f"{description} ({location})" if description else str(location)

            amount_idx = header_map.get("belopp", 6)
            amount_raw = cleaned[amount_idx] if amount_idx < len(cleaned) else ""

            occurred_at = parse_date(str(date_text))
            if occurred_at is None:
                if date_text and description and amount_raw != "":
                    raise ValueError("invalid date")
                continue
            if amount_raw == "":
                continue
            amount = parse_decimal_value(amount_raw)
            if amount is None:
                raise ValueError("invalid amount")
            amount = -abs(amount)
            rows.append(
                {
                    "date": occurred_at.isoformat(),
                    "description": description,
                    "amount": str(amount),
                }
            )
        except (ValueError, TypeError, IndexError) as exc:  # pragma: no cover - defensive
            errors.append((idx, f"Unable to parse row: {exc}"))

    if header_map is None:
        errors.append((0, "Circle K Mastercard export is missing the expected headers"))

    return rows, errors


__all__ = ["parse_circle_k_mastercard"]
