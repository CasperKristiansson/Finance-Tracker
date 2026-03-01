from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "yearlyCategoryDetail"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/yearly-category-detail"
COVERS_ROUTE = None


def test_yearlyCategoryDetail_integration(integration_context) -> None:
    context = integration_context
    category = context.create_category(category_type="expense")
    data = context.create_transfer(category_id=category["id"])
    year = data["occurred"].year
    account_id = data["source"]["id"]
    body = context.call(
        "GET",
        (
            f"/reports/yearly-category-detail?year={year}&category_id={category['id']}"
            f"&flow=expense&account_ids={account_id}"
        ),
        None,
        expected=200,
    )
    assert "monthly" in body
