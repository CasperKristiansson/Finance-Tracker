"""Serverless HTTP handlers for transaction operations."""

from __future__ import annotations

from typing import Any, Dict
from uuid import UUID

from pydantic import BaseModel, ValidationError

from ..models import Transaction, TransactionLeg
from ..schemas import (
    TransactionCreate,
    TransactionListQuery,
    TransactionListResponse,
    TransactionRead,
    TransactionUpdate,
)
from ..services import TransactionService
from ..shared import session_scope
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


class TransactionReturnLink(BaseModel):
    return_parent_id: UUID


def _transaction_to_schema(transaction: Transaction) -> TransactionRead:
    return TransactionRead.model_validate(transaction)


def list_transactions(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    params = get_query_params(event)

    try:
        query = TransactionListQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = TransactionService(session)
        transactions = service.list_transactions(
            start_date=query.start_date,
            end_date=query.end_date,
            account_ids=query.account_ids,
            category_ids=query.category_ids,
            subscription_ids=query.subscription_ids,
            transaction_types=query.transaction_type,
            min_amount=query.min_amount,
            max_amount=query.max_amount,
            search=query.search,
            sort_by=query.sort_by,
            sort_dir=query.sort_dir,
            limit=query.limit,
            offset=query.offset,
        )
        account_ids = {leg.account_id for tx in transactions for leg in tx.legs}
        running_balances = service.calculate_account_balances(account_ids)
        response = TransactionListResponse(
            transactions=[_transaction_to_schema(tx) for tx in transactions],
            running_balances=running_balances,
        )
    return json_response(200, response.model_dump(mode="json"))


def create_transaction(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)

    try:
        data = TransactionCreate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    transaction = Transaction(
        category_id=data.category_id,
        subscription_id=data.subscription_id,
        transaction_type=data.transaction_type,
        description=data.description,
        notes=data.notes,
        external_id=data.external_id,
        occurred_at=data.occurred_at,
        posted_at=data.posted_at or data.occurred_at,
        return_parent_id=data.return_parent_id,
    )
    legs = [TransactionLeg(account_id=leg.account_id, amount=leg.amount) for leg in data.legs]

    with session_scope(user_id=user_id) as session:
        service = TransactionService(session)
        try:
            created = service.create_transaction(transaction, legs)
        except ValueError as exc:
            return json_response(400, {"error": str(exc)})
        session.refresh(created)
        response = _transaction_to_schema(created).model_dump(mode="json")
    return json_response(201, response)


__all__ = [
    "list_transactions",
    "create_transaction",
    "mark_transaction_return",
    "update_transaction",
    "delete_transaction",
    "reset_handler_state",
]


def mark_transaction_return(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    transaction_id = extract_path_uuid(event, param_names=("transaction_id", "transactionId"))
    if transaction_id is None:
        return json_response(400, {"error": "Transaction ID missing from path"})

    payload = parse_body(event)
    try:
        data = TransactionReturnLink.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = TransactionService(session)
        try:
            updated = service.mark_transaction_as_return(
                transaction_id, return_parent_id=data.return_parent_id
            )
        except LookupError:
            return json_response(404, {"error": "Transaction not found"})
        except ValueError as exc:
            return json_response(400, {"error": str(exc)})

        response = _transaction_to_schema(updated).model_dump(mode="json")
    return json_response(200, response)


def update_transaction(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)
    transaction_id = extract_path_uuid(event, param_names=("transaction_id", "transactionId"))
    if transaction_id is None:
        return json_response(400, {"error": "Transaction ID missing from path"})

    try:
        data = TransactionUpdate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    updates = data.model_dump(exclude_unset=True)
    subscription_in_payload = "subscription_id" in data.model_fields_set
    subscription_id = updates.pop("subscription_id", None)

    with session_scope(user_id=user_id) as session:
        service = TransactionService(session)
        try:
            updated = service.update_transaction(
                transaction_id,
                update_subscription=subscription_in_payload,
                subscription_id=subscription_id,
                **updates,
            )
        except LookupError:
            return json_response(404, {"error": "Transaction not found"})
        except ValueError as exc:
            return json_response(400, {"error": str(exc)})
        response = _transaction_to_schema(updated).model_dump(mode="json")
    return json_response(200, response)


def delete_transaction(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    user_id = get_user_id(event)
    transaction_id = extract_path_uuid(event, param_names=("transaction_id", "transactionId"))
    if transaction_id is None:
        return json_response(400, {"error": "Transaction ID missing from path"})

    with session_scope(user_id=user_id) as session:
        service = TransactionService(session)
        try:
            service.delete_transaction(transaction_id)
        except LookupError:
            return json_response(404, {"error": "Transaction not found"})
    return json_response(204, {})
