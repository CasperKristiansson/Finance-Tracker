from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "createTransaction"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/transactions"
COVERS_ROUTE = None


def test_createTransaction_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    assert data["transaction"]["id"]
