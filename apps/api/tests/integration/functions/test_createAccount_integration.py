from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "createAccount"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/accounts"
COVERS_ROUTE = None


def test_createAccount_integration(integration_context) -> None:
    context = integration_context
    account = context.create_account()
    assert account["id"]
