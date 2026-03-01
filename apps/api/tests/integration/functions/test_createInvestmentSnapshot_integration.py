from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "createInvestmentSnapshot"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/investments/snapshots"
COVERS_ROUTE = None


def test_createInvestmentSnapshot_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
