from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "investmentOverview"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/investments/overview"
COVERS_ROUTE = None


def test_investmentOverview_integration(integration_context) -> None:
    context = integration_context
    body = context.call("GET", "/investments/overview", None, expected=200)
    assert "portfolio" in body
