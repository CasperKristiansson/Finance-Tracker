from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "yearlyOverview"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/yearly-overview"
COVERS_ROUTE = None


def test_yearlyOverview_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    year = data["occurred"].year
    account_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/yearly-overview?account_ids={account_id}&year={year}",
        None,
        expected=200,
    )
    assert body.get("stats")
