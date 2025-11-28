from __future__ import annotations

from uuid import UUID


def test_export_report(api_call, json_body) -> None:
    # Create accounts and a transaction to ensure there is data
    acc1_resp = api_call("POST", "/accounts", {"account_type": "normal", "is_active": True})
    acc2_resp = api_call("POST", "/accounts", {"account_type": "normal", "is_active": True})
    acc1 = json_body(acc1_resp)["id"]
    acc2 = json_body(acc2_resp)["id"]

    txn_payload = {
        "occurred_at": "2025-05-01T00:00:00Z",
        "posted_at": "2025-05-01T00:00:00Z",
        "legs": [
            {"account_id": acc1, "amount": "-50.00"},
            {"account_id": acc2, "amount": "50.00"},
        ],
        "description": "Export test",
    }
    tx_resp = api_call("POST", "/transactions", txn_payload)
    assert tx_resp["statusCode"] == 201

    export_payload = {
        "account_ids": [acc1, acc2],
        "start_date": "2025-05-01T00:00:00Z",
        "end_date": "2025-05-31T00:00:00Z",
        "granularity": "monthly",
        "format": "csv",
        "year": 2025,
    }
    resp = api_call("POST", "/reports/export", export_payload)
    assert resp["statusCode"] == 200
    body = json_body(resp)
    assert "data_base64" in body
    assert body.get("content_type") in {
        "text/csv",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }
    assert body.get("filename", "").endswith(".csv")
