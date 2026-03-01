from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "deleteGoal"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "DELETE"
COVERS_HTTP_PATH = "/goals/{goalId}"
COVERS_ROUTE = None


def test_deleteGoal_integration(integration_context) -> None:
    context = integration_context
    goal = context.create_goal()
    response = context.call_raw("DELETE", f"/goals/{goal['id']}", None)
    context.assert_status(response, 204, message="DELETE goal")
