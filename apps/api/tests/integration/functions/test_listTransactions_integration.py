from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listTransactions"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/transactions"
COVERS_ROUTE = None


def test_listTransactions_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    source_id = data["source"]["id"]
    target_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/transactions?account_ids={source_id},{target_id}",
        None,
        expected=200,
    )
    assert body.get("transactions")
