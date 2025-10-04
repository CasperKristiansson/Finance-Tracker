from __future__ import annotations

import json
from typing import Iterator
from uuid import UUID

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from apps.api.handlers import (
    create_account,
    list_accounts,
    reset_account_handler_state,
    update_account,
)
from apps.api.shared import configure_engine, get_engine


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_account_handler_state()
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


def _json_body(response) -> dict:
    return json.loads(response["body"])


def test_list_accounts_empty():
    event = {"queryStringParameters": None}
    response = list_accounts(event, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body == {"accounts": []}


def test_create_and_list_account():
    create_event = {
        "body": json.dumps(
            {
                "account_type": "normal",
                "is_active": True,
            }
        ),
        "isBase64Encoded": False,
    }
    created_response = create_account(create_event, None)
    assert created_response["statusCode"] == 201
    created_body = _json_body(created_response)
    account_id = UUID(created_body["id"])

    list_response = list_accounts({"queryStringParameters": None}, None)
    assert list_response["statusCode"] == 200
    accounts = _json_body(list_response)["accounts"]
    assert len(accounts) == 1
    assert accounts[0]["id"] == str(account_id)


def test_create_debt_account_requires_loan():
    event = {
        "body": json.dumps({"account_type": "debt"}),
        "isBase64Encoded": False,
    }
    response = create_account(event, None)
    assert response["statusCode"] == 400
    body = _json_body(response)
    assert "Loan details are required" in body["error"][0]["msg"]


def test_update_account_flow():
    create_event = {
        "body": json.dumps({"account_type": "normal"}),
        "isBase64Encoded": False,
    }
    created_response = create_account(create_event, None)
    account_id = _json_body(created_response)["id"]

    update_event = {
        "body": json.dumps({"is_active": False}),
        "isBase64Encoded": False,
        "pathParameters": {"account_id": account_id},
    }
    updated_response = update_account(update_event, None)
    assert updated_response["statusCode"] == 200
    updated_body = _json_body(updated_response)
    assert updated_body["is_active"] is False

    list_response = list_accounts({"queryStringParameters": {"include_inactive": "true"}}, None)
    accounts = _json_body(list_response)["accounts"]
    assert any(account["id"] == account_id and account["is_active"] is False for account in accounts)


def test_update_account_not_found():
    event = {
        "body": json.dumps({"is_active": True}),
        "isBase64Encoded": False,
        "pathParameters": {"account_id": str(UUID(int=1))},
    }
    response = update_account(event, None)
    assert response["statusCode"] == 404
    assert _json_body(response)["error"] == "Account not found"
