"""Serverless HTTP handlers for subscription operations."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from ..models import Subscription
from ..schemas import (
    AttachSubscriptionRequest,
    SubscriptionCreate,
    SubscriptionListQuery,
    SubscriptionListResponse,
    SubscriptionRead,
    SubscriptionSummaryRead,
    SubscriptionSummaryResponse,
    SubscriptionUpdate,
    TransactionRead,
)
from ..services import SubscriptionService
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


def _subscription_to_schema(subscription: Subscription) -> SubscriptionRead:
    return SubscriptionRead.model_validate(subscription)


def list_subscriptions(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    try:
        query = SubscriptionListQuery.model_validate(params or {})
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = SubscriptionService(session)
        subscriptions = service.list_subscriptions(include_inactive=query.include_inactive)
        response = SubscriptionListResponse(
            subscriptions=[_subscription_to_schema(sub) for sub in subscriptions]
        )
    return json_response(200, response.model_dump(mode="json"))


def list_subscription_summaries(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    try:
        query = SubscriptionListQuery.model_validate(params or {})
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = SubscriptionService(session)
        summaries = service.list_subscription_summaries(include_inactive=query.include_inactive)
        payload = SubscriptionSummaryResponse(
            subscriptions=[
                SubscriptionSummaryRead.model_validate(
                    {
                        **_subscription_to_schema(item["subscription"]).model_dump(),
                        "current_month_spend": item["current_month_spend"],
                        "trailing_three_month_spend": item["trailing_three_month_spend"],
                        "trailing_twelve_month_spend": item["trailing_twelve_month_spend"],
                        "trend": item["trend"],
                        "last_charge_at": item["last_charge_at"],
                        "category_name": item["category_name"],
                    }
                )
                for item in summaries
            ]
        )
    return json_response(200, payload.model_dump(mode="json"))


def create_subscription(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    payload = parse_body(event)

    try:
        data = SubscriptionCreate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    subscription = Subscription(
        name=data.name,
        matcher_text=data.matcher_text,
        matcher_amount_tolerance=data.matcher_amount_tolerance,
        matcher_day_of_month=data.matcher_day_of_month,
        category_id=data.category_id,
        is_active=data.is_active,
    )

    with session_scope() as session:
        service = SubscriptionService(session)
        created = service.create_subscription(subscription)
        response = _subscription_to_schema(created).model_dump(mode="json")
    return json_response(201, response)


def update_subscription(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    payload = parse_body(event)
    subscription_id = extract_path_uuid(event, param_names=("subscription_id", "subscriptionId"))
    if subscription_id is None:
        return json_response(400, {"error": "Subscription ID missing from path"})

    try:
        data = SubscriptionUpdate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    updates = data.model_dump(exclude_unset=True)

    with session_scope() as session:
        service = SubscriptionService(session)
        try:
            updated = service.update_subscription(subscription_id, **updates)
        except LookupError:
            return json_response(404, {"error": "Subscription not found"})
        response = _subscription_to_schema(updated).model_dump(mode="json")
    return json_response(200, response)


def attach_subscription(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    payload = parse_body(event)
    transaction_id = extract_path_uuid(event, param_names=("transaction_id", "transactionId"))
    if transaction_id is None:
        return json_response(400, {"error": "Transaction ID missing from path"})

    try:
        data = AttachSubscriptionRequest.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = SubscriptionService(session)
        try:
            updated = service.attach_transaction(transaction_id, data.subscription_id)
        except LookupError as exc:
            return json_response(404, {"error": str(exc)})
        response = TransactionRead.model_validate(updated).model_dump(mode="json")
    return json_response(200, response)


def detach_subscription(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    transaction_id = extract_path_uuid(event, param_names=("transaction_id", "transactionId"))
    if transaction_id is None:
        return json_response(400, {"error": "Transaction ID missing from path"})

    with session_scope() as session:
        service = SubscriptionService(session)
        try:
            updated = service.detach_transaction(transaction_id)
        except LookupError:
            return json_response(404, {"error": "Transaction not found"})
        response = TransactionRead.model_validate(updated).model_dump(mode="json")
    return json_response(200, response)


__all__ = [
    "list_subscriptions",
    "list_subscription_summaries",
    "create_subscription",
    "update_subscription",
    "attach_subscription",
    "detach_subscription",
    "reset_handler_state",
]
