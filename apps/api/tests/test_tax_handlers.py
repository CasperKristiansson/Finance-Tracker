from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, select

from apps.api.handlers.reporting import monthly_report
from apps.api.handlers.reporting import reset_handler_state as reset_reporting_handler_state
from apps.api.handlers.tax import create_tax_event, reset_handler_state, tax_summary
from apps.api.models import Account, Category, TaxEvent, Transaction, TransactionLeg
from apps.api.services import TransactionService
from apps.api.shared import (
    AccountType,
    CategoryType,
    TransactionType,
    configure_engine,
    get_default_user_id,
    get_engine,
    scope_session_to_user,
)


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_handler_state()
    reset_reporting_handler_state()
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


def test_create_tax_event_creates_transfer_transaction_and_tax_event():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        account = Account(name="Bank", account_type=AccountType.NORMAL, is_active=True)
        session.add(account)
        session.commit()
        session.refresh(account)
        account_id = str(account.id)

    payload = {
        "account_id": account_id,
        "occurred_at": "2024-01-10T00:00:00Z",
        "amount": "100.00",
        "event_type": "payment",
        "description": "Skatteverket",
    }

    response = create_tax_event(
        {"body": json.dumps(payload), "isBase64Encoded": False},
        None,
    )
    assert response["statusCode"] == 201

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        events = list(session.exec(select(TaxEvent)).all())
        assert len(events) == 1
        assert str(events[0].event_type) == "payment"

        tx = session.exec(select(Transaction)).one()
        assert tx.transaction_type == TransactionType.TRANSFER
        assert tx.category_id is None

        legs = list(
            session.exec(select(TransactionLeg).where(TransactionLeg.transaction_id == tx.id)).all()
        )
        assert len(legs) == 2
        amounts_by_account = {str(leg.account_id): Decimal(str(leg.amount)) for leg in legs}
        assert amounts_by_account[account_id] == Decimal("-100.00")


def test_tax_summary_refunds_are_negative_net_tax_paid():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        account = Account(name="Bank", account_type=AccountType.NORMAL, is_active=True)
        session.add(account)
        session.commit()
        session.refresh(account)
        account_id = str(account.id)

    # Payment 200 + refund 50 => net 150 in Jan.
    for event_type, amount in [("payment", "200.00"), ("refund", "50.00")]:
        create_tax_event(
            {
                "body": json.dumps(
                    {
                        "account_id": account_id,
                        "occurred_at": "2024-01-15T00:00:00Z",
                        "amount": amount,
                        "event_type": event_type,
                        "description": "Skatteverket",
                    }
                ),
                "isBase64Encoded": False,
            },
            None,
        )

    summary = tax_summary(
        {"queryStringParameters": {"year": "2024"}},
        None,
    )
    assert summary["statusCode"] == 200
    body = _json_body(summary)
    jan = next(item for item in body["monthly"] if item["month"] == 1)
    assert Decimal(jan["net_tax_paid"]) == Decimal("150.00")


def test_reports_exclude_tax_transactions_from_income_and_expense():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        bank = Account(name="Bank", account_type=AccountType.NORMAL, is_active=True)
        balancing = Account(name="Balancing", account_type=AccountType.NORMAL, is_active=True)
        session.add_all([bank, balancing])
        session.commit()
        session.refresh(bank)
        session.refresh(balancing)
        bank_id = str(bank.id)

        income_category = Category(name="Salary", category_type=CategoryType.INCOME)
        expense_category = Category(name="Food", category_type=CategoryType.EXPENSE)
        session.add_all([income_category, expense_category])
        session.commit()
        session.refresh(income_category)
        session.refresh(expense_category)

        service = TransactionService(session)
        occurred_income = datetime(2024, 1, 10, tzinfo=timezone.utc)
        service.create_transaction(
            Transaction(
                transaction_type=TransactionType.INCOME,
                occurred_at=occurred_income,
                posted_at=occurred_income,
                description="Salary",
                category_id=income_category.id,
            ),
            [
                TransactionLeg(account_id=bank.id, amount=Decimal("500.00")),
                TransactionLeg(account_id=balancing.id, amount=Decimal("-500.00")),
            ],
        )

        occurred_expense = datetime(2024, 1, 20, tzinfo=timezone.utc)
        service.create_transaction(
            Transaction(
                transaction_type=TransactionType.EXPENSE,
                occurred_at=occurred_expense,
                posted_at=occurred_expense,
                description="Groceries",
                category_id=expense_category.id,
            ),
            [
                TransactionLeg(account_id=bank.id, amount=Decimal("-200.00")),
                TransactionLeg(account_id=balancing.id, amount=Decimal("200.00")),
            ],
        )

    baseline = _json_body(
        monthly_report(
            {
                "queryStringParameters": {
                    "account_ids": bank_id,
                    "year": "2024",
                }
            },
            None,
        )
    )["results"][0]

    # Add tax payment; should not change operating income/expense.
    create_tax_event(
        {
            "body": json.dumps(
                {
                    "account_id": bank_id,
                    "occurred_at": "2024-01-05T00:00:00Z",
                    "amount": "999.00",
                    "event_type": "payment",
                    "description": "Skatteverket",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )

    after = _json_body(
        monthly_report(
            {
                "queryStringParameters": {
                    "account_ids": bank_id,
                    "year": "2024",
                }
            },
            None,
        )
    )["results"][0]

    assert after["income"] == baseline["income"]
    assert after["expense"] == baseline["expense"]
    assert after["net"] == baseline["net"]
