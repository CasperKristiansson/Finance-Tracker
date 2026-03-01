from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "reconcileAccount"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/accounts/{accountId}/reconcile"
COVERS_ROUTE = None


def test_reconcileAccount_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
