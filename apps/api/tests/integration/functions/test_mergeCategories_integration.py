from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "mergeCategories"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/categories/merge"
COVERS_ROUTE = None


def test_mergeCategories_integration(integration_context) -> None:
    context = integration_context
    source = context.create_category()
    target = context.create_category()
    merged_name = context.unique("merged")
    body = context.call(
        "POST",
        "/categories/merge",
        {
            "source_category_id": source["id"],
            "target_category_id": target["id"],
            "rename_target_to": merged_name,
        },
        expected=200,
    )
    assert body["id"] == target["id"]
