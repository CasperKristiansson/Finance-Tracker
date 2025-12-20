"""Shared helpers for import parsing and normalization."""

from __future__ import annotations

import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Optional


def parse_iso_date(value: str) -> Optional[datetime]:
    """Parse an ISO-like date string into a naive datetime (UTC assumed)."""

    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return None


def clean_header(header: object) -> str:
    return str(header).strip().lower().replace(" ", "_") if header is not None else ""


def clean_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float, Decimal)):
        return str(value)
    return str(value).strip()


def parse_decimal_value(value: object) -> Optional[Decimal]:
    if value is None:
        return None
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    text = str(value).strip()
    if not text:
        return None
    cleaned = text.replace("\u2212", "-").replace("−", "-").replace("\xa0", "").replace(" ", "")
    match = re.search(r"-?[\d.,]+", cleaned)
    if not match:
        return None
    numeric = match.group(0)
    if "," in numeric and "." in numeric:
        if numeric.rfind(",") > numeric.rfind("."):
            numeric = numeric.replace(".", "")
            numeric = numeric.replace(",", ".")
        else:
            numeric = numeric.replace(",", "")
    else:
        numeric = numeric.replace(",", ".")
    try:
        return Decimal(numeric)
    except (ArithmeticError, InvalidOperation, ValueError):  # pragma: no cover - defensive
        return None


def is_decimal(value: str) -> bool:
    try:
        Decimal(str(value))
    except (ArithmeticError, InvalidOperation, TypeError, ValueError):
        return False
    return True


def safe_decimal(value: Any) -> Optional[Decimal]:
    try:
        return Decimal(str(value))
    except (ArithmeticError, InvalidOperation, TypeError, ValueError):
        return None


def is_date_like(value: str) -> bool:
    if not value:
        return False
    text = str(value)
    try:
        datetime.fromisoformat(text.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


__all__ = [
    "clean_header",
    "clean_value",
    "is_date_like",
    "is_decimal",
    "parse_decimal_value",
    "parse_iso_date",
    "safe_decimal",
]
