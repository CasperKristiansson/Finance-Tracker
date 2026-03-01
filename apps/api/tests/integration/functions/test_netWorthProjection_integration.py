from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "netWorthProjection"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/forecast/net-worth"
COVERS_ROUTE = None


def test_netWorthProjection_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    account_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/forecast/net-worth?account_ids={account_id}",
        None,
        expected=200,
    )
    assert body.get("points") or body.get("forecasts")
