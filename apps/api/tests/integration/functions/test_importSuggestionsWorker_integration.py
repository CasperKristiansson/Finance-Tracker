from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

COVERS_SERVERLESS_FUNCTION = "importSuggestionsWorker"
COVERS_EVENT_TYPE = "sqs"
COVERS_HTTP_METHOD = None
COVERS_HTTP_PATH = None
COVERS_ROUTE = None


def test_importSuggestionsWorker_integration(integration_context) -> None:
    context = integration_context
    event = {
        "Records": [
            {
                "body": json.dumps(
                    {
                        "client_id": str(uuid4()),
                        "client_token": f"token-{uuid4().hex}",
                        "categories": [],
                        "history": [],
                        "transactions": [
                            {
                                "id": str(uuid4()),
                                "description": "Worker payload",
                                "amount": "1.00",
                                "occurred_at": datetime.now(timezone.utc).isoformat(),
                            }
                        ],
                    }
                )
            }
        ]
    }
    response = context.invoke_raw("importSuggestionsWorker", event)
    assert response.get("batchItemFailures") == []


def test_importSuggestionsWorker_persists_failed_status_on_bedrock_error(
    integration_context,
) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    row = preview["rows"][0]
    category = context.create_category()

    failing_event = {
        "Records": [
            {
                "body": json.dumps(
                    {
                        "job_id": str(uuid4()),
                        "user_id": context.user_id,
                        "import_batch_id": preview["import_batch_id"],
                        "client_id": str(uuid4()),
                        "client_token": f"token-{uuid4().hex}",
                        "model_id": "invalid.model.id",
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
                )
            }
        ]
    }
    worker_response = context.invoke_raw("importSuggestionsWorker", failing_event)
    assert worker_response.get("batchItemFailures") == []

    refreshed = context.call("GET", f"/imports/{preview['import_batch_id']}", None, expected=200)
    assert refreshed["suggestions_status"] == "failed"
