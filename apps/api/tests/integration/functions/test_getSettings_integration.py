from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "getSettings"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/settings"
COVERS_ROUTE = None


def test_getSettings_integration(integration_context) -> None:
    context = integration_context
    body = context.call("GET", "/settings", None, expected=200)
    assert set(body.get("settings", {}).keys()) == {"first_name", "last_name"}
