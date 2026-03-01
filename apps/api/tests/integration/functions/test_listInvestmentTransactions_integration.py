from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listInvestmentTransactions"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/investments/transactions"
COVERS_ROUTE = None


def test_listInvestmentTransactions_integration(integration_context) -> None:
    context = integration_context
    body = context.call("GET", "/investments/transactions", None, expected=200)
    assert "transactions" in body
