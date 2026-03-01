from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Iterator
from uuid import UUID

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, select

from apps.api.handlers import (
    create_category,
    list_categories,
    merge_categories,
    reset_category_handler_state,
    update_category,
)
from apps.api.models import Account, Category, Transaction, TransactionLeg
from apps.api.shared import (
    AccountType,
    TransactionType,
    configure_engine,
    get_engine,
    session_scope,
)


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_category_handler_state()
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


def test_list_categories_empty():
    response = list_categories({"queryStringParameters": None}, None)
    assert response["statusCode"] == 200
    assert _json_body(response) == {"categories": []}


def test_create_category_and_list():
    event = {
        "body": json.dumps(
            {
                "name": "Groceries",
                "category_type": "expense",
                "color_hex": "#00ff00",
                "icon": "🛒",
            }
        ),
        "isBase64Encoded": False,
    }
    create_response = create_category(event, None)
    assert create_response["statusCode"] == 201
    created = _json_body(create_response)
    category_id = UUID(created["id"])

    list_response = list_categories({"queryStringParameters": None}, None)
    categories = _json_body(list_response)["categories"]
    assert any(item["id"] == str(category_id) for item in categories)


def test_update_category():
    create_response = create_category(
        {
            "body": json.dumps({"name": "Bills", "category_type": "expense"}),
            "isBase64Encoded": False,
        },
        None,
    )
    category_id = _json_body(create_response)["id"]

    update_response = update_category(
        {
            "body": json.dumps({"name": "Utilities", "is_archived": True, "icon": "💡"}),
            "isBase64Encoded": False,
            "pathParameters": {"category_id": category_id},
        },
        None,
    )
    assert update_response["statusCode"] == 200
    updated = _json_body(update_response)
    assert updated["name"] == "Utilities"
    assert updated["is_archived"] is True
    assert updated["icon"] == "💡"


def test_update_category_icon_only():
    create_response = create_category(
        {
            "body": json.dumps({"name": "Travel", "category_type": "expense"}),
            "isBase64Encoded": False,
        },
        None,
    )
    category_id = _json_body(create_response)["id"]

    update_response = update_category(
        {
            "body": json.dumps({"icon": "✈️"}),
            "isBase64Encoded": False,
            "pathParameters": {"category_id": category_id},
        },
        None,
    )
    assert update_response["statusCode"] == 200
    updated = _json_body(update_response)
    assert updated["icon"] == "✈️"


def test_create_category_validation_error():
    response = create_category({"body": json.dumps({}), "isBase64Encoded": False}, None)
    assert response["statusCode"] == 400


def test_update_category_not_found():
    response = update_category(
        {
            "body": json.dumps({"name": "New"}),
            "isBase64Encoded": False,
            "pathParameters": {"category_id": str(UUID(int=1))},
        },
        None,
    )
    assert response["statusCode"] == 404


def test_merge_categories_moves_transactions():
    # Create source and target categories
    src_resp = create_category(
        {
            "body": json.dumps({"name": "Old", "category_type": "expense"}),
            "isBase64Encoded": False,
        },
        None,
    )
    tgt_resp = create_category(
        {
            "body": json.dumps({"name": "New", "category_type": "expense"}),
            "isBase64Encoded": False,
        },
        None,
    )
    source_id = UUID(_json_body(src_resp)["id"])
    target_id = UUID(_json_body(tgt_resp)["id"])

    with session_scope() as session:
        account = Account(account_type=AccountType.NORMAL, is_active=True)
        session.add(account)
        session.commit()
        session.refresh(account)

        txn = Transaction(
            category_id=source_id,
            transaction_type=TransactionType.EXPENSE,
            description="Coffee",
            occurred_at=datetime.now(timezone.utc),
            posted_at=datetime.now(timezone.utc),
        )
        txn.legs = [
            TransactionLeg(account_id=account.id, amount=-50),
        ]
        session.add(txn)
        session.flush()
        txn_id = txn.id
        session.commit()

    merge_response = merge_categories(
        {
            "body": json.dumps(
                {
                    "source_category_id": str(source_id),
                    "target_category_id": str(target_id),
                    "rename_target_to": "Consolidated",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert merge_response["statusCode"] == 200

    with session_scope() as session:
        moved_txn = session.get(Transaction, txn_id)
        assert moved_txn is not None
        assert moved_txn.category_id == target_id

        source = session.get(Category, source_id)
        target = session.get(Category, target_id)
        assert source is not None and source.is_archived
        assert target is not None and target.name == "Consolidated"
