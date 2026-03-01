from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "deleteTransaction"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "DELETE"
COVERS_HTTP_PATH = "/transactions/{transactionId}"
COVERS_ROUTE = None


def test_deleteTransaction_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    transaction_id = data["transaction"]["id"]
    response = context.call_raw("DELETE", f"/transactions/{transaction_id}", None)
    context.assert_status(response, 204, message="DELETE transaction")
