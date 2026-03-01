from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "yearlyReport"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/yearly"
COVERS_ROUTE = None


def test_yearlyReport_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
