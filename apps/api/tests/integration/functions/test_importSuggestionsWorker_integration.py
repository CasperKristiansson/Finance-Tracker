from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "importSuggestionsWorker"
COVERS_EVENT_TYPE = "sqs"
COVERS_HTTP_METHOD = None
COVERS_HTTP_PATH = None
COVERS_ROUTE = None


def test_importSuggestionsWorker_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
