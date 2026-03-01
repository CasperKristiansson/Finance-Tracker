from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "createTaxEvent"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/tax/events"
COVERS_ROUTE = None


def test_createTaxEvent_integration(integration_context) -> None:
    context = integration_context
    tax_event = context.create_tax_event()["tax_event"]
    assert tax_event.get("tax_event", {}).get("id")
