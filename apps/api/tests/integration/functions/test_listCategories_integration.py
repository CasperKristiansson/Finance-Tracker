from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listCategories"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/categories"
COVERS_ROUTE = None


def test_listCategories_integration(integration_context) -> None:
    context = integration_context
    category = context.create_category()
    body = context.call("GET", "/categories", None, expected=200)
    ids = {item["id"] for item in body.get("categories", [])}
    assert category["id"] in ids
