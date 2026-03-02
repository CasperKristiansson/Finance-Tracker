from __future__ import annotations

import json
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Iterator
from uuid import UUID

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, select

from apps.api.handlers.investments import (
    create_investment_snapshot,
    investment_overview,
    list_investment_transactions,
    reset_handler_state,
)
from apps.api.models import Account, InvestmentSnapshot, InvestmentTransaction, Transaction
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
    reset_handler_state()
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


def test_list_investment_transactions_empty() -> None:
    response = list_investment_transactions({"queryStringParameters": {}}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["transactions"] == []


def test_investment_overview_empty_state() -> None:
    response = investment_overview({}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["portfolio"]["series"] == []
    assert body["accounts"] == []


def test_list_investment_transactions_invalid_limit_returns_400() -> None:
    response = list_investment_transactions({"queryStringParameters": {"limit": "abc"}}, None)
    assert response["statusCode"] == 400
    assert _json_body(response)["error"] == "limit must be an integer"


def test_list_investment_transactions_invalid_offset_returns_400() -> None:
    response = list_investment_transactions({"queryStringParameters": {"offset": "abc"}}, None)
    assert response["statusCode"] == 400
    assert _json_body(response)["error"] == "offset must be an integer"


def test_list_investment_transactions_supports_account_name_and_pagination() -> None:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        session.add_all(
            [
                InvestmentTransaction(
                    occurred_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
                    transaction_type="buy",
                    description="Broker A tx 1",
                    account_name="Broker A",
                    amount_sek=Decimal("-100.00"),
                ),
                InvestmentTransaction(
                    occurred_at=datetime(2024, 1, 11, tzinfo=timezone.utc),
                    transaction_type="buy",
                    description="Broker A tx 2",
                    account_name="Broker A",
                    amount_sek=Decimal("-50.00"),
                ),
                InvestmentTransaction(
                    occurred_at=datetime(2024, 1, 12, tzinfo=timezone.utc),
                    transaction_type="buy",
                    description="Broker B tx",
                    account_name="Broker B",
                    amount_sek=Decimal("-75.00"),
                ),
            ]
        )
        session.commit()

    first_page = list_investment_transactions(
        {"queryStringParameters": {"account_name": "Broker A", "limit": "1", "offset": "0"}},
        None,
    )
    assert first_page["statusCode"] == 200
    first_body = _json_body(first_page)
    assert len(first_body["transactions"]) == 1
    assert first_body["transactions"][0]["account_name"] == "Broker A"
    assert first_body["limit"] == 1
    assert first_body["offset"] == 0
    assert first_body["has_more"] is True
    assert first_body["next_offset"] == 1

    second_page = list_investment_transactions(
        {"queryStringParameters": {"account_name": "Broker A", "limit": "1", "offset": "1"}},
        None,
    )
    assert second_page["statusCode"] == 200
    second_body = _json_body(second_page)
    assert len(second_body["transactions"]) == 1
    assert second_body["transactions"][0]["account_name"] == "Broker A"
    assert second_body["has_more"] is False
    assert second_body["next_offset"] is None


def test_create_investment_snapshot_validation_and_not_found() -> None:
    invalid = create_investment_snapshot({"body": "{}", "isBase64Encoded": False}, None)
    assert invalid["statusCode"] == 400

    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        normal = Account(account_type=AccountType.NORMAL, name="Normal")
        session.add(normal)
        session.commit()
        session.refresh(normal)
        normal_id = normal.id

    not_found = create_investment_snapshot(
        {
            "body": json.dumps(
                {
                    "account_id": str(normal_id),
                    "snapshot_date": "2024-01-01",
                    "balance": "1000",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert not_found["statusCode"] == 404


def test_create_investment_snapshot_creates_snapshot_and_adjustment_transaction() -> None:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        investment = Account(account_type=AccountType.INVESTMENT, name="Broker")
        session.add(investment)
        session.commit()
        session.refresh(investment)
        investment_id = investment.id

    response = create_investment_snapshot(
        {
            "body": json.dumps(
                {
                    "account_id": str(investment_id),
                    "snapshot_date": "2024-02-15",
                    "balance": "1500.00",
                    "notes": "manual",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 201
    body = _json_body(response)
    assert body["account_id"] == str(investment_id)
    assert body["snapshot_date"] == date(2024, 2, 15).isoformat()
    assert Decimal(body["balance"]) == Decimal("1500.00")

    with Session(engine) as session:
        snapshots = session.exec(select(InvestmentSnapshot)).all()
        assert len(snapshots) == 1
        txs = session.exec(
            select(Transaction).where(
                Transaction.transaction_type == TransactionType.INVESTMENT_EVENT
            )
        ).all()
        assert len(txs) == 1


def test_create_investment_snapshot_zero_delta_skips_adjustment_and_covers_overview_loop(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        investment = Account(account_type=AccountType.INVESTMENT, name="Broker")
        session.add(investment)
        session.commit()
        session.refresh(investment)
        investment_id = investment.id

    monkeypatch.setattr(
        "apps.api.handlers.investments.InvestmentSnapshotService.investment_overview",
        lambda _self: {
            "accounts": [
                {"account_id": UUID(int=999), "current_value": Decimal("1")},
                {"account_id": investment_id, "current_value": None},
            ]
        },
    )
    monkeypatch.setattr(
        "apps.api.handlers.investments.TransactionService.create_transaction",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("unexpected transaction")),
    )

    response = create_investment_snapshot(
        {
            "body": json.dumps(
                {
                    "account_id": str(investment_id),
                    "snapshot_date": "2024-03-01",
                    "balance": "0",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 201


def test_create_investment_snapshot_skips_when_offset_account_has_no_id(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        investment = Account(account_type=AccountType.INVESTMENT, name="Broker 2")
        session.add(investment)
        session.commit()
        session.refresh(investment)
        investment_id = investment.id

    monkeypatch.setattr(
        "apps.api.handlers.investments.InvestmentSnapshotService.investment_overview",
        lambda _self: {"accounts": []},
    )
    monkeypatch.setattr(
        "apps.api.handlers.investments.AccountService.get_or_create_offset_account",
        lambda _self: SimpleNamespace(id=None),
    )
    monkeypatch.setattr(
        "apps.api.handlers.investments.TransactionService.create_transaction",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("unexpected transaction")),
    )

    response = create_investment_snapshot(
        {
            "body": json.dumps(
                {
                    "account_id": str(investment_id),
                    "snapshot_date": "2024-03-02",
                    "balance": "25",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 201

    with Session(engine) as session:
        txs = session.exec(select(Transaction)).all()
        assert txs == []
