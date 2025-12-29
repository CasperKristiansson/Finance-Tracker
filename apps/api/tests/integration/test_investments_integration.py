from __future__ import annotations


def test_list_investment_transactions(api_call, json_body) -> None:
    resp = api_call("GET", "/investments/transactions")
    assert resp["statusCode"] == 200
    body = json_body(resp)
    assert "transactions" in body


def test_investment_overview(api_call, json_body) -> None:
    resp = api_call("GET", "/investments/overview")
    assert resp["statusCode"] == 200
    body = json_body(resp)
    assert "portfolio" in body
