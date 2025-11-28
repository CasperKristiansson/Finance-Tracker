from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID


def _create_transfer(api_call, json_body) -> tuple[UUID, UUID]:
    # Create two accounts
    acc1_resp = api_call("POST", "/accounts", {"account_type": "normal", "is_active": True})
    acc2_resp = api_call("POST", "/accounts", {"account_type": "normal", "is_active": True})
    acc1 = UUID(json_body(acc1_resp)["id"])
    acc2 = UUID(json_body(acc2_resp)["id"])

    occurred = datetime(2025, 4, 1, tzinfo=timezone.utc)
    txn_payload = {
        "occurred_at": occurred.isoformat(),
        "posted_at": occurred.isoformat(),
        "legs": [
            {"account_id": str(acc1), "amount": "-120.00"},
            {"account_id": str(acc2), "amount": "120.00"},
        ],
        "description": "Report transfer",
    }
    tx_resp = api_call("POST", "/transactions", txn_payload)
    assert tx_resp["statusCode"] == 201
    return acc1, acc2


def test_monthly_yearly_total_reports(api_call, json_body) -> None:
    acc1, acc2 = _create_transfer(api_call, json_body)

    monthly_resp = api_call("GET", f"/reports/monthly?account_ids={acc2}&year=2025")
    assert monthly_resp["statusCode"] == 200
    monthly = json_body(monthly_resp)["results"]
    assert monthly
    assert any(Decimal(item.get("income", "0")) == Decimal("120.00") for item in monthly)

    yearly_resp = api_call("GET", f"/reports/yearly?account_ids={acc2}")
    assert yearly_resp["statusCode"] == 200
    yearly = json_body(yearly_resp)["results"]
    assert yearly
    assert any(Decimal(item.get("net", "0")) == Decimal("120.00") for item in yearly)

    total_resp = api_call("GET", f"/reports/total?account_ids={acc1},{acc2}")
    assert total_resp["statusCode"] == 200
    total = json_body(total_resp)
    assert Decimal(total.get("net", "0")) == Decimal("0")


def test_custom_and_quarterly_reports(api_call, json_body) -> None:
    acc1, acc2 = _create_transfer(api_call, json_body)

    q_resp = api_call("GET", f"/reports/quarterly?account_ids={acc2}")
    assert q_resp["statusCode"] == 200
    q_body = json_body(q_resp)
    assert "results" in q_body

    dr_resp = api_call(
        "GET",
        f"/reports/custom?account_ids={acc2}&start_date=2025-04-01T00:00:00Z&end_date=2025-04-30T00:00:00Z",
    )
    assert dr_resp["statusCode"] == 200
    dr_body = json_body(dr_resp)
    assert "results" in dr_body


def test_net_worth_and_forecasts(api_call, json_body) -> None:
    acc1, acc2 = _create_transfer(api_call, json_body)

    nw_resp = api_call("GET", f"/reports/net-worth?account_ids={acc1},{acc2}")
    assert nw_resp["statusCode"] == 200
    nw_body = json_body(nw_resp)
    assert "points" in nw_body and nw_body["points"]

    cflow_resp = api_call("GET", f"/reports/forecast/cashflow?account_ids={acc2}")
    assert cflow_resp["statusCode"] == 200
    cflow_body = json_body(cflow_resp)
    assert ("forecasts" in cflow_body and cflow_body["forecasts"]) or (
        "points" in cflow_body and cflow_body["points"]
    )

    nwf_resp = api_call("GET", f"/reports/forecast/net-worth?account_ids={acc1},{acc2}")
    assert nwf_resp["statusCode"] == 200
    nwf_body = json_body(nwf_resp)
    assert ("forecasts" in nwf_body and nwf_body["forecasts"]) or (
        "points" in nwf_body and nwf_body["points"]
    )
