from __future__ import annotations

import json
from contextlib import contextmanager

import pytest
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from apps.api.handlers.warmup import warm_database


def _json_body(response: dict) -> dict:
    return json.loads(response["body"])


def test_warm_database_returns_ready(monkeypatch: pytest.MonkeyPatch) -> None:
    called = {"pinged": False}

    class FakeSession:
        def execute(self, _query) -> None:
            called["pinged"] = True

    @contextmanager
    def fake_session_scope():
        yield FakeSession()

    monkeypatch.setattr("apps.api.handlers.warmup.ensure_engine", lambda: None)
    monkeypatch.setattr("apps.api.handlers.warmup.session_scope", fake_session_scope)

    response = warm_database({}, None)

    assert called["pinged"] is True
    assert response["statusCode"] == 200
    assert _json_body(response) == {"status": "ready"}


def test_warm_database_returns_starting_when_operational_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeSession:
        def execute(self, _query) -> None:
            raise OperationalError("SELECT 1", {}, Exception("starting"))

    @contextmanager
    def fake_session_scope():
        yield FakeSession()

    monkeypatch.setattr("apps.api.handlers.warmup.ensure_engine", lambda: None)
    monkeypatch.setattr("apps.api.handlers.warmup.session_scope", fake_session_scope)

    response = warm_database({}, None)

    assert response["statusCode"] == 503
    body = _json_body(response)
    assert body["status"] == "starting"
    assert "Retrying shortly" in body["message"]


def test_warm_database_returns_error_on_sqlalchemy_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class FakeSession:
        def execute(self, _query) -> None:
            raise SQLAlchemyError("boom")

    @contextmanager
    def fake_session_scope():
        yield FakeSession()

    monkeypatch.setattr("apps.api.handlers.warmup.ensure_engine", lambda: None)
    monkeypatch.setattr("apps.api.handlers.warmup.session_scope", fake_session_scope)

    response = warm_database({}, None)

    assert response["statusCode"] == 500
    body = _json_body(response)
    assert body["status"] == "error"
    assert "SQLAlchemyError" in body["message"]
