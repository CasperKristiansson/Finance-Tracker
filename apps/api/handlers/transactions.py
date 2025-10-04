"""Serverless HTTP handlers for transaction operations."""

from __future__ import annotations

import os
from typing import Any, Dict

from pydantic import ValidationError
from sqlalchemy.pool import StaticPool

from ..models import Transaction, TransactionLeg
from ..schemas import (
    TransactionCreate,
    TransactionListQuery,
    TransactionListResponse,
    TransactionRead,
)
from ..services import TransactionService
from ..shared import (
    configure_engine,
    configure_engine_from_env,
    get_engine,
    session_scope,
)
from .utils import get_query_params, json_response, parse_body

_ENGINE_INITIALIZED = False


def reset_handler_state() -> None:
    global _ENGINE_INITIALIZED
    _ENGINE_INITIALIZED = False


def _ensure_engine() -> None:
    global _ENGINE_INITIALIZED
    if _ENGINE_INITIALIZED:
        return

    try:
        get_engine()
        _ENGINE_INITIALIZED = True
        return
    except RuntimeError:
        pass

    database_url = os.environ.get("DATABASE_URL")
    if database_url:
        kwargs: Dict[str, Any] = {}
        if database_url.startswith("sqlite"):
            kwargs["connect_args"] = {"check_same_thread": False}
            kwargs["poolclass"] = StaticPool
        configure_engine(database_url, **kwargs)
    else:
        configure_engine_from_env()
    _ENGINE_INITIALIZED = True


def _transaction_to_schema(transaction: Transaction) -> TransactionRead:
    return TransactionRead.model_validate(transaction)


def list_transactions(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    _ensure_engine()
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
        )
        response = TransactionListResponse(
            transactions=[_transaction_to_schema(tx) for tx in transactions]
        )
    return json_response(200, response.model_dump(mode="json"))


def create_transaction(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    _ensure_engine()
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
    legs = [
        TransactionLeg(account_id=leg.account_id, amount=leg.amount)
        for leg in data.legs
    ]

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
