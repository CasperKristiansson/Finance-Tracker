from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "exportReport"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/reports/export"
COVERS_ROUTE = None


def test_exportReport_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    source_id = data["source"]["id"]
    target_id = data["target"]["id"]
    year = data["occurred"].year
    body = context.call(
        "POST",
        "/reports/export",
        {
            "account_ids": [source_id, target_id],
            "start_date": f"{year}-01-01T00:00:00Z",
            "end_date": f"{year}-12-31T00:00:00Z",
            "granularity": "monthly",
            "format": "csv",
            "year": year,
        },
        expected=200,
    )
    assert body.get("data_base64")
