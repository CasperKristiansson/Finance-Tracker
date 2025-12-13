"""Serverless HTTP handlers for category operations."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict

from pydantic import ValidationError

from ..models import Category
from ..schemas import (
    CategoryCreate,
    CategoryListResponse,
    CategoryMonthlyPoint,
    CategoryRead,
    CategoryUpdate,
    ListCategoriesQuery,
    MergeCategoriesRequest,
)
from ..services import CategoryService
from ..shared import CategoryType, coerce_decimal, session_scope
from .utils import (
    ensure_engine,
    extract_path_uuid,
    get_query_params,
    get_user_id,
    json_response,
    parse_body,
    reset_engine_state,
)


def reset_handler_state() -> None:
    reset_engine_state()


def _category_to_schema(
    category: Category,
    *,
    transaction_count: int = 0,
    last_used_at: datetime | None = None,
    income_total: Decimal | None = None,
    expense_total: Decimal | None = None,
) -> CategoryRead:
    base = CategoryRead.model_validate(category)
    income = coerce_decimal(income_total or 0)
    expense = coerce_decimal(expense_total or 0)
    lifetime_total = income if category.category_type == CategoryType.INCOME else expense
    return base.model_copy(
        update={
            "transaction_count": transaction_count,
            "last_used_at": last_used_at,
            "lifetime_total": lifetime_total,
        }
    )


def list_categories(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    params = get_query_params(event)

    try:
        query = ListCategoriesQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = CategoryService(session)
        categories = service.list_categories(
            include_archived=query.include_archived,
            include_special=query.include_special,
        )
        usage_by_id = service.get_category_usage([category.id for category in categories])
        monthly_by_id = service.get_recent_category_months([category.id for category in categories])

        today = date.today()
        end_month = date(today.year, today.month, 1)
        months = 6
        month_starts: list[date] = []
        cursor = end_month
        for _ in range(months):
            month_starts.append(cursor)
            year = cursor.year
            month = cursor.month - 1
            if month == 0:
                year -= 1
                month = 12
            cursor = date(year, month, 1)
        month_starts.reverse()

        enriched = []
        for category in categories:
            usage = usage_by_id.get(category.id)
            monthly = monthly_by_id.get(category.id, {})
            points = []
            for month_start in month_starts:
                income_total, expense_total = monthly.get(month_start, (Decimal("0"), Decimal("0")))
                total = (
                    income_total if category.category_type == CategoryType.INCOME else expense_total
                )
                points.append(CategoryMonthlyPoint(period=month_start, total=total))
            enriched.append(
                _category_to_schema(
                    category,
                    transaction_count=(usage.transaction_count if usage else 0),
                    last_used_at=(usage.last_used_at if usage else None),
                    income_total=(usage.income_total if usage else None),
                    expense_total=(usage.expense_total if usage else None),
                ).model_copy(update={"recent_months": points})
            )
        response = CategoryListResponse(categories=enriched)
    return json_response(200, response.model_dump(mode="json"))


def create_category(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)

    try:
        data = CategoryCreate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    category = Category(
        name=data.name,
        category_type=data.category_type,
        color_hex=data.color_hex,
        icon=data.icon,
    )

    with session_scope(user_id=user_id) as session:
        service = CategoryService(session)
        created = service.create_category(category)
        usage = service.get_category_usage([created.id]).get(created.id)
        response = _category_to_schema(
            created,
            transaction_count=usage.transaction_count if usage else 0,
            last_used_at=usage.last_used_at if usage else None,
            income_total=usage.income_total if usage else None,
            expense_total=usage.expense_total if usage else None,
        ).model_dump(mode="json")
    return json_response(201, response)


def update_category(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)
    raw_id = extract_path_uuid(event, param_names=("category_id", "categoryId"))
    if raw_id is None:
        return json_response(400, {"error": "Category ID missing from path"})

    try:
        data = CategoryUpdate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    updates: Dict[str, Any] = {}
    if data.name is not None:
        updates["name"] = data.name
    if data.category_type is not None:
        updates["category_type"] = data.category_type
    if data.color_hex is not None:
        updates["color_hex"] = data.color_hex
    if data.icon is not None:
        updates["icon"] = data.icon
    if data.is_archived is not None:
        updates["is_archived"] = data.is_archived

    with session_scope(user_id=user_id) as session:
        service = CategoryService(session)
        try:
            updated = service.update_category(raw_id, **updates)
        except LookupError:
            return json_response(404, {"error": "Category not found"})
        usage = service.get_category_usage([updated.id]).get(updated.id)
        response = _category_to_schema(
            updated,
            transaction_count=usage.transaction_count if usage else 0,
            last_used_at=usage.last_used_at if usage else None,
            income_total=usage.income_total if usage else None,
            expense_total=usage.expense_total if usage else None,
        ).model_dump(mode="json")
    return json_response(200, response)


def merge_categories(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)

    try:
        data = MergeCategoriesRequest.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = CategoryService(session)
        try:
            merged = service.merge_categories(
                data.source_category_id,
                data.target_category_id,
                rename_target_to=data.rename_target_to,
            )
        except LookupError:
            return json_response(404, {"error": "Category not found"})
        except ValueError as exc:
            return json_response(400, {"error": str(exc)})
        usage = service.get_category_usage([merged.id]).get(merged.id)
        response = _category_to_schema(
            merged,
            transaction_count=usage.transaction_count if usage else 0,
            last_used_at=usage.last_used_at if usage else None,
            income_total=usage.income_total if usage else None,
            expense_total=usage.expense_total if usage else None,
        ).model_dump(mode="json")
    return json_response(200, response)


__all__ = [
    "list_categories",
    "create_category",
    "update_category",
    "merge_categories",
    "reset_handler_state",
]
