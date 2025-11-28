from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from apps.api.handlers import (
    monthly_report,
    net_worth_history,
    reset_reporting_handler_state,
    total_report,
    yearly_report,
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


def _create_account(session: Session, account_type: AccountType = AccountType.NORMAL) -> Account:
    account = Account(account_type=account_type)
    session.add(account)
    session.commit()
    session.refresh(account)
    session.expunge(account)
    return account


def _seed_transactions(engine, account: Account, balancing: Account) -> None:
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        service = TransactionService(session)

        occurred_income = datetime(2024, 1, 10, tzinfo=timezone.utc)
        income_tx = Transaction(
            transaction_type=TransactionType.TRANSFER,
            occurred_at=occurred_income,
            posted_at=occurred_income,
        )
        income_legs = [
            TransactionLeg(account_id=account.id, amount=Decimal("500.00")),
            TransactionLeg(account_id=balancing.id, amount=Decimal("-500.00")),
        ]
        service.create_transaction(income_tx, income_legs)

        occurred_expense = datetime(2024, 1, 20, tzinfo=timezone.utc)
        expense_tx = Transaction(
            transaction_type=TransactionType.TRANSFER,
            occurred_at=occurred_expense,
            posted_at=occurred_expense,
        )
        expense_legs = [
            TransactionLeg(account_id=account.id, amount=Decimal("-200.00")),
            TransactionLeg(account_id=balancing.id, amount=Decimal("200.00")),
        ]
        service.create_transaction(expense_tx, expense_legs)


def test_monthly_report_returns_income_and_expense():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
            "year": "2024",
        }
    }

    response = monthly_report(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    results = body["results"]
    assert len(results) == 1
    entry = results[0]
    assert entry["period"] == "2024-01-01"
    assert Decimal(entry["income"]) == Decimal("500.00")
    assert Decimal(entry["expense"]) == Decimal("200.00")
    assert Decimal(entry["net"]) == Decimal("300.00")


def test_yearly_report_supports_account_filter():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
        }
    }

    response = yearly_report(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    results = body["results"]
    assert len(results) == 1
    entry = results[0]
    assert entry["year"] == 2024
    assert Decimal(entry["net"]) == Decimal("300.00")


def test_total_report_returns_zero_when_empty():
    response = total_report({"queryStringParameters": None}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert Decimal(body["income"]) == Decimal("0")
    assert Decimal(body["expense"]) == Decimal("0")
    assert Decimal(body["net"]) == Decimal("0")
    assert "generated_at" in body


def test_total_report_respects_filters():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        secondary = _create_account(session)
    _seed_transactions(engine, tracked, secondary)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
        }
    }
    response = total_report(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert Decimal(body["net"]) == Decimal("300.00")


def test_net_worth_history_returns_running_balance():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
        }
    }
    response = net_worth_history(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    points = body["points"]
    assert len(points) == 2
    assert points[0]["period"] == "2024-01-10"
    assert Decimal(points[0]["net_worth"]) == Decimal("500.00")
    assert Decimal(points[1]["net_worth"]) == Decimal("300.00")
