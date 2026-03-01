from __future__ import annotations

from datetime import timedelta

COVERS_SERVERLESS_FUNCTION = "dateRangeReport"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/custom"
COVERS_ROUTE = None


def test_dateRangeReport_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    account_id = data["target"]["id"]
    occurred = data["occurred"]
    start = (occurred - timedelta(days=1)).date().isoformat()
    end = (occurred + timedelta(days=1)).date().isoformat()
    body = context.call(
        "GET",
        f"/reports/custom?account_ids={account_id}&start_date={start}&end_date={end}",
        None,
        expected=200,
    )
    assert isinstance(body.get("results"), list)
