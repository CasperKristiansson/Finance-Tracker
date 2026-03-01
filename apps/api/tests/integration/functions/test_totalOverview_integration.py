from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "totalOverview"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/total-overview"
COVERS_ROUTE = None


def test_totalOverview_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    account_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/total-overview?account_ids={account_id}",
        None,
        expected=200,
    )
    assert body.get("kpis")
