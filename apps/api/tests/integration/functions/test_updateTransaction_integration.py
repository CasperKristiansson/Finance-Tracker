from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "updateTransaction"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "PATCH"
COVERS_HTTP_PATH = "/transactions/{transactionId}"
COVERS_ROUTE = None


def test_updateTransaction_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
