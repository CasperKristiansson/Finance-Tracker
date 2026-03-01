from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "databaseBackup"
COVERS_EVENT_TYPE = "schedule"
COVERS_HTTP_METHOD = None
COVERS_HTTP_PATH = None
COVERS_ROUTE = None


def test_databaseBackup_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
