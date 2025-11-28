from __future__ import annotations

from uuid import UUID, uuid4


def _sample_raw_text() -> str:
    return "\n".join(
        [
            "Portföljrapport",
            "2025-05-01",
            "Innehav",
            "Test Fund A",
            "100 SEK",
            "10",
            "5",
            "500 SEK",
            "Resultat",
            "Marknadsvärde 500",
        ]
    )


def test_parse_nordnet_export(api_call, json_body) -> None:
    payload = {"raw_text": _sample_raw_text()}
    resp = api_call("POST", "/investments/nordnet/parse", payload)
    assert resp["statusCode"] == 200
    body = json_body(resp)
    assert "parsed_payload" in body
    assert body["parsed_payload"]


def test_create_and_list_snapshots(api_call, json_body) -> None:
    create_payload = {
        "raw_text": _sample_raw_text(),
        "account_name": f"Acct-{uuid4().hex[:6]}",
        "use_bedrock": False,
    }
    create_resp = api_call("POST", "/investments/nordnet/snapshots", create_payload)
    assert create_resp["statusCode"] == 201
    snapshot = json_body(create_resp)["snapshot"]
    snap_id = snapshot["id"]
    assert snapshot["provider"] == "nordnet"

    list_resp = api_call("GET", "/investments/nordnet/snapshots")
    assert list_resp["statusCode"] == 200
    snaps = json_body(list_resp)["snapshots"]
    assert any(UUID(item["id"]) == UUID(snap_id) for item in snaps)


def test_list_investment_transactions(api_call, json_body) -> None:
    resp = api_call("GET", "/investments/transactions")
    assert resp["statusCode"] == 200
    body = json_body(resp)
    assert "transactions" in body


def test_investment_metrics(api_call, json_body) -> None:
    # Ensure at least one snapshot exists
    api_call(
        "POST",
        "/investments/nordnet/snapshots",
        {
            "raw_text": _sample_raw_text(),
            "account_name": f"Metrics-{uuid4().hex[:6]}",
            "use_bedrock": False,
        },
    )
    resp = api_call("GET", "/investments/metrics")
    assert resp["statusCode"] == 200
    body = json_body(resp)
    assert "performance" in body
    assert "holdings" in body
    assert "snapshots" in body


def test_sync_investment_ledger(api_call, json_body) -> None:
    resp = api_call("POST", "/investments/sync-ledger", {})
    assert resp["statusCode"] == 200
    body = json_body(resp)
    assert "synced" in body
