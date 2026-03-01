from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listAccounts"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/accounts"
COVERS_ROUTE = None


def test_listAccounts_integration(integration_context) -> None:
    context = integration_context
    created = context.create_account()
    body = context.call("GET", "/accounts", None, expected=200)
    account_ids = {account["id"] for account in body.get("accounts", [])}
    assert created["id"] in account_ids
