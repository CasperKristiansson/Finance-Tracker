"""Serverless HTTP handlers for category operations."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from ..models import Category
from ..schemas import (
    CategoryCreate,
    CategoryListResponse,
    CategoryRead,
    CategoryUpdate,
    ListCategoriesQuery,
)
from ..services import CategoryService
from ..shared import session_scope
from .utils import (
    ensure_engine,
    extract_path_uuid,
    get_query_params,
    json_response,
    parse_body,
    reset_engine_state,
)


def reset_handler_state() -> None:
    reset_engine_state()


def _category_to_schema(category: Category) -> CategoryRead:
    return CategoryRead.model_validate(category)


def list_categories(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    try:
        query = ListCategoriesQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = CategoryService(session)
        categories = service.list_categories(include_archived=query.include_archived)
        response = CategoryListResponse(
            categories=[_category_to_schema(category) for category in categories]
        )
    return json_response(200, response.model_dump(mode="json"))


def create_category(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    payload = parse_body(event)

    try:
        data = CategoryCreate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    category = Category(
        name=data.name,
        category_type=data.category_type,
        color_hex=data.color_hex,
    )

    with session_scope() as session:
        service = CategoryService(session)
        created = service.create_category(category)
        response = _category_to_schema(created).model_dump(mode="json")
    return json_response(201, response)


def update_category(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
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
    if data.is_archived is not None:
        updates["is_archived"] = data.is_archived

    with session_scope() as session:
        service = CategoryService(session)
        try:
            updated = service.update_category(raw_id, **updates)
        except LookupError:
            return json_response(404, {"error": "Category not found"})
        response = _category_to_schema(updated).model_dump(mode="json")
    return json_response(200, response)


__all__ = [
    "list_categories",
    "create_category",
    "update_category",
    "reset_handler_state",
]
