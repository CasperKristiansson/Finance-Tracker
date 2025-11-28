from __future__ import annotations

from decimal import Decimal
from uuid import UUID, uuid4


def test_create_list_update_delete_goal(api_call, json_body, make_account_event) -> None:
    # Create category and account for goal linkage
    category_resp = api_call(
        "POST",
        "/categories",
        {"name": f"GoalCat-{uuid4().hex[:6]}", "category_type": "expense"},
    )
    assert category_resp["statusCode"] == 201
    category_id = json_body(category_resp)["id"]

    account_resp = api_call("POST", "/accounts", make_account_event("normal")["body"])
    assert account_resp["statusCode"] == 201
    account_id = json_body(account_resp)["id"]

    # Create goal
    create_payload = {
        "name": f"Goal-{uuid4().hex[:6]}",
        "target_amount": "1000.00",
        "category_id": category_id,
        "account_id": account_id,
        "note": "Integration goal",
    }
    create_resp = api_call("POST", "/goals", create_payload)
    assert create_resp["statusCode"] == 201
    goal = json_body(create_resp)
    goal_id = goal["id"]
    assert Decimal(goal["target_amount"]) == Decimal("1000.00")

    # List goals
    list_resp = api_call("GET", "/goals")
    assert list_resp["statusCode"] == 200
    goals = json_body(list_resp)["goals"]
    assert any(UUID(g["id"]) == UUID(goal_id) for g in goals)

    # Update goal
    update_payload = {"target_amount": "1500.00", "note": "Updated goal note"}
    update_resp = api_call("PATCH", f"/goals/{goal_id}", update_payload)
    assert update_resp["statusCode"] == 200
    updated = json_body(update_resp)
    assert Decimal(updated["target_amount"]) == Decimal("1500.00")
    assert updated["note"] == "Updated goal note"

    # Delete goal
    delete_resp = api_call("DELETE", f"/goals/{goal_id}")
    assert delete_resp["statusCode"] == 204

    # Verify deletion
    list_resp_after = api_call("GET", "/goals")
    assert list_resp_after["statusCode"] == 200
    goals_after = json_body(list_resp_after)["goals"]
    assert all(UUID(g["id"]) != UUID(goal_id) for g in goals_after)
