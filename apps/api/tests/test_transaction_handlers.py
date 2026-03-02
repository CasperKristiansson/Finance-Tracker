from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterator
from uuid import UUID

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, select

from apps.api.handlers import (
    create_transaction,
    delete_transaction,
    list_transactions,
    reset_transaction_handler_state,
)
from apps.api.handlers import transactions as tx_handlers
from apps.api.handlers import (
    update_transaction,
)
from apps.api.models import Account, Loan, LoanEvent
from apps.api.shared import (
    AccountType,
    InterestCompound,
    configure_engine,
    get_default_user_id,
    get_engine,
    scope_session_to_user,
)


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_transaction_handler_state()
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


def _create_account(session: Session, account_type: AccountType = AccountType.NORMAL) -> Account:
    account = Account(name="Test Account", account_type=account_type)
    session.add(account)
    session.commit()
    session.refresh(account)
    session.expunge(account)
    return account


def test_create_and_list_transactions():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        source = _create_account(session)
        destination = _create_account(session)
        source_id = source.id
        destination_id = destination.id

    occurred = datetime(2024, 1, 1, tzinfo=timezone.utc)
    payload = {
        "occurred_at": occurred.isoformat(),
        "posted_at": occurred.isoformat(),
        "legs": [
            {"account_id": str(source_id), "amount": "-50.00"},
            {"account_id": str(destination_id), "amount": "50.00"},
        ],
    }

    create_response = create_transaction(
        {"body": json.dumps(payload), "isBase64Encoded": False},
        None,
    )
    assert create_response["statusCode"] == 201
    created = _json_body(create_response)
    transaction_id = created["id"]
    assert len(created["legs"]) == 2

    list_response = list_transactions({"queryStringParameters": None}, None)
    assert list_response["statusCode"] == 200
    body = _json_body(list_response)
    transactions = body["transactions"]
    assert any(item["id"] == transaction_id for item in transactions)
    assert body.get("running_balances") is None

    with_balances = list_transactions(
        {"queryStringParameters": {"include_running_balances": "true"}},
        None,
    )
    assert with_balances["statusCode"] == 200
    with_balances_body = _json_body(with_balances)
    assert isinstance(with_balances_body.get("running_balances"), dict)


def test_create_transaction_validation_error():
    occurred = datetime(2024, 1, 1, tzinfo=timezone.utc)
    payload = {
        "occurred_at": occurred.isoformat(),
        "legs": [
            {"account_id": str(UUID(int=2)), "amount": "10"},
        ],
    }

    response = create_transaction(
        {"body": json.dumps(payload), "isBase64Encoded": False},
        None,
    )
    assert response["statusCode"] == 400


def test_list_transactions_with_filters():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        source = _create_account(session)
        destination = _create_account(session)
        source_id = source.id
        destination_id = destination.id

        occurred = datetime(2024, 1, 10, tzinfo=timezone.utc)
        payload = {
            "occurred_at": occurred.isoformat(),
            "legs": [
                {"account_id": str(source_id), "amount": "-25"},
                {"account_id": str(destination_id), "amount": "25"},
            ],
        }
        create_transaction({"body": json.dumps(payload), "isBase64Encoded": False}, None)

    query = {
        "queryStringParameters": {
            "account_ids": str(source_id),
            "start_date": "2024-01-01T00:00:00+00:00",
            "end_date": "2024-12-31T00:00:00+00:00",
        }
    }
    response = list_transactions(query, None)
    assert response["statusCode"] == 200
    transactions = _json_body(response)["transactions"]
    assert len(transactions) == 1


def test_list_transactions_respects_limit():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        source = _create_account(session)
        destination = _create_account(session)
        source_id = source.id
        destination_id = destination.id

        for _ in range(3):
            occurred = datetime(2024, 1, 10, tzinfo=timezone.utc)
            payload = {
                "occurred_at": occurred.isoformat(),
                "legs": [
                    {"account_id": str(source_id), "amount": "-25"},
                    {"account_id": str(destination_id), "amount": "25"},
                ],
            }
            create_transaction(
                {"body": json.dumps(payload), "isBase64Encoded": False},
                None,
            )

    query = {
        "queryStringParameters": {
            "limit": "2",
        }
    }
    response = list_transactions(query, None)
    assert response["statusCode"] == 200
    transactions = _json_body(response)["transactions"]
    assert len(transactions) == 2


