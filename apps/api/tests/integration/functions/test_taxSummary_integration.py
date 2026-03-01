from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "taxSummary"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/tax/summary"
COVERS_ROUTE = None


def test_taxSummary_integration(integration_context) -> None:
    context = integration_context
    data = context.create_tax_event()
    year = data["occurred"].year
    body = context.call("GET", f"/tax/summary?year={year}", None, expected=200)
    assert body.get("year") == year
