from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "getLoanSchedule"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/loans/{accountId}/schedule"
COVERS_ROUTE = None


def test_getLoanSchedule_integration(integration_context) -> None:
    context = integration_context
    data = context.create_loan()
    account_id = data["account"]["id"]
    body = context.call("GET", f"/loans/{account_id}/schedule", None, expected=200)
    assert "schedule" in body
