from __future__ import annotations

import json
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from apps.api.handlers.investments import (
    investment_metrics,
    investment_overview,
    list_investment_transactions,
    reset_handler_state,
    sync_investment_ledger,
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


def test_investment_metrics_without_snapshots() -> None:
    response = investment_metrics({"queryStringParameters": {}}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    performance = body["performance"]
    assert performance["total_value"] in ("0", 0, 0.0)
    assert body["holdings"] == []
    assert body["snapshots"] == []
    assert body["transactions"] == []


def test_list_investment_transactions_empty() -> None:
    response = list_investment_transactions({"queryStringParameters": {}}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["transactions"] == []


def test_sync_investment_ledger_no_transactions() -> None:
    response = sync_investment_ledger({"body": json.dumps({})}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["synced"] == 0


def test_investment_overview_empty_state() -> None:
    response = investment_overview({}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["portfolio"]["series"] == []
    assert body["accounts"] == []
