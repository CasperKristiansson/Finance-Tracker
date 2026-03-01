from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "saveSettings"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "PUT"
COVERS_HTTP_PATH = "/settings"
COVERS_ROUTE = None


def test_saveSettings_integration(integration_context) -> None:
    context = integration_context
    body = context.call(
        "PUT",
        "/settings",
        {"settings": {"first_name": "Ada", "last_name": "Lovelace"}},
        expected=200,
    )
    assert body.get("settings", {}).get("first_name") == "Ada"
