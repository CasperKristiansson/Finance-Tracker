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


def test_suggestImportCategoriesJob_rejects_duplicate_batch_request(integration_context) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    row = preview["rows"][0]
    category = context.create_category()

    client_id = uuid4()
    token = f"token-{uuid4().hex}"
    connection_id = f"{context.run_namespace}-dup-job"
    context.ws_connect(client_id=client_id, client_token=token, connection_id=connection_id)
    context.cleanup_registry.add(context.ws_disconnect, connection_id=connection_id)

    payload = {
        "client_id": str(client_id),
        "client_token": token,
        "import_batch_id": preview["import_batch_id"],
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
                "id": row["id"],
                "description": row["description"],
                "amount": row["amount"],
                "occurred_at": row["occurred_at"],
            }
        ],
    }

    context.call("POST", "/imports/suggest-categories/jobs", payload, expected=202)
    duplicate = context.call_raw("POST", "/imports/suggest-categories/jobs", payload)
    context.assert_status(duplicate, 409, message="POST /imports/suggest-categories/jobs duplicate")
