from __future__ import annotations

import json
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select

from apps.api.handlers import get_settings, reset_settings_handler_state, save_settings
from apps.api.models import UserSettings
from apps.api.shared import configure_engine, get_engine, session_scope


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_settings_handler_state()
    configure_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    try:
        yield
    finally:
        SQLModel.metadata.drop_all(engine)


def _json_body(response: dict) -> dict:
    return json.loads(response["body"])


def _event_with_user(user_id: str = "user-123", body: dict | None = None) -> dict:
    event: dict = {
        "requestContext": {"authorizer": {"jwt": {"claims": {"sub": user_id}}}},
    }
    if body is not None:
        event["body"] = json.dumps(body)
        event["isBase64Encoded"] = False
    return event


def test_get_settings_creates_default_record():
    response = get_settings(_event_with_user(), None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["settings"]["theme"] == "system"
    assert body["settings"].get("first_name") is None
    assert body["settings"].get("last_name") is None

    with session_scope(user_id="user-123") as session:
        stored = session.exec(select(UserSettings)).one()
        assert str(stored.theme) == "system"


def test_save_settings_updates_theme():
    save_resp = save_settings(
        _event_with_user(body={"settings": {"theme": "dark", "first_name": "Ada"}}),
        None,
    )
    assert save_resp["statusCode"] == 200
    assert _json_body(save_resp)["settings"]["theme"] == "dark"
    assert _json_body(save_resp)["settings"].get("first_name") == "Ada"

    fetch_resp = get_settings(_event_with_user(), None)
    assert fetch_resp["statusCode"] == 200
    assert _json_body(fetch_resp)["settings"]["theme"] == "dark"


def test_settings_are_scoped_per_user():
    save_settings(_event_with_user("user-a", {"settings": {"theme": "light"}}), None)
    save_settings(_event_with_user("user-b", {"settings": {"theme": "dark"}}), None)

    resp_a = get_settings(_event_with_user("user-a"), None)
    resp_b = get_settings(_event_with_user("user-b"), None)

    assert _json_body(resp_a)["settings"]["theme"] == "light"
    assert _json_body(resp_b)["settings"]["theme"] == "dark"


def test_invalid_theme_returns_400():
    response = save_settings(
        _event_with_user(body={"settings": {"theme": "invalid"}}),
        None,
    )
    assert response["statusCode"] == 400


def test_save_names_and_fetch():
    save_response = save_settings(
        _event_with_user(body={"settings": {"first_name": "Ada", "last_name": "Lovelace"}}),
        None,
    )
    assert save_response["statusCode"] == 200
    saved = _json_body(save_response)["settings"]
    assert saved["first_name"] == "Ada"
    assert saved["last_name"] == "Lovelace"

    fetch_response = get_settings(_event_with_user(), None)
    fetched = _json_body(fetch_response)["settings"]
    assert fetched["first_name"] == "Ada"
    assert fetched["last_name"] == "Lovelace"