def test_create_transaction_generates_loan_event():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        debt_account = _create_account(session, AccountType.DEBT)
        funding_account = _create_account(session)
        debt_account_id = debt_account.id
        funding_account_id = funding_account.id
        loan = Loan(
            account_id=debt_account_id,
            origin_principal=Decimal("1000"),
            current_principal=Decimal("1000"),
            interest_rate_annual=Decimal("0.05"),
            interest_compound=InterestCompound.MONTHLY,
        )
        session.add(loan)
        session.commit()

    occurred = datetime(2024, 2, 1, tzinfo=timezone.utc)
    payload = {
        "occurred_at": occurred.isoformat(),
        "legs": [
            {"account_id": str(funding_account_id), "amount": "-100.00"},
            {"account_id": str(debt_account_id), "amount": "100.00"},
        ],
    }

    response = create_transaction(
        {"body": json.dumps(payload), "isBase64Encoded": False},
        None,
    )
    assert response["statusCode"] == 201

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        events = session.exec(select(LoanEvent)).all()
        assert len(events) == 1
        assert events[0].event_type == "disbursement"


def test_update_and_delete_transaction():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        source = _create_account(session)
        destination = _create_account(session)
        source_id = source.id
        destination_id = destination.id

    occurred = datetime(2024, 1, 1, tzinfo=timezone.utc)
    payload = {
        "occurred_at": occurred.isoformat(),
        "posted_at": occurred.isoformat(),
        "legs": [
            {"account_id": str(source_id), "amount": "-50.00"},
            {"account_id": str(destination_id), "amount": "50.00"},
        ],
    }
    create_response = create_transaction(
        {"body": json.dumps(payload), "isBase64Encoded": False},
        None,
    )
    created = _json_body(create_response)
    transaction_id = created["id"]

    update_payload = {
        "description": "Updated",
    }
    update_response = update_transaction(
        {
            "body": json.dumps(update_payload),
            "isBase64Encoded": False,
            "pathParameters": {"transaction_id": transaction_id},
        },
        None,
    )
    assert update_response["statusCode"] == 200
    updated = _json_body(update_response)
    assert updated["description"] == "Updated"

    delete_response = delete_transaction(
        {"pathParameters": {"transaction_id": transaction_id}},
        None,
    )
    assert delete_response["statusCode"] == 204

    list_response = list_transactions({"queryStringParameters": None}, None)
    transactions = _json_body(list_response)["transactions"]
    assert all(item["id"] != transaction_id for item in transactions)


def test_transaction_handler_error_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    list_invalid = list_transactions({"queryStringParameters": {"limit": "x"}}, None)
    assert list_invalid["statusCode"] == 400

    with Session(get_engine()) as session:
        scope_session_to_user(session, get_default_user_id())
        source = _create_account(session)
        destination = _create_account(session)
        source_id = source.id
        destination_id = destination.id

    value_error_create = create_transaction(
        {
            "body": json.dumps(
                {
                    "occurred_at": "2024-01-01T00:00:00+00:00",
                    "posted_at": "2024-01-01T00:00:00+00:00",
                    "legs": [
                        {"account_id": str(source_id), "amount": "10"},
                        {"account_id": str(destination_id), "amount": "10"},
                    ],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert value_error_create["statusCode"] == 400

    missing_path_update = update_transaction(
        {"body": json.dumps({"description": "x"}), "isBase64Encoded": False, "pathParameters": {}},
        None,
    )
    assert missing_path_update["statusCode"] == 400

    invalid_payload_update = update_transaction(
        {
            "body": json.dumps({"occurred_at": "not-date"}),
            "isBase64Encoded": False,
            "pathParameters": {"transaction_id": str(UUID(int=1))},
        },
        None,
    )
    assert invalid_payload_update["statusCode"] == 400

    not_found_update = update_transaction(
        {
            "body": json.dumps({"description": "x"}),
            "isBase64Encoded": False,
            "pathParameters": {"transaction_id": str(UUID(int=1))},
        },
        None,
    )
    assert not_found_update["statusCode"] == 404

    not_found_delete = delete_transaction(
        {"pathParameters": {"transaction_id": str(UUID(int=999))}},
        None,
    )
    assert not_found_delete["statusCode"] == 404

    class _ServiceUpdateValueError:
        def __init__(self, _session) -> None:
            pass

        def update_transaction(self, _transaction_id, **_updates):
            raise ValueError("bad update")

        def delete_transaction(self, _transaction_id):
            raise LookupError("missing")

    monkeypatch.setattr(tx_handlers, "TransactionService", _ServiceUpdateValueError)
    value_error_update = update_transaction(
        {
            "body": json.dumps({"description": "x"}),
            "isBase64Encoded": False,
            "pathParameters": {"transaction_id": str(UUID(int=2))},
        },
        None,
    )
    assert value_error_update["statusCode"] == 400

    missing_path_delete = delete_transaction({"pathParameters": {}}, None)
    assert missing_path_delete["statusCode"] == 400
