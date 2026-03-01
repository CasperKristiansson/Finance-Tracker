from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "taxTotalSummary"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/tax/summary/total"
COVERS_ROUTE = None


def test_taxTotalSummary_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
