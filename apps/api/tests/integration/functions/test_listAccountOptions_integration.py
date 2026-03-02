from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listAccountOptions"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/accounts/options"
COVERS_ROUTE = None


def test_listAccountOptions_integration(integration_context) -> None:
    context = integration_context
    created = context.create_account(account_type="normal")

    body = context.call("GET", "/accounts/options", None, expected=200)
    option_ids = {option["id"] for option in body.get("options", [])}
    assert created["id"] in option_ids
