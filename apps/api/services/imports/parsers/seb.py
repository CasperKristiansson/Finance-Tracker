from __future__ import annotations

from datetime import datetime
from typing import Callable, Dict, List, Optional, Tuple

from ..utils import clean_header, clean_value, parse_decimal_value
from .types import NormalizedRow, ParseResult


def parse_seb(
    sheet,
    *,
    parse_date: Callable[[str], Optional[datetime]],
) -> ParseResult:
    """Parse SEB statement exports."""

    header_index = None
    headers: Dict[str, int] = {}
    rows: List[NormalizedRow] = []
    errors: List[Tuple[int, str]] = []

    for idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
        header_map = {clean_header(val): pos for pos, val in enumerate(row) if val}
        if not header_index and {"bokförd", "insättningar/uttag"}.issubset(header_map.keys()):
            header_index = idx
            headers = header_map
            continue
        if header_index is None or idx <= header_index:
            continue
        cleaned = [clean_value(cell) for cell in row]
        if not any(cleaned):
            continue
        try:
            date_text = cleaned[headers.get("bokförd", 0)] if headers else cleaned[0]
            if not date_text:
                continue
            occurred_at = parse_date(str(date_text))
            if occurred_at is None:
                raise ValueError("invalid date")
            description = cleaned[headers.get("text", 2)] if headers else ""
            if not description:
                description = cleaned[headers.get("typ", 3)] if headers else ""
            amount_raw = cleaned[headers.get("insättningar/uttag", 5)] if headers else ""
            amount = parse_decimal_value(amount_raw)
            if amount is None:
                raise ValueError("invalid amount")
            rows.append(
                {
                    "date": occurred_at.isoformat(),
                    "description": str(description),
                    "amount": str(amount),
                }
            )
        except (ValueError, TypeError, IndexError) as exc:  # pragma: no cover - defensive
            errors.append((idx, f"Unable to parse row: {exc}"))

    if header_index is None:
        errors.append((0, "SEB export is missing the expected headers"))

    return rows, errors


__all__ = ["parse_seb"]
