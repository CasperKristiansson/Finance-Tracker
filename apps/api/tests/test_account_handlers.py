from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterator
from uuid import UUID

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from apps.api.handlers import (
    create_account,
    list_accounts,
    reset_account_handler_state,
    update_account,
)
from apps.api.models import Account, Transaction, TransactionLeg
from apps.api.services import TransactionService
from apps.api.shared import (
    AccountType,
    TransactionType,
    configure_engine,
    get_default_user_id,
    get_engine,
    scope_session_to_user,
)


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
                "bank_import_type": "seb",
            }
        ),
        "isBase64Encoded": False,
    }
    created_response = create_account(create_event, None)
    assert created_response["statusCode"] == 201
    created_body = _json_body(created_response)
    account_id = UUID(created_body["id"])
    assert created_body["bank_import_type"] == "seb"

    list_response = list_accounts({"queryStringParameters": None}, None)
    assert list_response["statusCode"] == 200
    accounts = _json_body(list_response)["accounts"]
    assert len(accounts) == 1
    assert accounts[0]["id"] == str(account_id)
    assert accounts[0]["bank_import_type"] == "seb"


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
        "body": json.dumps({"is_active": False, "bank_import_type": "swedbank"}),
        "isBase64Encoded": False,
        "pathParameters": {"account_id": account_id},
    }
    updated_response = update_account(update_event, None)
    assert updated_response["statusCode"] == 200
    updated_body = _json_body(updated_response)
    assert updated_body["is_active"] is False
    assert updated_body["bank_import_type"] == "swedbank"

    list_response = list_accounts({"queryStringParameters": {"include_inactive": "true"}}, None)
    accounts = _json_body(list_response)["accounts"]
    assert any(
        account["id"] == account_id
        and account["is_active"] is False
        and account["bank_import_type"] == "swedbank"
        for account in accounts
    )

    clear_event = {
        "body": json.dumps({"bank_import_type": None}),
        "isBase64Encoded": False,
        "pathParameters": {"account_id": account_id},
    }
    cleared_response = update_account(clear_event, None)
    assert cleared_response["statusCode"] == 200
    cleared_body = _json_body(cleared_response)
    assert cleared_body["bank_import_type"] is None


def test_update_account_not_found():
    event = {
        "body": json.dumps({"is_active": True}),
        "isBase64Encoded": False,
        "pathParameters": {"account_id": str(UUID(int=1))},
    }
    response = update_account(event, None)
    assert response["statusCode"] == 404
    assert _json_body(response)["error"] == "Account not found"


def test_list_accounts_respects_as_of_date():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = Account(account_type=AccountType.NORMAL)
        offset = Account(account_type=AccountType.NORMAL)
        session.add_all([tracked, offset])
        session.commit()
        session.refresh(tracked)
        session.refresh(offset)
        tracked_id = tracked.id

        service = TransactionService(session)

        jan_tx = Transaction(
            transaction_type=TransactionType.TRANSFER,
            occurred_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
            posted_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
        )
        jan_legs = [
            TransactionLeg(account_id=tracked.id, amount=Decimal("100")),
            TransactionLeg(account_id=offset.id, amount=Decimal("-100")),
        ]
        service.create_transaction(jan_tx, jan_legs)

        feb_tx = Transaction(
            transaction_type=TransactionType.TRANSFER,
            occurred_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
            posted_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
        )
        feb_legs = [
            TransactionLeg(account_id=tracked.id, amount=Decimal("25")),
            TransactionLeg(account_id=offset.id, amount=Decimal("-25")),
        ]
        service.create_transaction(feb_tx, feb_legs)

    response = list_accounts(
        {"queryStringParameters": {"as_of_date": "2024-01-31T00:00:00+00:00"}},
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    tracked_entry = next(acc for acc in body["accounts"] if acc["id"] == str(tracked_id))
    assert Decimal(tracked_entry["balance"]) == Decimal("100")
