"""Suggestion helpers for import previews."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional
from uuid import UUID


@dataclass
class CategorySuggestion:
    category_id: UUID | None
    category: Optional[str]
    confidence: float
    reason: Optional[str] = None


@dataclass
class RuleMatch:
    rule_id: UUID
    category_id: Optional[UUID]
    category_name: Optional[str]
    summary: str
    score: float
    rule_type: str


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


__all__ = [
    "CategorySuggestion",
    "RuleMatch",
    "suggest_categories",
    "suggest_category_heuristic",
]
