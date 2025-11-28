from __future__ import annotations

from decimal import Decimal
from uuid import UUID, uuid4


def test_create_list_update_subscription(api_call, json_body, make_account_event) -> None:
    # Create a category for the subscription
    cat_resp = api_call(
        "POST",
        "/categories",
        {"name": f"SubCat-{uuid4().hex[:6]}", "category_type": "expense"},
    )
    category_id = json_body(cat_resp)["id"]

    # Create subscription
    create_payload = {
        "name": f"Sub-{uuid4().hex[:6]}",
        "matcher_text": "spotify",
        "matcher_amount_tolerance": "5.00",
        "matcher_day_of_month": 15,
        "category_id": category_id,
    }
    create_resp = api_call("POST", "/subscriptions", create_payload)
    assert create_resp["statusCode"] == 201
    created = json_body(create_resp)
    sub_id = created["id"]
    assert created["name"] == create_payload["name"]

    # List subscriptions
    list_resp = api_call("GET", "/subscriptions")
    assert list_resp["statusCode"] == 200
    subs = json_body(list_resp)["subscriptions"]
    assert any(UUID(item["id"]) == UUID(sub_id) for item in subs)

    # Update subscription
    update_payload = {"name": f"{create_payload['name']}-updated", "matcher_day_of_month": 20}
    update_resp = api_call("PATCH", f"/subscriptions/{sub_id}", update_payload)
    assert update_resp["statusCode"] == 200
    updated = json_body(update_resp)
    assert updated["name"] == update_payload["name"]
    assert updated["matcher_day_of_month"] == 20


def test_attach_detach_subscription(api_call, json_body, make_account_event) -> None:
    # Create two accounts and a transaction
    acc1_resp = api_call("POST", "/accounts", make_account_event("normal")["body"])
    acc2_resp = api_call("POST", "/accounts", make_account_event("normal")["body"])
    acc1 = json_body(acc1_resp)["id"]
    acc2 = json_body(acc2_resp)["id"]

    txn_payload = {
        "occurred_at": "2025-02-01T00:00:00Z",
        "posted_at": "2025-02-01T00:00:00Z",
        "legs": [
            {"account_id": acc1, "amount": "-20.00"},
            {"account_id": acc2, "amount": "20.00"},
        ],
        "description": "Spotify",
    }
    txn_resp = api_call("POST", "/transactions", txn_payload)
    assert txn_resp["statusCode"] == 201
    txn_id = json_body(txn_resp)["id"]

    # Create subscription
    sub_resp = api_call(
        "POST",
        "/subscriptions",
        {
            "name": f"AttachSub-{uuid4().hex[:6]}",
            "matcher_text": "spotify",
            "matcher_amount_tolerance": "1.00",
            "matcher_day_of_month": 1,
        },
    )
    sub_id = json_body(sub_resp)["id"]

    # Attach subscription to transaction
    attach_resp = api_call(
        "PUT",
        f"/transactions/{txn_id}/subscription",
        {"subscription_id": sub_id},
    )
    assert attach_resp["statusCode"] == 200

    # Verify transaction has subscription in listing
    tx_list_resp = api_call("GET", f"/transactions?account_ids={acc1},{acc2}")
    txs = json_body(tx_list_resp)["transactions"]
    assert any(t["id"] == txn_id and t.get("subscription_id") == sub_id for t in txs)

    # Detach subscription
    detach_resp = api_call("DELETE", f"/transactions/{txn_id}/subscription")
    assert detach_resp["statusCode"] == 200

    tx_list_resp2 = api_call("GET", f"/transactions?account_ids={acc1},{acc2}")
    txs2 = json_body(tx_list_resp2)["transactions"]
    assert any(t["id"] == txn_id and t.get("subscription_id") is None for t in txs2)


def test_subscription_summary(api_call, json_body, make_account_event) -> None:
    # Create accounts and subscription
    acc1_resp = api_call("POST", "/accounts", make_account_event("normal")["body"])
    acc2_resp = api_call("POST", "/accounts", make_account_event("normal")["body"])
    acc1 = json_body(acc1_resp)["id"]
    acc2 = json_body(acc2_resp)["id"]

    sub_resp = api_call(
        "POST",
        "/subscriptions",
        {
            "name": f"SummarySub-{uuid4().hex[:6]}",
            "matcher_text": "netflix",
            "matcher_amount_tolerance": "2.00",
            "matcher_day_of_month": 10,
        },
    )
    sub_id = json_body(sub_resp)["id"]

    # Attach to a transaction to generate summary data
    txn_payload = {
        "occurred_at": "2025-03-01T00:00:00Z",
        "posted_at": "2025-03-01T00:00:00Z",
        "legs": [
            {"account_id": acc1, "amount": "-9.99"},
            {"account_id": acc2, "amount": "9.99"},
        ],
        "subscription_id": sub_id,
        "description": "Netflix",
    }
    txn_resp = api_call("POST", "/transactions", txn_payload)
    assert txn_resp["statusCode"] == 201

    summary_resp = api_call("GET", "/subscriptions/summary")
    assert summary_resp["statusCode"] == 200
    summary_body = json_body(summary_resp)
    assert "subscriptions" in summary_body
    assert any(item.get("id") == sub_id for item in summary_body["subscriptions"])
