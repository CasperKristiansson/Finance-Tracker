from __future__ import annotations


def test_get_settings(api_call, json_body) -> None:
    response = api_call("GET", "/settings")
    assert response["statusCode"] == 200
    body = json_body(response)
    assert "settings" in body
    assert set(body.get("settings", {}).keys()) == {"first_name", "last_name"}


def test_update_settings(api_call, json_body) -> None:
    payload = {"settings": {"first_name": "Ada", "last_name": "Lovelace"}}
    response = api_call("PUT", "/settings", payload)
    assert response["statusCode"] == 200
    body = json_body(response)
    assert body.get("settings", {}).get("first_name") == "Ada"
    assert body.get("settings", {}).get("last_name") == "Lovelace"
