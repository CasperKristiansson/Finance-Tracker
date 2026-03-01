from __future__ import annotations

from datetime import datetime, timezone

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
