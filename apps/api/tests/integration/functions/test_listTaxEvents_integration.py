from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listTaxEvents"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/tax/events"
COVERS_ROUTE = None


def test_listTaxEvents_integration(integration_context) -> None:
    context = integration_context
    context.create_tax_event()
    body = context.call("GET", "/tax/events", None, expected=200)
    assert isinstance(body.get("events"), list)
