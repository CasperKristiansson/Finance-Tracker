"""Transfer matching helper for import previews."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List

from .utils import parse_iso_date


def match_transfers(
    rows: List[dict[str, Any]], column_map: Dict[str, str]
) -> Dict[int, dict[str, Any]]:
    if not rows:
        return {}

    amount_header = column_map.get("amount")
    date_header = column_map.get("date")
    if not amount_header:
        return {}

    entries: List[Dict[str, Any]] = []
    for idx, row in enumerate(rows):
        try:
            amount = Decimal(str(row.get(amount_header, "")))
        except (ArithmeticError, InvalidOperation, TypeError, ValueError):
            continue
        date_value = parse_iso_date(str(row.get(date_header, ""))) if date_header else None
        entries.append({"idx": idx, "amount": amount, "date": date_value})

    matches: Dict[int, dict[str, Any]] = {}
    used: set[int] = set()
    for entry in entries:
        if entry["idx"] in used:
            continue
        for other in entries:
            if other["idx"] in used or other["idx"] == entry["idx"]:
                continue
            if (entry["amount"] + other["amount"]) != 0:
                continue
            if entry["date"] and other["date"]:
                delta = abs((entry["date"] - other["date"]).days)
                if delta > 2:
                    continue
            match_payload = {
                "paired_with": other["idx"] + 1,
                "reason": "Matched transfer by amount and date proximity",
            }
            matches[entry["idx"]] = match_payload
            matches[other["idx"]] = {
                "paired_with": entry["idx"] + 1,
                "reason": "Matched transfer by amount and date proximity",
            }
            used.update({entry["idx"], other["idx"]})
            break
    return matches


__all__ = ["match_transfers"]
