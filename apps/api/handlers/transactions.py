"""Serverless HTTP handlers for transaction operations."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from ..models import Transaction, TransactionLeg
from ..schemas import (
    TransactionCreate,
    TransactionListQuery,
    TransactionListResponse,
    TransactionRead,
)
from ..services import TransactionService
from ..shared import session_scope
from .utils import (
    ensure_engine,
    get_query_params,
    json_response,
    parse_body,
    reset_engine_state,
)


def reset_handler_state() -> None:
    reset_engine_state()


def _transaction_to_schema(transaction: Transaction) -> TransactionRead:
    return TransactionRead.model_validate(transaction)


def list_transactions(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    params = get_query_params(event)

    try:
        query = TransactionListQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = TransactionService(session)
        transactions = service.list_transactions(
            start_date=query.start_date,
            end_date=query.end_date,
            account_ids=query.account_ids,
            limit=query.limit,
            offset=query.offset,
        )
        response = TransactionListResponse(
            transactions=[_transaction_to_schema(tx) for tx in transactions]
        )
    return json_response(200, response.model_dump(mode="json"))


def create_transaction(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    payload = parse_body(event)

    try:
        data = TransactionCreate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    transaction = Transaction(
        category_id=data.category_id,
        transaction_type=data.transaction_type,
        description=data.description,
        notes=data.notes,
        external_id=data.external_id,
        occurred_at=data.occurred_at,
        posted_at=data.posted_at or data.occurred_at,
    )
    legs = [TransactionLeg(account_id=leg.account_id, amount=leg.amount) for leg in data.legs]

    with session_scope() as session:
        service = TransactionService(session)
        created = service.create_transaction(transaction, legs)
        session.refresh(created)
        response = _transaction_to_schema(created).model_dump(mode="json")
    return json_response(201, response)


__all__ = [
    "list_transactions",
    "create_transaction",
    "reset_handler_state",
]
