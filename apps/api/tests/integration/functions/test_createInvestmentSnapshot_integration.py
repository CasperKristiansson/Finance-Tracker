from __future__ import annotations

from datetime import datetime, timezone

COVERS_SERVERLESS_FUNCTION = "createInvestmentSnapshot"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/investments/snapshots"
COVERS_ROUTE = None


def test_createInvestmentSnapshot_integration(integration_context) -> None:
    context = integration_context
    account = context.create_account(account_type="investment")
    snapshot_date = datetime.now(timezone.utc).date().isoformat()
    body = context.call(
        "POST",
        "/investments/snapshots",
        {
            "account_id": account["id"],
            "snapshot_date": snapshot_date,
            "balance": "25000.00",
            "notes": context.unique("snapshot"),
        },
        expected=201,
    )
    assert body.get("snapshot_id")
