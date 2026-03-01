from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "cashflowForecast"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/forecast/cashflow"
COVERS_ROUTE = None


def test_cashflowForecast_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
