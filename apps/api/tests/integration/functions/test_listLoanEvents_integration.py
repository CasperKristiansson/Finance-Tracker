from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listLoanEvents"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/loans/{accountId}/events"
COVERS_ROUTE = None


def test_listLoanEvents_integration(integration_context) -> None:
    context = integration_context
    data = context.create_loan()
    account_id = data["account"]["id"]
    body = context.call("GET", f"/loans/{account_id}/events", None, expected=200)
    assert "events" in body
