from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "createCategory"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/categories"
COVERS_ROUTE = None


def test_createCategory_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
