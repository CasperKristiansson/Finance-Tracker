from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "createAccount"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/accounts"
COVERS_ROUTE = None


def test_createAccount_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
