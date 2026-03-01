from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listGoals"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/goals"
COVERS_ROUTE = None


def test_listGoals_integration(integration_context) -> None:
    context = integration_context
    goal = context.create_goal()
    body = context.call("GET", "/goals", None, expected=200)
    goal_ids = {item["id"] for item in body.get("goals", [])}
    assert goal["id"] in goal_ids
