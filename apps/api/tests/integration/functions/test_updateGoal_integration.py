from __future__ import annotations

from decimal import Decimal

COVERS_SERVERLESS_FUNCTION = "updateGoal"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "PATCH"
COVERS_HTTP_PATH = "/goals/{goalId}"
COVERS_ROUTE = None


def test_updateGoal_integration(integration_context) -> None:
    context = integration_context
    goal = context.create_goal()
    body = context.call(
        "PATCH",
        f"/goals/{goal['id']}",
        {"target_amount": "1500.00", "note": context.unique("goal-note")},
        expected=200,
    )
    assert Decimal(body["target_amount"]) == Decimal("1500.00")
