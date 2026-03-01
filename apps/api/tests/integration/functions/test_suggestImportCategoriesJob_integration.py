from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

COVERS_SERVERLESS_FUNCTION = "suggestImportCategoriesJob"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/imports/suggest-categories/jobs"
COVERS_ROUTE = None


def test_suggestImportCategoriesJob_integration(integration_context) -> None:
    context = integration_context
    client_id = uuid4()
    token = f"token-{uuid4().hex}"
    connection_id = f"{context.run_namespace}-job"
    context.ws_connect(client_id=client_id, client_token=token, connection_id=connection_id)
    context.cleanup_registry.add(context.ws_disconnect, connection_id=connection_id)

    category = context.create_category()
    body = context.call(
        "POST",
        "/imports/suggest-categories/jobs",
        {
            "client_id": str(client_id),
            "client_token": token,
            "categories": [
                {
                    "id": category["id"],
                    "name": category["name"],
                    "category_type": category["category_type"],
                }
            ],
            "history": [],
            "transactions": [
                {
                    "id": str(uuid4()),
                    "description": "Queued suggestion",
                    "amount": "20.00",
                    "occurred_at": datetime.now(timezone.utc).isoformat(),
                }
            ],
        },
        expected=202,
    )
    assert body.get("job_id")
