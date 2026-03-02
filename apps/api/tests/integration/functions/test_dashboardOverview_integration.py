from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "dashboardOverview"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/dashboard-overview"
COVERS_ROUTE = None


def test_dashboardOverview_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    account_id = data["target"]["id"]
    year = data["occurred"].year

    body = context.call(
        "GET",
        f"/reports/dashboard-overview?year={year}&account_ids={account_id}",
        None,
        expected=200,
    )

    assert body.get("monthly") is not None
    assert body.get("total") is not None
    assert body.get("net_worth") is not None
