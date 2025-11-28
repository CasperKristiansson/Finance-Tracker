from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4


def test_create_update_list_loans(api_call, json_body, make_account_event) -> None:
    # Create a debt account (no loan attached yet)
    loan_details = {
        "origin_principal": "10000.00",
        "current_principal": "10000.00",
        "interest_rate_annual": "0.035",
        "interest_compound": "monthly",
        "minimum_payment": "500.00",
    }
    account_resp = api_call(
        "POST",
        "/accounts",
        {"account_type": "debt", "is_active": True, "loan": loan_details},
    )
    assert account_resp["statusCode"] == 201
    account_id = json_body(account_resp)["id"]

    # Attach loan via /loans
    create_payload = {
        "account_id": account_id,
        "origin_principal": "10000.00",
        "current_principal": "10000.00",
        "interest_rate_annual": "0.035",
        "interest_compound": "monthly",
        "minimum_payment": "500.00",
    }
    create_resp = api_call("POST", "/loans", create_payload)
    # Account already has a loan; endpoint should reject with 400
    assert create_resp["statusCode"] == 400

    # Update loan
    update_payload = {"interest_rate_annual": "0.04", "minimum_payment": "600.00"}
    update_resp = api_call("PATCH", f"/loans/{account_id}", update_payload)
    assert update_resp["statusCode"] == 200
    updated = json_body(update_resp)
    assert Decimal(updated["interest_rate_annual"]) == Decimal("0.04")
    assert Decimal(updated["minimum_payment"]) == Decimal("600.00")

    # List loan events (should be empty initially)
    events_resp = api_call("GET", f"/loans/{account_id}/events")
    assert events_resp["statusCode"] == 200
    events_body = json_body(events_resp)
    assert "events" in events_body

    # Loan schedule endpoint
    schedule_resp = api_call("GET", f"/loans/{account_id}/schedule")
    assert schedule_resp["statusCode"] == 200
    schedule_body = json_body(schedule_resp)
    assert "schedule" in schedule_body
