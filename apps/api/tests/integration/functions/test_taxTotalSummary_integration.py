from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "taxTotalSummary"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/tax/summary/total"
COVERS_ROUTE = None


def test_taxTotalSummary_integration(integration_context) -> None:
    context = integration_context
    context.create_tax_event()
    body = context.call("GET", "/tax/summary/total", None, expected=200)
    assert "totals" in body
