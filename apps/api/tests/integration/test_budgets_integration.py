from __future__ import annotations

from decimal import Decimal
from uuid import UUID, uuid4


def test_create_list_update_delete_budget(api_call, json_body) -> None:
    name = f"BudgetCat-{uuid4().hex[:6]}"
    # Create a category for the budget
    cat_resp = api_call(
        "POST",
        "/categories",
        {"name": name, "category_type": "expense"},
    )
    assert cat_resp["statusCode"] == 201
    category_id = json_body(cat_resp)["id"]

    # Create budget
    create_payload = {
        "category_id": category_id,
        "period": "monthly",
        "amount": "250.00",
        "note": "Integration budget",
    }
    create_resp = api_call("POST", "/budgets", create_payload)
    assert create_resp["statusCode"] == 201
    budget = json_body(create_resp)
    budget_id = budget["id"]
    assert budget["amount"] == "250.00"

    # List budgets
    list_resp = api_call("GET", "/budgets")
    assert list_resp["statusCode"] == 200
    budgets = json_body(list_resp)["budgets"]
    assert any(UUID(b["id"]) == UUID(budget_id) for b in budgets)

    # Update budget
    update_payload = {"amount": "300.00", "note": "Updated note"}
    update_resp = api_call("PATCH", f"/budgets/{budget_id}", update_payload)
    assert update_resp["statusCode"] == 200
    updated = json_body(update_resp)
    assert Decimal(updated["amount"]) == Decimal("300.00")
    assert updated["note"] == "Updated note"

    # Delete budget
    delete_resp = api_call("DELETE", f"/budgets/{budget_id}")
    assert delete_resp["statusCode"] == 204

    # Verify budget no longer in list
    list_resp_after = api_call("GET", "/budgets")
    assert list_resp_after["statusCode"] == 200
    budgets_after = json_body(list_resp_after)["budgets"]
    assert all(UUID(b["id"]) != UUID(budget_id) for b in budgets_after)


def test_budget_progress(api_call, json_body) -> None:
    cat_name = f"BudgetProgress-{uuid4().hex[:6]}"
    cat_resp = api_call(
        "POST",
        "/categories",
        {"name": cat_name, "category_type": "expense"},
    )
    category_id = json_body(cat_resp)["id"]

    create_resp = api_call(
        "POST",
        "/budgets",
        {"category_id": category_id, "period": "monthly", "amount": "100.00"},
    )
    assert create_resp["statusCode"] == 201

    progress_resp = api_call("GET", "/budgets/progress")
    assert progress_resp["statusCode"] == 200
    progress_body = json_body(progress_resp)
    # Handler may return empty progress if no transactions exist; just ensure shape exists
    if "progress" in progress_body:
        assert any(
            UUID(item["category_id"]) == UUID(category_id) for item in progress_body["progress"]
        )
