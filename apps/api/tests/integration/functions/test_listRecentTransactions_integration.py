from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listRecentTransactions"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/transactions/recent"
COVERS_ROUTE = None


def test_listRecentTransactions_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    account_id = data["target"]["id"]

    body = context.call(
        "GET",
        f"/transactions/recent?account_ids={account_id}&limit=5",
        None,
        expected=200,
    )
    assert body.get("transactions")
