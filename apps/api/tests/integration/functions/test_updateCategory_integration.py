from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "updateCategory"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "PATCH"
COVERS_HTTP_PATH = "/categories/{categoryId}"
COVERS_ROUTE = None


def test_updateCategory_integration(integration_context) -> None:
    context = integration_context
    category = context.create_category()
    updated_name = context.unique("updated-cat")
    body = context.call(
        "PATCH",
        f"/categories/{category['id']}",
        {"name": updated_name, "is_archived": True, "color_hex": "#123123"},
        expected=200,
    )
    assert body["name"] == updated_name


def test_updateCategory_enforces_user_scope(integration_context, api_call_other_user) -> None:
    context = integration_context
    category = context.create_category()
    response = api_call_other_user(
        "PATCH",
        f"/categories/{category['id']}",
        {"name": context.unique("blocked-update")},
    )
    context.assert_status(response, 404, message="PATCH /categories/{id} wrong user")


def test_updateCategory_rejects_invalid_enum(integration_context) -> None:
    context = integration_context
    category = context.create_category()
    response = context.call_raw(
        "PATCH",
        f"/categories/{category['id']}",
        {"category_type": "not-a-valid-type"},
    )
    context.assert_status(response, 400, message="PATCH /categories/{id} invalid enum")
