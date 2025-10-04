"""Serverless HTTP handlers for account operations."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy.pool import StaticPool

from ..models import Account
from ..schemas import (
    AccountCreate,
    AccountUpdate,
    AccountWithBalance,
    ListAccountsQuery,
    ListAccountsResponse,
)
from ..services import AccountService
from ..shared import (
    configure_engine,
    configure_engine_from_env,
    get_engine,
    session_scope,
)
from .utils import extract_path_uuid, get_query_params, json_response, parse_body


_ENGINE_INITIALIZED = False


def reset_handler_state() -> None:
    """Reset internal flags to allow clean reconfiguration in tests."""

    global _ENGINE_INITIALIZED
    _ENGINE_INITIALIZED = False


def _ensure_engine() -> None:
    """Ensure the SQLModel engine is configured before handling requests."""

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


def _account_to_schema(account: Account, balance: Any) -> AccountWithBalance:
    payload = account.model_dump(mode="python")
    payload["loan"] = getattr(account, "loan", None)
    payload["balance"] = balance
    return AccountWithBalance.model_validate(payload)


def list_accounts(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP GET /accounts."""

    _ensure_engine()
    params = get_query_params(event)

    try:
        query = ListAccountsQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = AccountService(session)
        accounts_with_balances = service.list_accounts_with_balance(
            include_inactive=query.include_inactive,
            as_of=query.as_of_date,
        )

        data = [
            _account_to_schema(account, balance)
            for account, balance in accounts_with_balances
        ]
    response = ListAccountsResponse(accounts=data)
    return json_response(200, response.model_dump(mode="json"))


def create_account(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /accounts."""

    _ensure_engine()
    payload = parse_body(event)

    try:
        data = AccountCreate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    account = Account(
        display_order=data.display_order,
        account_type=data.account_type,
        is_active=data.is_active,
    )

    with session_scope() as session:
        service = AccountService(session)
        created = service.create_account(
            account,
            loan_kwargs=data.loan.model_dump() if data.loan else None,
        )
        account_obj, balance = service.get_account_with_balance(created.id)
        response = _account_to_schema(account_obj, balance).model_dump(mode="json")

    return json_response(201, response)


def update_account(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP PATCH /accounts/{account_id}."""

    _ensure_engine()
    payload = parse_body(event)
    account_id = extract_path_uuid(event, param_names=("account_id", "accountId"))
    if account_id is None:
        return json_response(400, {"error": "Account ID missing from path"})

    try:
        data = AccountUpdate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = AccountService(session)
        try:
            updated = service.update_account(
                account_id,
                display_order=data.display_order,
                is_active=data.is_active,
            )
        except LookupError:
            return json_response(404, {"error": "Account not found"})

        balance = service.calculate_account_balance(updated.id)
        response = _account_to_schema(updated, balance).model_dump(mode="json")

    return json_response(200, response)
