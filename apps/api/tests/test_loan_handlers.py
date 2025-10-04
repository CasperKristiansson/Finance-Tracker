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
    create_loan,
    get_loan_schedule,
    list_loan_events,
    reset_loan_handler_state,
    update_loan,
)
from apps.api.models import Account, Loan, Transaction, TransactionLeg
from apps.api.services import TransactionService
from apps.api.shared import AccountType, InterestCompound, TransactionType, configure_engine, get_engine


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_loan_handler_state()
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


def _create_account(session: Session, account_type: AccountType = AccountType.DEBT) -> Account:
    account = Account(account_type=account_type)
    session.add(account)
    session.commit()
    session.refresh(account)
    session.expunge(account)
    return account


def test_create_loan_for_debt_account():
    engine = get_engine()
    with Session(engine) as session:
        account = _create_account(session)

    payload = {
        "account_id": str(account.id),
        "origin_principal": "100000.00",
        "current_principal": "90000.00",
        "interest_rate_annual": "0.045",
        "interest_compound": "monthly",
        "minimum_payment": "1500.00",
    }

    response = create_loan({"body": json.dumps(payload), "isBase64Encoded": False}, None)
    assert response["statusCode"] == 201
    body = _json_body(response)
    assert UUID(body["id"]) == UUID(body["id"])  # parseable UUID
    assert body["account_id"] == str(account.id)
    assert body["current_principal"] == "90000.00"

    with Session(engine) as session:
        stored = session.get(Loan, UUID(body["id"]))
        assert stored is not None
        assert stored.minimum_payment == Decimal("1500.00")


def test_create_loan_rejects_non_debt_account():
    engine = get_engine()
    with Session(engine) as session:
        account = _create_account(session, AccountType.NORMAL)

    payload = {
        "account_id": str(account.id),
        "origin_principal": "1000",
        "current_principal": "1000",
        "interest_rate_annual": "0.05",
        "interest_compound": "monthly",
    }

    response = create_loan({"body": json.dumps(payload), "isBase64Encoded": False}, None)
    assert response["statusCode"] == 400


def test_update_loan_fields():
    engine = get_engine()
    with Session(engine) as session:
        account = _create_account(session)
        loan = Loan(
            account_id=account.id,
            origin_principal=Decimal("50000"),
            current_principal=Decimal("48000"),
            interest_rate_annual=Decimal("0.04"),
            interest_compound=InterestCompound.MONTHLY,
        )
        session.add(loan)
        session.commit()
        session.refresh(loan)

    payload = {
        "minimum_payment": "900.00",
        "interest_rate_annual": "0.045",
    }
    event = {
        "body": json.dumps(payload),
        "isBase64Encoded": False,
        "pathParameters": {"account_id": str(account.id)},
    }

    response = update_loan(event, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["account_id"] == str(account.id)
    assert body["minimum_payment"] == "900.00"
    assert Decimal(body["interest_rate_annual"]) == Decimal("0.045")


def test_get_loan_schedule_generates_entries():
    engine = get_engine()
    with Session(engine) as session:
        account = _create_account(session)
        loan = Loan(
            account_id=account.id,
            origin_principal=Decimal("1000"),
            current_principal=Decimal("1000"),
            interest_rate_annual=Decimal("0.12"),
            interest_compound=InterestCompound.MONTHLY,
            minimum_payment=Decimal("200"),
        )
        session.add(loan)
        session.commit()

    event = {
        "pathParameters": {"account_id": str(account.id)},
        "queryStringParameters": {
            "as_of_date": "2024-01-01",
            "periods": "5",
        },
    }

    response = get_loan_schedule(event, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    schedule = body["schedule"]
    assert len(schedule) > 0
    first = schedule[0]
    assert first["payment_amount"] == "200.00"
    assert first["interest_amount"] == "10.00"
    assert first["principal_amount"] == "190.00"


def test_list_loan_events_returns_recent_activity():
    engine = get_engine()
    with Session(engine) as session:
        debt_account = _create_account(session)
        funding_account = _create_account(session, AccountType.NORMAL)
        loan = Loan(
            account_id=debt_account.id,
            origin_principal=Decimal("2000"),
            current_principal=Decimal("2000"),
            interest_rate_annual=Decimal("0.05"),
            interest_compound=InterestCompound.MONTHLY,
        )
        session.add(loan)
        session.commit()
        session.refresh(loan)

        service = TransactionService(session)
        occurred = datetime(2024, 1, 1, tzinfo=timezone.utc)
        transaction = Transaction(
            transaction_type=TransactionType.TRANSFER,
            occurred_at=occurred,
            posted_at=occurred,
        )
        legs = [
            TransactionLeg(account_id=debt_account.id, amount=Decimal("-250.00")),
            TransactionLeg(account_id=funding_account.id, amount=Decimal("250.00")),
        ]
        service.create_transaction(transaction, legs)

    event = {
        "pathParameters": {"account_id": str(debt_account.id)},
        "queryStringParameters": {"limit": "5"},
    }

    response = list_loan_events(event, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    events = body["events"]
    assert len(events) == 1
    assert events[0]["event_type"] in {"payment_principal", "disbursement"}


def test_endpoints_return_404_for_missing_loan():
    missing_id = str(UUID(int=1))
    schedule_event = {
        "pathParameters": {"account_id": missing_id},
        "queryStringParameters": None,
    }
    events_event = {
        "pathParameters": {"account_id": missing_id},
        "queryStringParameters": None,
    }
    update_event = {
        "body": json.dumps({"current_principal": "100"}),
        "isBase64Encoded": False,
        "pathParameters": {"account_id": missing_id},
    }

    assert get_loan_schedule(schedule_event, None)["statusCode"] == 404
    assert list_loan_events(events_event, None)["statusCode"] == 404
    assert update_loan(update_event, None)["statusCode"] == 404


def test_create_loan_rejects_duplicate():
    engine = get_engine()
    with Session(engine) as session:
        account = _create_account(session)
        loan = Loan(
            account_id=account.id,
            origin_principal=Decimal("1000"),
            current_principal=Decimal("1000"),
            interest_rate_annual=Decimal("0.03"),
            interest_compound=InterestCompound.MONTHLY,
        )
        session.add(loan)
        session.commit()

    payload = {
        "account_id": str(account.id),
        "origin_principal": "500",
        "current_principal": "500",
        "interest_rate_annual": "0.02",
        "interest_compound": "monthly",
    }

    response = create_loan({"body": json.dumps(payload), "isBase64Encoded": False}, None)
    assert response["statusCode"] == 400
