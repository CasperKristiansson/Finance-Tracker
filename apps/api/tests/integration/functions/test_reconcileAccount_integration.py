from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

COVERS_SERVERLESS_FUNCTION = "reconcileAccount"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/accounts/{accountId}/reconcile"
COVERS_ROUTE = None


def test_reconcileAccount_integration(integration_context) -> None:
    context = integration_context
    account = context.create_account()
    captured = datetime.now(timezone.utc).replace(microsecond=0)
    body = context.call(
        "POST",
        f"/accounts/{account['id']}/reconcile",
        {
            "captured_at": captured.isoformat(),
            "reported_balance": "150.00",
            "description": context.unique("reconcile"),
        },
        expected=201,
    )
    assert body.get("transaction_id")


def test_reconcileAccount_second_call_with_same_balance_posts_no_adjustment(
    integration_context,
) -> None:
    context = integration_context
    account = context.create_account()
    captured = datetime.now(timezone.utc).replace(microsecond=0)
    first = context.call(
        "POST",
        f"/accounts/{account['id']}/reconcile",
        {
            "captured_at": captured.isoformat(),
            "reported_balance": "150.00",
            "description": context.unique("reconcile-1"),
        },
        expected=201,
    )
    assert first.get("transaction_id")

    second = context.call(
        "POST",
        f"/accounts/{account['id']}/reconcile",
        {
            "captured_at": captured.isoformat(),
            "reported_balance": "150.00",
            "description": context.unique("reconcile-2"),
        },
        expected=201,
    )
    assert Decimal(str(second["delta_posted"])) == Decimal("0")
    assert second.get("transaction_id") is None


def test_reconcileAccount_rejects_invalid_payload_without_side_effect(
    integration_context,
) -> None:
    context = integration_context
    account = context.create_account()
    before = context.call("GET", f"/transactions?account_ids={account['id']}", None, expected=200)
    before_count = len(before.get("transactions", []))

    response = context.call_raw(
        "POST",
        f"/accounts/{account['id']}/reconcile",
        {
            "captured_at": "not-a-date",
            "reported_balance": "invalid-amount",
        },
    )
    context.assert_status(response, 400, message="POST /accounts/{id}/reconcile invalid payload")

    after = context.call("GET", f"/transactions?account_ids={account['id']}", None, expected=200)
    assert len(after.get("transactions", [])) == before_count
