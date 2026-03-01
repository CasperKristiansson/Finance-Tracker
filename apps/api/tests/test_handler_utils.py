from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from typing import Iterator
from uuid import UUID

import pytest

import apps.api.handlers.utils as handler_utils

# pylint: disable=protected-access


@pytest.fixture(autouse=True)
def reset_engine_state() -> Iterator[None]:
    handler_utils.reset_engine_state()
    yield
    handler_utils.reset_engine_state()


def test_json_response_serializes_common_types() -> None:
    payload = {
        "id": UUID(int=7),
        "created_at": datetime(2026, 1, 2, tzinfo=timezone.utc),
        "custom": object(),
    }

    response = handler_utils.json_response(201, payload)

    assert response["statusCode"] == 201
    assert response["headers"]["Content-Type"] == "application/json"
    body = json.loads(response["body"])
    assert body["id"] == str(UUID(int=7))
    assert body["created_at"] == "2026-01-02T00:00:00+00:00"
    assert isinstance(body["custom"], str)


def test_parse_body_handles_none_blank_and_bytes() -> None:
    assert handler_utils.parse_body({}) == {}
    assert handler_utils.parse_body({"body": "   "}) == {}
    assert handler_utils.parse_body({"body": b'{"ok": true}'}) == {"ok": True}


def test_parse_body_handles_base64_input() -> None:
    encoded = base64.b64encode(b'{"name":"alice"}').decode("utf-8")
    event = {"body": encoded, "isBase64Encoded": True}

    assert handler_utils.parse_body(event) == {"name": "alice"}


def test_get_query_params_returns_empty_dict_when_missing() -> None:
    assert handler_utils.get_query_params({}) == {}
    assert handler_utils.get_query_params({"queryStringParameters": {"a": "1"}}) == {"a": "1"}


