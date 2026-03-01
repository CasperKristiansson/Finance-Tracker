from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "importSuggestionsDisconnect"
COVERS_EVENT_TYPE = "websocket"
COVERS_HTTP_METHOD = None
COVERS_HTTP_PATH = None
COVERS_ROUTE = "$disconnect"


def test_importSuggestionsDisconnect_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
