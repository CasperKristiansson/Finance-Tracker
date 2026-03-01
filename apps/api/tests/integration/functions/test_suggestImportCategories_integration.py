from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

COVERS_SERVERLESS_FUNCTION = "suggestImportCategories"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/imports/suggest-categories"
COVERS_ROUTE = None


def test_suggestImportCategories_integration(integration_context) -> None:
    context = integration_context
    category = context.create_category()
    payload = {
        "categories": [
            {
                "id": category["id"],
                "name": category["name"],
                "category_type": category["category_type"],
            }
        ],
        "history": [{"description": "Coffee", "category_id": category["id"]}],
        "transactions": [
            {
                "id": str(uuid4()),
                "description": "Coffee shop",
                "amount": "45.00",
                "occurred_at": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }
    body = context.call("POST", "/imports/suggest-categories", payload, expected=200)
    assert "suggestions" in body
