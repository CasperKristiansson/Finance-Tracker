from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "updateAccount"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "PATCH"
COVERS_HTTP_PATH = "/accounts/{accountId}"
COVERS_ROUTE = None


def test_updateAccount_integration(integration_context) -> None:
    context = integration_context
    account = context.create_account()
    body = context.call(
        "PATCH",
        f"/accounts/{account['id']}",
        {"name": context.unique("updated"), "is_active": False},
        expected=200,
    )
    assert body["is_active"] is False
