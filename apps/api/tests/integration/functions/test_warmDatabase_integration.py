from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "warmDatabase"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/warmup"
COVERS_ROUTE = None


def test_warmDatabase_integration(integration_context) -> None:
    context = integration_context
    body = context.call("GET", "/warmup", None, expected=200)
    assert body.get("status") in {"ready", "starting"}
