from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "totalReport"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/total"
COVERS_ROUTE = None


def test_totalReport_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    source_id = data["source"]["id"]
    target_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/total?account_ids={source_id},{target_id}",
        None,
        expected=200,
    )
    assert "net" in body
