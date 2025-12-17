"""Serverless HTTP handlers for account operations."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, cast
from uuid import UUID

from pydantic import ValidationError

from ..models import Account
from ..schemas import (
    AccountCreate,
    AccountUpdate,
    AccountWithBalance,
    ListAccountsQuery,
    ListAccountsResponse,
    ReconcileAccountRequest,
    ReconcileAccountResponse,
)
from ..services import AccountService
from ..shared import AccountType, session_scope
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
    """Reset internal flags to allow clean reconfiguration in tests."""

    reset_engine_state()


def _account_to_schema(
    account: Account,
    balance: Any,
    reconciliation: dict[str, Any] | None = None,
) -> AccountWithBalance:
    payload = account.model_dump(mode="python")
    payload["loan"] = getattr(account, "loan", None)
    payload["balance"] = balance
    if reconciliation:
        payload["last_reconciled_at"] = reconciliation.get("last_captured_at")
        payload["reconciliation_gap"] = reconciliation.get("delta_since_snapshot")
        payload["needs_reconciliation"] = reconciliation.get("needs_reconciliation")
    return AccountWithBalance.model_validate(payload)


def _needs_reconciliation(
    *,
    account: Account,
    balance: Decimal,
    reconciliation: dict[str, Any],
    now: datetime,
) -> bool:
    """Return whether an account should be flagged for reconciliation.

    Rules of thumb:
    - Ignore special/internal accounts and inactive accounts.
    - Always flag meaningful balance gaps (> 1).
    - For non-investment accounts, also flag stale snapshots (older than 35 days),
      but only if the account has a meaningful balance (otherwise avoid nagging for
      zeroed accounts).
    - For investment accounts, balances come from snapshots; do not apply the staleness rule here.
      Missing investment snapshots should still be flagged.
    """

    if (account.name or "") in {"Offset", "Unassigned"}:
        return False

    if not account.is_active:
        return False

    delta = cast(Decimal, reconciliation.get("delta_since_snapshot") or Decimal(0))
    if abs(delta) > 1:
        return True

    last_captured = reconciliation.get("last_captured_at")
    if last_captured is None:
        return abs(balance) > 1

    if not isinstance(last_captured, datetime):
        return True

    if account.account_type == AccountType.INVESTMENT:
        return False

    age = now - last_captured
    if age > timedelta(days=35):
        return abs(balance) > 1

    return False


def list_accounts(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP GET /accounts."""

    ensure_engine()
    user_id = get_user_id(event)
    params = get_query_params(event)

    try:
        query = ListAccountsQuery.model_validate(params)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = AccountService(session)
        accounts_with_balances = service.list_accounts_with_balance(
            include_inactive=query.include_inactive,
            as_of=query.as_of_date,
        )

        data = []
        now = datetime.now(timezone.utc)
        for account, balance in accounts_with_balances:
            reconciliation = service.reconciliation_state(account.id)
            needs = _needs_reconciliation(
                account=account,
                balance=balance,
                reconciliation=reconciliation,
                now=now,
            )
            reconciliation["needs_reconciliation"] = needs
            data.append(_account_to_schema(account, balance, reconciliation))
    response = ListAccountsResponse(accounts=data)
    return json_response(200, response.model_dump(mode="json"))


def create_account(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /accounts."""

    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)

    try:
        data = AccountCreate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    account = Account(
        name=data.name,
        account_type=data.account_type,
        is_active=data.is_active,
        icon=data.icon,
        bank_import_type=data.bank_import_type,
    )

    with session_scope(user_id=user_id) as session:
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

    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)
    account_id = extract_path_uuid(event, param_names=("account_id", "accountId"))
    if account_id is None:
        return json_response(400, {"error": "Account ID missing from path"})

    try:
        data = AccountUpdate.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    updates = data.model_dump(exclude_unset=True)

    with session_scope(user_id=user_id) as session:
        service = AccountService(session)
        try:
            updated = service.update_account(
                account_id,
                **updates,
            )
        except LookupError:
            return json_response(404, {"error": "Account not found"})

        balance = service.calculate_account_balance(updated.id)
        response = _account_to_schema(updated, balance).model_dump(mode="json")

    return json_response(200, response)


def reconcile_account(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /accounts/{accountId}/reconcile."""

    ensure_engine()
    user_id = get_user_id(event)
    payload = parse_body(event)
    account_id = extract_path_uuid(event, param_names=("account_id", "accountId"))
    if account_id is None:
        return json_response(400, {"error": "Account ID missing from path"})

    try:
        data = ReconcileAccountRequest.model_validate(payload)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope(user_id=user_id) as session:
        service = AccountService(session)
        try:
            result = service.reconcile_account(
                account_id,
                captured_at=data.captured_at,
                reported_balance=data.reported_balance,
                description=data.description,
                category_id=data.category_id,
            )
        except LookupError:
            return json_response(404, {"error": "Account not found"})

        ledger_balance = cast(Decimal, result.get("ledger_balance", Decimal(0)))
        delta_posted = cast(Decimal, result.get("delta", Decimal(0)))
        snapshot = cast(Any, result.get("snapshot"))
        transaction = cast(Any, result.get("transaction"))
        snapshot_id = cast(UUID, getattr(snapshot, "id", None))
        transaction_id = cast(UUID | None, getattr(transaction, "id", None))

    response = ReconcileAccountResponse(
        account_id=account_id,
        reported_balance=data.reported_balance,
        ledger_balance=ledger_balance,
        delta_posted=delta_posted,
        snapshot_id=snapshot_id,
        transaction_id=transaction_id,
        captured_at=data.captured_at,
    )
    return json_response(201, response.model_dump(mode="json"))
