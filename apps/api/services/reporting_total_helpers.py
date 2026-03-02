"""Utility helpers for total-overview report builder."""

from __future__ import annotations

import calendar
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional, Tuple, cast

from ..repositories.reporting import TransactionAmountRow
from .reporting_total_types import (
    CategoryAgg,
    CategoryChangeRow,
    CategoryMixEntry,
    CategoryMixYear,
    SourceAgg,
    SourceChangeRow,
    SourceRow,
)


def month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def next_month(day: date) -> date:
    if day.month == 12:
        return date(day.year + 1, 1, 1)
    return date(day.year, day.month + 1, 1)


def compress_points_monthly(
    *, points: List[Tuple[date, Decimal]], as_of: date
) -> List[Tuple[date, Decimal]]:
    if not points:
        return []
    start = date(points[0][0].year, points[0][0].month, 1)
    cursor = start
    idx = 0
    latest = points[0][1]
    results: List[Tuple[date, Decimal]] = []

    while cursor <= as_of:
        month_end_value = month_end(cursor.year, cursor.month)
        target = as_of if month_end_value > as_of else month_end_value
        while idx < len(points) and points[idx][0] <= target:
            latest = points[idx][1]
            idx += 1
        results.append((target, latest))
        cursor = next_month(cursor)
    return results


def ensure_category(mapping: Dict[str, CategoryAgg], *, row: TransactionAmountRow) -> CategoryAgg:
    key = str(row.category_id or "uncategorized")
    bucket = mapping.get(key)
    if bucket is None:
        new_bucket: CategoryAgg = {
            "category_id": str(row.category_id) if row.category_id else None,
            "name": row.category_name or "Uncategorized",
            "total": Decimal("0"),
            "icon": row.category_icon,
            "color_hex": row.category_color_hex,
            "transaction_count": 0,
        }
        mapping[key] = new_bucket
        return new_bucket

    if row.category_name:
        bucket["name"] = row.category_name
    if row.category_icon:
        bucket["icon"] = row.category_icon
    if row.category_color_hex:
        bucket["color_hex"] = row.category_color_hex
    return bucket


def ensure_source(mapping: Dict[str, SourceAgg], key: str) -> SourceAgg:
    bucket = mapping.get(key)
    if bucket is None:
        bucket = cast(SourceAgg, {"source": key, "total": Decimal("0"), "transaction_count": 0})
        mapping[key] = bucket
    return bucket


def build_category_heatmap(
    *,
    categories: List[CategoryAgg],
    categories_by_year: Dict[int, Dict[str, CategoryAgg]],
    years: List[int],
) -> dict[str, object]:
    rows: List[dict[str, object]] = []
    for cat in categories[:12]:
        key = str(cat["category_id"] or "uncategorized")
        totals: List[Decimal] = []
        for year in years:
            year_map = categories_by_year.get(year)
            if not year_map:
                totals.append(Decimal("0"))
                continue
            bucket = year_map.get(key)
            totals.append(bucket["total"] if bucket else Decimal("0"))
        rows.append(
            {
                "category_id": cat["category_id"],
                "name": cat["name"],
                "icon": cat.get("icon"),
                "color_hex": cat.get("color_hex"),
                "totals": totals,
            }
        )
    return {"years": years, "rows": rows}


def top_category_keys(categories: Dict[str, CategoryAgg], limit: int) -> List[str]:
    ranked = sorted(categories.items(), key=lambda kv: kv[1]["total"], reverse=True)
    return [key for key, _bucket in ranked[:limit]]


