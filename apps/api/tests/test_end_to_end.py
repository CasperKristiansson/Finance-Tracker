from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterator
from uuid import UUID

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from apps.api.handlers import (
    create_account,
    create_category,
    create_transaction,
    list_accounts,
    list_categories,
    list_loan_events,
    list_transactions,
    monthly_report,
    reset_account_handler_state,
    reset_category_handler_state,
    reset_loan_handler_state,
    reset_reporting_handler_state,
    reset_transaction_handler_state,
    total_report,
    yearly_report,
)
from apps.api.shared import configure_engine, get_engine


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_account_handler_state()
    reset_category_handler_state()
    reset_transaction_handler_state()
    reset_reporting_handler_state()
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


def _create_account_event(account_type: str = "normal", **overrides: object) -> dict:
    payload = {
        "account_type": account_type,
        "is_active": True,
    }
    payload.update(overrides)
    return {"body": json.dumps(payload), "isBase64Encoded": False}


def _create_transaction_event(payload: dict) -> dict:
    return {"body": json.dumps(payload), "isBase64Encoded": False}


def test_end_to_end_transaction_reporting_flow() -> None:
    create_account_event = _create_account_event

    # Create two accounts
    checking_response = create_account(
        create_account_event(),
        None,
    )
    savings_response = create_account(
        create_account_event(),
        None,
    )
    checking_id = UUID(_json_body(checking_response)["id"])
    savings_id = UUID(_json_body(savings_response)["id"])

    # Create a category for reference
    category_event = {
        "body": json.dumps({"name": "Transfers", "category_type": "expense"}),
        "isBase64Encoded": False,
    }
    create_category(category_event, None)

    # Ensure category listing works
    categories_response = list_categories({"queryStringParameters": None}, None)
    assert categories_response["statusCode"] == 200
    assert any(
        item["name"] == "Transfers" for item in _json_body(categories_response)["categories"]
    )

    occurred = datetime(2024, 3, 15, tzinfo=timezone.utc)
    transaction_event = _create_transaction_event(
        {
            "occurred_at": occurred.isoformat(),
            "posted_at": occurred.isoformat(),
            "legs": [
                {"account_id": str(checking_id), "amount": "-200.00"},
                {"account_id": str(savings_id), "amount": "200.00"},
            ],
        }
    )
    create_tx_response = create_transaction(transaction_event, None)
    assert create_tx_response["statusCode"] == 201

    # Confirm transaction listing reflects the new transaction
    transactions_response = list_transactions({"queryStringParameters": None}, None)
    assert transactions_response["statusCode"] == 200
    transactions = _json_body(transactions_response)["transactions"]
    assert len(transactions) == 1
    assert Decimal(transactions[0]["legs"][0]["amount"]) == Decimal("-200.00")

    # Check account balances reflect the transaction legs
    accounts_response = list_accounts({"queryStringParameters": None}, None)
    accounts = _json_body(accounts_response)["accounts"]
    balances = {UUID(item["id"]): Decimal(item["balance"]) for item in accounts}
    assert balances[checking_id] == Decimal("-200.00")
    assert balances[savings_id] == Decimal("200.00")

    # Reporting scoped to destination account should show income only
    report_event = {
        "queryStringParameters": {
            "account_ids": str(savings_id),
            "year": "2024",
        }
    }
    monthly_response = monthly_report(report_event, None)
    assert monthly_response["statusCode"] == 200
    monthly_results = _json_body(monthly_response)["results"]
    assert len(monthly_results) == 1
    monthly_entry = monthly_results[0]
    assert monthly_entry["period"] == "2024-03-01"
    assert Decimal(monthly_entry["income"]) == Decimal("200.00")
    assert Decimal(monthly_entry["expense"]) == Decimal("0")

    # Yearly report using the same filter should yield the same net amount
    yearly_response = yearly_report(
        {"queryStringParameters": {"account_ids": str(savings_id)}}, None
    )
    yearly_results = _json_body(yearly_response)["results"]
    assert len(yearly_results) == 1
    assert Decimal(yearly_results[0]["net"]) == Decimal("200.00")

    # Total report across both accounts should net to zero
    total_response = total_report(
        {
            "queryStringParameters": {
                "account_ids": f"{checking_id},{savings_id}",
            }
        },
        None,
    )
    total_body = _json_body(total_response)
    assert Decimal(total_body["income"]) == Decimal("200.00")
    assert Decimal(total_body["expense"]) == Decimal("200.00")
    assert Decimal(total_body["net"]) == Decimal("0")
    assert "generated_at" in total_body


def test_end_to_end_loan_payment_flow() -> None:
    create_event = _create_account_event

    # Create funding and debt accounts; debt account carries loan metadata
    funding_response = create_account(create_event(), None)
    funding_id = UUID(_json_body(funding_response)["id"])

    debt_response = create_account(
        create_event(
            account_type="debt",
            loan={
                "origin_principal": "10000.00",
                "current_principal": "10000.00",
                "interest_rate_annual": "0.05",
                "interest_compound": "monthly",
                "minimum_payment": "500.00",
            },
        ),
        None,
    )
    debt_id = UUID(_json_body(debt_response)["id"])

    # Loan payment transaction (reduces debt, leaves funding account credited)
    occurred = datetime(2024, 4, 1, tzinfo=timezone.utc)
    payment_event = _create_transaction_event(
        {
            "occurred_at": occurred.isoformat(),
            "posted_at": occurred.isoformat(),
            "legs": [
                {"account_id": str(debt_id), "amount": "-500.00"},
                {"account_id": str(funding_id), "amount": "500.00"},
            ],
        }
    )
    payment_response = create_transaction(payment_event, None)
    assert payment_response["statusCode"] == 201

    # Loan events should capture the principal payment
    loan_events_response = list_loan_events(
        {
            "pathParameters": {"account_id": str(debt_id)},
            "queryStringParameters": None,
        },
        None,
    )
    assert loan_events_response["statusCode"] == 200
    events = _json_body(loan_events_response)["events"]
    assert len(events) == 1
    event = events[0]
    assert event["event_type"] == "payment_principal"
    assert Decimal(event["amount"]) == Decimal("500.00")

    # Ensure account balances reflect the payment
    accounts_body = _json_body(list_accounts({"queryStringParameters": None}, None))
    balances = {UUID(item["id"]): Decimal(item["balance"]) for item in accounts_body["accounts"]}
    assert balances[funding_id] == Decimal("500.00")
    assert balances[debt_id] == Decimal("-500.00")

    # Yearly report scoped to debt account treats the payment as an expense
    yearly_response = yearly_report(
        {"queryStringParameters": {"account_ids": str(debt_id)}},
        None,
    )
    yearly_totals = _json_body(yearly_response)["results"]
    assert len(yearly_totals) == 1
    assert Decimal(yearly_totals[0]["expense"]) == Decimal("500.00")
