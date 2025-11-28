from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from apps.api.handlers import (
    attach_subscription,
    create_subscription,
    create_transaction,
    detach_subscription,
    list_subscription_summaries,
    list_subscriptions,
    reset_subscription_handler_state,
    reset_transaction_handler_state,
    update_subscription,
)
from apps.api.models import Account, Subscription, Transaction, TransactionLeg
from apps.api.shared import (
    AccountType,
    TransactionType,
    configure_engine,
    get_engine,
)


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_subscription_handler_state()
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


def _json_body(response) -> dict:
    return json.loads(response["body"])


def _create_account(session: Session, account_type: AccountType = AccountType.NORMAL) -> Account:
    account = Account(account_type=account_type)
    session.add(account)
    session.commit()
    session.refresh(account)
    session.expunge(account)
    return account


def test_create_and_list_subscriptions():
    create_response = create_subscription(
        {
            "body": json.dumps(
                {
                    "name": "Streaming",
                    "matcher_text": "Netflix",
                    "matcher_amount_tolerance": "5.00",
                    "matcher_day_of_month": 15,
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert create_response["statusCode"] == 201

    list_response = list_subscriptions({"queryStringParameters": None}, None)
    assert list_response["statusCode"] == 200
    subscriptions = _json_body(list_response)["subscriptions"]
    assert len(subscriptions) == 1
    assert subscriptions[0]["name"] == "Streaming"


def test_update_subscription_allows_clearing_fields():
    create_response = create_subscription(
        {
            "body": json.dumps(
                {
                    "name": "Cloud Storage",
                    "matcher_text": "Drive",
                    "matcher_day_of_month": 3,
                    "matcher_amount_tolerance": "2.00",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    subscription_id = _json_body(create_response)["id"]

    update_response = update_subscription(
        {
            "body": json.dumps(
                {
                    "name": "Storage",
                    "matcher_day_of_month": None,
                    "matcher_amount_tolerance": None,
                    "is_active": False,
                }
            ),
            "isBase64Encoded": False,
            "pathParameters": {"subscription_id": subscription_id},
        },
        None,
    )

    assert update_response["statusCode"] == 200
    updated = _json_body(update_response)
    assert updated["name"] == "Storage"
    assert updated["matcher_day_of_month"] is None
    assert updated["matcher_amount_tolerance"] is None
    assert updated["is_active"] is False


def test_attach_and_detach_subscription():
    engine = get_engine()
    with Session(engine) as session:
        source = _create_account(session)
        destination = _create_account(session)
        source_id = source.id
        destination_id = destination.id

    subscription_resp = create_subscription(
        {
            "body": json.dumps({"name": "Music", "matcher_text": "Spotify"}),
            "isBase64Encoded": False,
        },
        None,
    )
    subscription_id = _json_body(subscription_resp)["id"]

    occurred = datetime(2024, 2, 1, tzinfo=timezone.utc)
    transaction_resp = create_transaction(
        {
            "body": json.dumps(
                {
                    "occurred_at": occurred.isoformat(),
                    "posted_at": occurred.isoformat(),
                    "legs": [
                        {"account_id": str(source_id), "amount": "-100.00"},
                        {"account_id": str(destination_id), "amount": "100.00"},
                    ],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    transaction_id = _json_body(transaction_resp)["id"]

    attach_resp = attach_subscription(
        {
            "body": json.dumps({"subscription_id": subscription_id}),
            "isBase64Encoded": False,
            "pathParameters": {"transaction_id": transaction_id},
        },
        None,
    )
    assert attach_resp["statusCode"] == 200
    attached = _json_body(attach_resp)
    assert attached["subscription_id"] == subscription_id

    detach_resp = detach_subscription(
        {
            "pathParameters": {"transaction_id": transaction_id},
        },
        None,
    )
    assert detach_resp["statusCode"] == 200
    detached = _json_body(detach_resp)
    assert detached["subscription_id"] is None


def test_subscription_summary_includes_spend_and_last_charge():
    engine = get_engine()
    with Session(engine) as session:
        account_a = _create_account(session)
        account_b = _create_account(session)
        subscription = Subscription(
            name="Music",
            matcher_text="music",
            matcher_day_of_month=1,
            matcher_amount_tolerance=None,
        )
        session.add(subscription)
        session.commit()
        session.refresh(subscription)
        subscription_id = subscription.id

        # Create transactions across months
        dates = [
            datetime(2024, 12, 15, tzinfo=timezone.utc),
            datetime(2025, 1, 10, tzinfo=timezone.utc),
            datetime(2025, 2, 5, tzinfo=timezone.utc),
        ]
        for occurred in dates:
            txn = Transaction(
                subscription_id=subscription_id,
                occurred_at=occurred,
                posted_at=occurred,
                transaction_type=TransactionType.EXPENSE,
                description="Music",
            )
            session.add(txn)
            session.flush()
            legs = [
                TransactionLeg(
                    transaction_id=txn.id, account_id=account_a.id, amount=Decimal("-50")
                ),
                TransactionLeg(
                    transaction_id=txn.id, account_id=account_b.id, amount=Decimal("50")
                ),
            ]
            session.add_all(legs)
        session.commit()

    response = list_subscription_summaries({"queryStringParameters": None}, None)
    assert response["statusCode"] == 200
    summaries = _json_body(response)["subscriptions"]
    assert len(summaries) == 1
    summary = summaries[0]
    assert summary["last_charge_at"] is not None
    assert float(summary["trend"][-1]) >= 0
