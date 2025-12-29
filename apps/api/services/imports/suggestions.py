"""Suggestion helpers for import previews."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Dict, Optional
from uuid import UUID

from ...models import Subscription
from .utils import parse_iso_date, safe_decimal


@dataclass
class CategorySuggestion:
    category_id: UUID | None
    category: Optional[str]
    confidence: float
    reason: Optional[str] = None


@dataclass
class SubscriptionSuggestion:
    subscription_id: UUID
    subscription_name: str
    confidence: float
    reason: Optional[str] = None


@dataclass
class RuleMatch:
    rule_id: UUID
    category_id: Optional[UUID]
    category_name: Optional[str]
    subscription_id: Optional[UUID]
    subscription_name: Optional[str]
    summary: str
    score: float
    rule_type: str


SUBSCRIPTION_SUGGESTION_THRESHOLD = 0.8


def suggest_categories(
    rows: list[dict],
    column_map: Dict[str, str],
    rule_matches: Optional[Dict[int, RuleMatch]] = None,
) -> Dict[int, CategorySuggestion]:
    if not column_map or not column_map.get("description") or not column_map.get("amount"):
        return {}
    heuristic: Dict[int, CategorySuggestion] = {}
    locked: set[int] = set()
    if rule_matches:
        for idx, match in rule_matches.items():
            if match.category_name:
                heuristic[idx] = CategorySuggestion(
                    category_id=match.category_id,
                    category=match.category_name,
                    confidence=0.95,
                    reason=match.summary or "Rule match",
                )
                locked.add(idx)

    for idx, row in enumerate(rows):
        if idx in locked:
            continue
        heuristic[idx] = suggest_category_heuristic(row, column_map)

    return heuristic


def suggest_category_heuristic(row: dict, column_map: Dict[str, str]) -> CategorySuggestion:
    description = str(row.get(column_map["description"], ""))
    amount_text = str(row.get(column_map["amount"], ""))

    normalized_desc = description.lower()
    keyword_map = {
        "rent": "Rent",
        "salary": "Salary",
        "payroll": "Salary",
        "grocery": "Groceries",
        "market": "Groceries",
        "uber": "Transport",
        "lyft": "Transport",
        "electric": "Utilities",
        "water": "Utilities",
        "internet": "Utilities",
    }
    for keyword, category in keyword_map.items():
        if keyword in normalized_desc:
            return CategorySuggestion(category_id=None, category=category, confidence=0.65)

    return CategorySuggestion(
        category_id=None,
        category=None,
        confidence=0.3,
        reason=f"No signal for {amount_text}",
    )


def suggest_subscriptions(
    rows: list[dict],
    column_map: Dict[str, str],
    subscriptions: list[Subscription],
    last_amounts: dict[UUID, Decimal],
    rule_matches: Optional[Dict[int, RuleMatch]] = None,
) -> Dict[int, SubscriptionSuggestion]:
    if not rows:
        return {}
    description_header = column_map.get("description")
    amount_header = column_map.get("amount")
    date_header = column_map.get("date")
    if not description_header:
        return {}

    if not subscriptions:
        return {}

    suggestions: Dict[int, SubscriptionSuggestion] = {}
    locked: set[int] = set()
    if rule_matches:
        for idx, match in rule_matches.items():
            if match.subscription_id:
                suggestions[idx] = SubscriptionSuggestion(
                    subscription_id=match.subscription_id,
                    subscription_name=match.subscription_name or "Matched rule",
                    confidence=0.99,
                    reason=match.summary or "Rule match",
                )
                locked.add(idx)
    for idx, row in enumerate(rows):
        if idx in locked:
            continue
        description = str(row.get(description_header, "") or "")
        amount = safe_decimal(row.get(amount_header)) if amount_header else None
        occurred_at = parse_iso_date(str(row.get(date_header, ""))) if date_header else None

        best: SubscriptionSuggestion | None = None
        for subscription in subscriptions:
            candidate = _score_subscription(
                subscription,
                description,
                amount,
                occurred_at,
                last_amounts.get(subscription.id),
            )
            if candidate is None:
                continue
            if best is None or candidate.confidence > best.confidence:
                best = candidate
        if best and best.confidence >= SUBSCRIPTION_SUGGESTION_THRESHOLD:
            suggestions[idx] = best
    return suggestions


def _score_subscription(  # pylint: disable=too-many-positional-arguments
    subscription: Subscription,
    description: str,
    amount: Optional[Decimal],
    occurred_at: Optional[datetime],
    last_amount: Optional[Decimal],
) -> Optional[SubscriptionSuggestion]:
    text_match, text_reason = _match_subscription_text(subscription.matcher_text, description)
    if not text_match:
        return None

    confidence = 0.82 if text_reason == "regex" else 0.8
    reasons = [f"{text_reason} match"]

    if subscription.matcher_day_of_month and occurred_at:
        if occurred_at.day == subscription.matcher_day_of_month:
            confidence += 0.1
            reasons.append("day-of-month aligns")
        else:
            confidence -= 0.05

    if subscription.matcher_amount_tolerance is not None and amount is not None:
        if last_amount is not None:
            delta = (abs(amount) - abs(last_amount)).copy_abs()
            if delta <= subscription.matcher_amount_tolerance:
                confidence += 0.08
                reasons.append("amount within tolerance of last charge")
            else:
                return None
        else:
            reasons.append("tolerance provided but no history; skipping amount check")

    confidence = min(confidence, 0.98)

    return SubscriptionSuggestion(
        subscription_id=subscription.id,
        subscription_name=subscription.name,
        confidence=confidence,
        reason="; ".join(reasons),
    )


def _match_subscription_text(pattern: str, description: str) -> tuple[bool, str]:
    normalized = description.lower()
    try:
        if re.search(pattern, description, flags=re.IGNORECASE):
            return True, "regex"
    except re.error:
        pass
    if pattern.lower() in normalized:
        return True, "substring"
    return False, ""


__all__ = [
    "CategorySuggestion",
    "RuleMatch",
    "SUBSCRIPTION_SUGGESTION_THRESHOLD",
    "SubscriptionSuggestion",
    "suggest_categories",
    "suggest_category_heuristic",
    "suggest_subscriptions",
]
