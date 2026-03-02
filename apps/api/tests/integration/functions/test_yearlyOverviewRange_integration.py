from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "yearlyOverviewRange"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/yearly-overview-range"
COVERS_ROUTE = None


def test_yearlyOverviewRange_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    account_id = data["target"]["id"]
    year = data["occurred"].year

    body = context.call(
        "GET",
        (
            f"/reports/yearly-overview-range?start_year={year}"
            f"&end_year={year}&account_ids={account_id}"
        ),
        None,
        expected=200,
    )

    items = body.get("items", [])
    assert isinstance(items, list)
    assert any(item.get("year") == year for item in items)
