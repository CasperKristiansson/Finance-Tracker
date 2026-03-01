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
