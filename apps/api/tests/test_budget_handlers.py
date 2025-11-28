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
    create_budget,
    delete_budget,
    list_budget_progress,
    list_budgets,
    reset_budget_handler_state,
    update_budget,
)
from apps.api.models import Account, Category, Transaction, TransactionLeg
from apps.api.shared import (
    AccountType,
    CategoryType,
    TransactionType,
    configure_engine,
    get_engine,
)


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_budget_handler_state()
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
        engine.dispose()
        SQLModel.metadata.drop_all(engine)


def _json_body(response) -> dict:
    return json.loads(response["body"])


def _create_category(name: str = "Groceries") -> Category:
    engine = get_engine()
    with Session(engine) as session:
        category = Category(name=name, category_type=CategoryType.EXPENSE)
        session.add(category)
        session.commit()
        session.refresh(category)
        return category


def _seed_transaction(category_id: UUID, amount: Decimal) -> None:
    engine = get_engine()
    with Session(engine) as session:
        account = Account(account_type=AccountType.NORMAL)
        session.add(account)
        session.flush()

        occurred = datetime.now(timezone.utc)
        txn = Transaction(
            category_id=category_id,
            transaction_type=TransactionType.EXPENSE if amount < 0 else TransactionType.INCOME,
            occurred_at=occurred,
            posted_at=occurred,
            description="Seed",
        )
        session.add(txn)
        session.flush()

        leg_primary = TransactionLeg(
            transaction_id=txn.id,
            account_id=account.id,
            amount=amount,
        )
        leg_balance = TransactionLeg(
            transaction_id=txn.id,
            account_id=account.id,
            amount=-amount,
        )
        session.add(leg_primary)
        session.add(leg_balance)
        session.commit()


def test_list_budgets_empty():
    response = list_budgets({"queryStringParameters": None}, None)
    assert response["statusCode"] == 200
    assert _json_body(response) == {"budgets": []}


def test_create_budget_and_list():
    category = _create_category()
    event = {
        "body": json.dumps(
            {
                "category_id": str(category.id),
                "period": "monthly",
                "amount": "500.00",
                "note": "Food and essentials",
            }
        ),
        "isBase64Encoded": False,
    }
    create_response = create_budget(event, None)
    assert create_response["statusCode"] == 201
    created = _json_body(create_response)
    assert created["category_id"] == str(category.id)
    assert created["period"] == "monthly"
    assert created["amount"] == "500.00"

    list_response = list_budgets({"queryStringParameters": None}, None)
    budgets = _json_body(list_response)["budgets"]
    assert len(budgets) == 1
    assert budgets[0]["id"] == created["id"]


def test_update_budget():
    category = _create_category()
    create_response = create_budget(
        {
            "body": json.dumps(
                {
                    "category_id": str(category.id),
                    "period": "monthly",
                    "amount": "250.00",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    budget_id = _json_body(create_response)["id"]

    update_response = update_budget(
        {
            "body": json.dumps({"amount": "275.50", "note": "adjusted"}),
            "isBase64Encoded": False,
            "pathParameters": {"budget_id": budget_id},
        },
        None,
    )
    assert update_response["statusCode"] == 200
    updated = _json_body(update_response)
    assert updated["amount"] == "275.50"
    assert updated["note"] == "adjusted"


def test_create_budget_validation_error():
    response = create_budget({"body": json.dumps({}), "isBase64Encoded": False}, None)
    assert response["statusCode"] == 400


def test_create_budget_missing_category():
    response = create_budget(
        {
            "body": json.dumps(
                {
                    "category_id": str(UUID(int=1)),
                    "period": "monthly",
                    "amount": "100.00",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 404
    assert "Category not found" in _json_body(response)["error"]


def test_create_budget_duplicate_constraint():
    category = _create_category()
    payload = {
        "category_id": str(category.id),
        "period": "monthly",
        "amount": "300.00",
    }
    first = create_budget(
        {"body": json.dumps(payload), "isBase64Encoded": False},
        None,
    )
    assert first["statusCode"] == 201

    duplicate = create_budget(
        {"body": json.dumps(payload), "isBase64Encoded": False},
        None,
    )
    assert duplicate["statusCode"] == 400
    assert "already exists" in _json_body(duplicate)["error"]


def test_update_budget_not_found():
    response = update_budget(
        {
            "body": json.dumps({"amount": "50.00"}),
            "isBase64Encoded": False,
            "pathParameters": {"budget_id": str(UUID(int=2))},
        },
        None,
    )
    assert response["statusCode"] == 404


def test_delete_budget():
    category = _create_category()
    create_response = create_budget(
        {
            "body": json.dumps(
                {
                    "category_id": str(category.id),
                    "period": "monthly",
                    "amount": "100.00",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    budget_id = _json_body(create_response)["id"]

    delete_response = delete_budget(
        {
            "pathParameters": {"budget_id": budget_id},
        },
        None,
    )
    assert delete_response["statusCode"] == 204

    list_response = list_budgets({"queryStringParameters": None}, None)
    assert _json_body(list_response)["budgets"] == []


def test_list_budget_progress():
    category = _create_category("Dining")
    create_response = create_budget(
        {
            "body": json.dumps(
                {
                    "category_id": str(category.id),
                    "period": "monthly",
                    "amount": "200.00",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert create_response["statusCode"] == 201

    _seed_transaction(category.id, Decimal("-30.00"))

    response = list_budget_progress({"queryStringParameters": None}, None)
    body = _json_body(response)
    assert response["statusCode"] == 200
    assert body["budgets"][0]["spent"] == "30.00"
    assert body["budgets"][0]["remaining"] == "170.00"
