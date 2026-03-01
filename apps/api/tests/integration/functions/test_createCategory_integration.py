from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "createCategory"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/categories"
COVERS_ROUTE = None


def test_createCategory_integration(integration_context) -> None:
    context = integration_context
    category = context.create_category()
    assert category["id"]
