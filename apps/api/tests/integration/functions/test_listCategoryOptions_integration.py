from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listCategoryOptions"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/categories/options"
COVERS_ROUTE = None


def test_listCategoryOptions_integration(integration_context) -> None:
    context = integration_context
    created = context.create_category(category_type="expense")

    body = context.call("GET", "/categories/options", None, expected=200)
    option_ids = {option["id"] for option in body.get("options", [])}
    assert created["id"] in option_ids
