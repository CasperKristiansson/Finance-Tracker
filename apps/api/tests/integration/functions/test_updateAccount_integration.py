from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "updateAccount"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "PATCH"
COVERS_HTTP_PATH = "/accounts/{accountId}"
COVERS_ROUTE = None


def test_updateAccount_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