def year_mix(
    *,
    year: int,
    totals: Dict[int, Dict[str, CategoryAgg]],
    keys: List[str],
    year_total: Decimal,
    lifetimes: Dict[str, CategoryAgg],
) -> CategoryMixYear:
    year_map = totals.get(year, {})
    entries: List[CategoryMixEntry] = []
    sum_top = Decimal("0")
    for key in keys:
        bucket = year_map.get(key)
        if bucket is None:
            base = lifetimes.get(key)
            entries.append(
                {
                    "category_id": None if key == "uncategorized" else key,
                    "name": base["name"] if base else "Category",
                    "total": Decimal("0"),
                    "icon": base["icon"] if base else None,
                    "color_hex": base["color_hex"] if base else None,
                    "transaction_count": 0,
                }
            )
            continue
        entries.append(
            {
                "category_id": bucket["category_id"],
                "name": bucket["name"],
                "total": bucket["total"],
                "icon": bucket["icon"],
                "color_hex": bucket["color_hex"],
                "transaction_count": bucket["transaction_count"],
            }
        )
        sum_top += bucket["total"]
    other_total = year_total - sum_top if year_total > sum_top else Decimal("0")
    entries.append(
        {
            "category_id": None,
            "name": "Other",
            "total": other_total,
            "icon": None,
            "color_hex": None,
            "transaction_count": 0,
        }
    )
    entries = [entry for entry in entries if entry["total"] > 0]
    return {"year": year, "categories": entries}


def yoy_category_changes(
    *,
    latest_year: int,
    prev_year: Optional[int],
    categories: Dict[int, Dict[str, CategoryAgg]],
) -> List[CategoryChangeRow]:
    if prev_year is None:
        return []
    latest_map = categories.get(latest_year, {})
    prev_map = categories.get(prev_year, {})
    keys = set(latest_map.keys()) | set(prev_map.keys())
    changes: List[CategoryChangeRow] = []
    for key in keys:
        latest_bucket = latest_map.get(key)
        prev_bucket = prev_map.get(key)
        latest_total = latest_bucket["total"] if latest_bucket else Decimal("0")
        prev_total = prev_bucket["total"] if prev_bucket else Decimal("0")
        delta = latest_total - prev_total
        delta_pct = (delta / prev_total * Decimal("100")) if prev_total > 0 else None
        ref_bucket = latest_bucket if latest_bucket is not None else prev_bucket
        name = ref_bucket["name"] if ref_bucket is not None else "Category"
        category_id = ref_bucket["category_id"] if ref_bucket is not None else None
        changes.append(
            {
                "category_id": category_id,
                "name": name,
                "amount": latest_total,
                "prev_amount": prev_total,
                "delta": delta,
                "delta_pct": delta_pct,
            }
        )
    changes.sort(key=lambda item: abs(item["delta"]), reverse=True)
    return changes[:20]


def sources_to_rows(sources: Dict[str, SourceAgg]) -> List[SourceRow]:
    rows = sorted(sources.values(), key=lambda item: item["total"], reverse=True)[:20]
    return [
        {
            "source": row["source"],
            "total": row["total"],
            "transaction_count": row["transaction_count"],
        }
        for row in rows
    ]


def yoy_source_changes(
    *,
    latest_year: int,
    prev_year: Optional[int],
    sources: Dict[int, Dict[str, SourceAgg]],
) -> List[SourceChangeRow]:
    if prev_year is None:
        return []
    latest_map = sources.get(latest_year, {})
    prev_map = sources.get(prev_year, {})
    keys = set(latest_map.keys()) | set(prev_map.keys())
    changes: List[SourceChangeRow] = []
    for key in keys:
        latest_total = latest_map.get(key, {"total": Decimal("0")})["total"]
        prev_total = prev_map.get(key, {"total": Decimal("0")})["total"]
        delta = latest_total - prev_total
        delta_pct = (delta / prev_total * Decimal("100")) if prev_total > 0 else None
        changes.append(
            {
                "source": key,
                "amount": latest_total,
                "prev_amount": prev_total,
                "delta": delta,
                "delta_pct": delta_pct,
            }
        )
    changes.sort(key=lambda item: abs(item["delta"]), reverse=True)
    return changes[:20]


__all__ = [
    "month_end",
    "next_month",
    "compress_points_monthly",
    "ensure_category",
    "ensure_source",
    "build_category_heatmap",
    "top_category_keys",
    "year_mix",
    "yoy_category_changes",
    "sources_to_rows",
    "yoy_source_changes",
]
