from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "yearlyCategoryDetail"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/yearly-category-detail"
COVERS_ROUTE = None


def test_yearlyCategoryDetail_integration(exercise_serverless_function) -> None:
    exercise_serverless_function(COVERS_SERVERLESS_FUNCTION)