def test_get_user_id_prefers_username_claim(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(handler_utils, "get_default_user_id", lambda: "default-user")
    event = {
        "requestContext": {
            "authorizer": {"jwt": {"claims": {"username": "alice", "sub": "fallback-sub"}}}
        }
    }
    assert handler_utils.get_user_id(event) == "alice"


def test_get_user_id_falls_back_to_cognito_or_sub(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(handler_utils, "get_default_user_id", lambda: "default-user")
    cognito_event = {"requestContext": {"authorizer": {"claims": {"cognito:username": "bob"}}}}
    sub_event = {"requestContext": {"authorizer": {"claims": {"sub": "sub-123"}}}}
    missing_event: dict[str, object] = {"requestContext": {"authorizer": {"claims": {}}}}

    assert handler_utils.get_user_id(cognito_event) == "bob"
    assert handler_utils.get_user_id(sub_event) == "sub-123"
    assert handler_utils.get_user_id(missing_event) == "default-user"


def test_get_user_id_falls_back_when_claims_not_dict(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(handler_utils, "get_default_user_id", lambda: "default-user")
    event = {"requestContext": {"authorizer": {"jwt": {"claims": "invalid"}}}}
    assert handler_utils.get_user_id(event) == "default-user"


def test_extract_path_uuid_prefers_path_parameters() -> None:
    expected = UUID(int=3)
    event = {"pathParameters": {"transaction_id": str(expected)}}

    assert handler_utils.extract_path_uuid(event, param_names=("transaction_id", "id")) == expected


def test_extract_path_uuid_falls_back_to_raw_path_and_handles_invalid() -> None:
    expected = UUID(int=9)
    event = {"rawPath": f"/v1/transactions/{expected}"}
    invalid = {"rawPath": "/v1/transactions/not-a-uuid"}

    assert handler_utils.extract_path_uuid(event, param_names=("id",)) == expected
    assert handler_utils.extract_path_uuid(invalid, param_names=("id",)) is None
    assert handler_utils.extract_path_uuid({}, param_names=("id",)) is None


def test_read_connect_timeout_env_parsing(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DB_CONNECT_TIMEOUT_SECONDS", raising=False)
    assert handler_utils._read_connect_timeout() == 10

    monkeypatch.setenv("DB_CONNECT_TIMEOUT_SECONDS", "2")
    assert handler_utils._read_connect_timeout() == 3

    monkeypatch.setenv("DB_CONNECT_TIMEOUT_SECONDS", "17")
    assert handler_utils._read_connect_timeout() == 17

    monkeypatch.setenv("DB_CONNECT_TIMEOUT_SECONDS", "invalid")
    assert handler_utils._read_connect_timeout() == 10


def test_ensure_engine_returns_when_already_initialized(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(handler_utils, "_ENGINE_INITIALIZED", True)
    monkeypatch.setattr(
        handler_utils, "get_engine", lambda: (_ for _ in ()).throw(AssertionError())
    )

    handler_utils.ensure_engine()


def test_ensure_engine_marks_initialized_when_engine_exists(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    called = {"configure": 0, "configure_env": 0}

    def fake_get_engine() -> object:
        return object()

    monkeypatch.setattr(handler_utils, "get_engine", fake_get_engine)
    monkeypatch.setattr(
        handler_utils,
        "configure_engine",
        lambda *args, **kwargs: called.__setitem__("configure", called["configure"] + 1),
    )
    monkeypatch.setattr(
        handler_utils,
        "configure_engine_from_env",
        lambda **kwargs: called.__setitem__("configure_env", called["configure_env"] + 1),
    )

    handler_utils.ensure_engine()

    assert handler_utils._ENGINE_INITIALIZED is True
    assert called["configure"] == 0
    assert called["configure_env"] == 0


def test_ensure_engine_configures_sqlite_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    monkeypatch.setenv("DB_CONNECT_TIMEOUT_SECONDS", "30")
    monkeypatch.setattr(handler_utils, "get_engine", lambda: (_ for _ in ()).throw(RuntimeError()))
    captured: dict[str, object] = {}

    def fake_configure_engine(url: str, **kwargs) -> None:
        captured["url"] = url
        captured["kwargs"] = kwargs

    monkeypatch.setattr(handler_utils, "configure_engine", fake_configure_engine)
    monkeypatch.setattr(
        handler_utils,
        "configure_engine_from_env",
        lambda **kwargs: (_ for _ in ()).throw(AssertionError()),
    )

    handler_utils.ensure_engine()

    assert captured["url"] == "sqlite://"
    kwargs = captured["kwargs"]
    assert kwargs == {
        "connect_args": {"check_same_thread": False},
        "poolclass": handler_utils.StaticPool,
    }


def test_ensure_engine_configures_postgres_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://db")
    monkeypatch.setenv("DB_CONNECT_TIMEOUT_SECONDS", "1")
    monkeypatch.setattr(handler_utils, "get_engine", lambda: (_ for _ in ()).throw(RuntimeError()))
    captured: dict[str, object] = {}

    def fake_configure_engine(url: str, **kwargs) -> None:
        captured["url"] = url
        captured["kwargs"] = kwargs

    monkeypatch.setattr(handler_utils, "configure_engine", fake_configure_engine)

    handler_utils.ensure_engine()

    assert captured["url"] == "postgresql://db"
    assert captured["kwargs"] == {"connect_args": {"connect_timeout": 3}}


def test_ensure_engine_configures_from_env_without_database_url(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("DB_CONNECT_TIMEOUT_SECONDS", "12")
    monkeypatch.setattr(handler_utils, "get_engine", lambda: (_ for _ in ()).throw(RuntimeError()))
    captured: dict[str, object] = {}

    def fake_configure_engine_from_env(**kwargs) -> object:
        captured["kwargs"] = kwargs
        return object()

    monkeypatch.setattr(
        handler_utils,
        "configure_engine",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError()),
    )
    monkeypatch.setattr(handler_utils, "configure_engine_from_env", fake_configure_engine_from_env)

    handler_utils.ensure_engine()

    assert captured["kwargs"] == {"connect_args": {"connect_timeout": 12}}
