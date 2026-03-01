from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "createGoal"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/goals"
COVERS_ROUTE = None


def test_createGoal_integration(integration_context) -> None:
    context = integration_context
    goal = context.create_goal()
    assert goal["id"]
