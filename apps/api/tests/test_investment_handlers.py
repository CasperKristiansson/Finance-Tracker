from __future__ import annotations

import json
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from apps.api.handlers.investments import (
    investment_overview,
    list_investment_transactions,
    reset_handler_state,
)
from apps.api.shared import configure_engine, get_engine


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_handler_state()
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


def test_list_investment_transactions_empty() -> None:
    response = list_investment_transactions({"queryStringParameters": {}}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["transactions"] == []


def test_investment_overview_empty_state() -> None:
    response = investment_overview({}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["portfolio"]["series"] == []
    assert body["accounts"] == []
