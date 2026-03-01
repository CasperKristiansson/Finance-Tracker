from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "updateLoan"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "PATCH"
COVERS_HTTP_PATH = "/loans/{accountId}"
COVERS_ROUTE = None


def test_updateLoan_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
