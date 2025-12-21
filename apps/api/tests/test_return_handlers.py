from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from apps.api.handlers import (
    create_transaction,
    list_returns,
    reset_transaction_handler_state,
    update_return,
)
from apps.api.models import Account
from apps.api.shared import AccountType, ReturnStatus, get_default_user_id, scope_session_to_user
from apps.api.shared.session import configure_engine, get_engine


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch):
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


def _create_account(session: Session, *, name: str) -> Account:
    account = Account(name=name, account_type=AccountType.NORMAL)
    session.add(account)
    session.commit()
    session.refresh(account)
    session.expunge(account)
    return account


def _json_body(response: dict) -> dict:
    return json.loads(response["body"])


def _build_transaction_payload(source_id: UUID, dest_id: UUID, amount: str = "50.00") -> dict:
    occurred = datetime(2024, 5, 1, tzinfo=timezone.utc)
    return {
        "occurred_at": occurred.isoformat(),
        "posted_at": occurred.isoformat(),
        "legs": [
            {"account_id": str(source_id), "amount": f"-{amount}"},
            {"account_id": str(dest_id), "amount": amount},
        ],
    }


def test_list_returns_includes_parent_metadata():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        source = _create_account(session, name="Source")
        dest = _create_account(session, name="Destination")
        source_id, dest_id = source.id, dest.id

    parent_response = create_transaction(
        {
            "body": json.dumps(_build_transaction_payload(source_id, dest_id)),
            "isBase64Encoded": False,
        },
        None,
    )
    parent_id = _json_body(parent_response)["id"]

    return_payload = _build_transaction_payload(dest_id, source_id)
    return_payload.update({"transaction_type": "return", "return_parent_id": parent_id})
    create_transaction(
        {"body": json.dumps(return_payload), "isBase64Encoded": False},
        None,
    )

    response = list_returns({"queryStringParameters": None}, None)
    body = _json_body(response)

    assert response["statusCode"] == 200
    assert len(body["returns"]) == 1
    row = body["returns"][0]
    assert row["parent_id"] == parent_id
    assert row["return_status"] == ReturnStatus.PENDING.value
    assert row["accounts"] == ["Destination", "Source"]


def test_update_return_marks_processed_and_detach():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        source = _create_account(session, name="Source")
        dest = _create_account(session, name="Destination")
        source_id, dest_id = source.id, dest.id

    parent_response = create_transaction(
        {
            "body": json.dumps(_build_transaction_payload(source_id, dest_id)),
            "isBase64Encoded": False,
        },
        None,
    )
    parent_id = _json_body(parent_response)["id"]

    return_payload = _build_transaction_payload(dest_id, source_id, amount="50.00")
    return_payload.update({"transaction_type": "return", "return_parent_id": parent_id})
    return_response = create_transaction(
        {"body": json.dumps(return_payload), "isBase64Encoded": False},
        None,
    )
    return_id = _json_body(return_response)["id"]

    mark_response = update_return(
        {
            "body": json.dumps({"transaction_id": return_id, "action": "mark_processed"}),
            "isBase64Encoded": False,
        },
        None,
    )
    mark_body = _json_body(mark_response)
    assert mark_response["statusCode"] == 200
    assert mark_body["return_status"] == ReturnStatus.PROCESSED.value

    detach_response = update_return(
        {
            "body": json.dumps({"transaction_id": return_id, "action": "detach"}),
            "isBase64Encoded": False,
        },
        None,
    )
    assert detach_response["statusCode"] == 200

    list_after_detach = list_returns({"queryStringParameters": None}, None)
    assert _json_body(list_after_detach)["returns"] == []
