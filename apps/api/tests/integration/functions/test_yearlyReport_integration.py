from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "yearlyReport"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/yearly"
COVERS_ROUTE = None


def test_yearlyReport_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    account_id = data["target"]["id"]
    body = context.call("GET", f"/reports/yearly?account_ids={account_id}", None, expected=200)
    assert isinstance(body.get("results"), list)
