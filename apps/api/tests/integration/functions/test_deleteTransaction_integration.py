from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "deleteTransaction"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "DELETE"
COVERS_HTTP_PATH = "/transactions/{transactionId}"
COVERS_ROUTE = None


def test_deleteTransaction_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
