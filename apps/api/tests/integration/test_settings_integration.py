from __future__ import annotations


def test_get_settings(api_call, json_body) -> None:
    response = api_call("GET", "/settings")
    assert response["statusCode"] == 200
    body = json_body(response)
    assert body.get("settings", {}).get("theme") in {"system", "light", "dark"}


def test_update_settings(api_call, json_body) -> None:
    payload = {"settings": {"theme": "dark"}}
    response = api_call("PUT", "/settings", payload)
    assert response["statusCode"] == 200
    body = json_body(response)
    assert body.get("settings", {}).get("theme") == "dark"
