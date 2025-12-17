from __future__ import annotations

import base64
import io
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterator
from uuid import UUID

import pytest
from openpyxl import Workbook
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, select

from apps.api.handlers.imports import commit_imports, preview_imports, reset_handler_state
from apps.api.models import Account, Category, Transaction, TransactionImportBatch, TransactionLeg
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


def _b64_workbook(builder) -> str:
    workbook = Workbook()
    sheet = workbook.active
    builder(sheet)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return base64.b64encode(buffer.getvalue()).decode()


def _swedbank_workbook() -> str:
    def build(sheet):
        sheet.append(["Transaktioner Privatkonto"])
        sheet.append([])
        sheet.append(
            [
                "Radnummer",
                "Bokföringsdag",
                "Transaktionsdag",
                "Valutadag",
                "Referens",
                "Beskrivning",
                "Belopp",
                "Bokfört saldo",
            ]
        )
        sheet.append(
            [
                "1",
                "2024-01-01",
                "2024-01-01",
                "2024-01-01",
                "Ref 123",
                "Deposit",
                "100.50",
                "1200.00",
            ]
        )
        sheet.append(
            [
                "2",
                "2024-01-02",
                "2024-01-02",
                "2024-01-02",
                "Transfer",
                "Outgoing",
                "-100.50",
                "1099.50",
            ]
        )

    return _b64_workbook(build)


def _circle_k_workbook() -> str:
    def build(sheet):
        sheet.append(["Transaktionsexport"])
        sheet.append([])
        sheet.append(
            ["Datum", "Bokfört", "Specifikation", "Ort", "Valuta", "Utl. belopp", "Belopp"]
        )
        sheet.append(["2024-02-01", "2024-02-02", "Groceries", "Stockholm", "SEK", "", "250"])

    return _b64_workbook(build)


def _create_account(*, bank_import_type: str | None) -> UUID:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        account = Account(
            name="Account",
            account_type=AccountType.NORMAL,
            bank_import_type=bank_import_type,
            is_active=True,
        )
        session.add(account)
        session.commit()
        session.refresh(account)
        return account.id


def _create_category(*, name: str) -> UUID:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        category = Category(name=name, category_type=CategoryType.EXPENSE, is_archived=False)
        session.add(category)
        session.commit()
        session.refresh(category)
        return category.id


def _create_categorized_transaction(
    *, account_id: UUID, category_id: UUID, description: str
) -> UUID:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tx = Transaction(
            transaction_type=TransactionType.EXPENSE,
            occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            description=description,
            category_id=category_id,
        )
        session.add(tx)
        session.flush()
        session.add(
            TransactionLeg(
                transaction_id=tx.id,
                account_id=account_id,
                amount=Decimal("-99.00"),
            )
        )
        session.commit()
        return tx.id


def test_preview_parses_swedbank_and_returns_rows():
    account_id = _create_account(bank_import_type="swedbank")
    payload = _swedbank_workbook()
    response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ],
                    "note": "preview",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["files"][0]["bank_import_type"] == "swedbank"
    assert body["files"][0]["row_count"] == 2
    assert body["rows"] and len(body["rows"]) == 2
    assert body["rows"][0]["related_transactions"] == []


def test_preview_returns_error_when_account_has_no_bank_type():
    account_id = _create_account(bank_import_type=None)
    payload = _swedbank_workbook()
    response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    file_meta = body["files"][0]
    assert file_meta["row_count"] == 0
    assert file_meta["error_count"] >= 1
    assert "bank import type" in file_meta["errors"][0]["message"].lower()


def test_preview_circle_k_amounts_are_negated():
    account_id = _create_account(bank_import_type="circle_k_mastercard")
    payload = _circle_k_workbook()
    response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "ck.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 200
    created = _json_body(response)
    first_amount = Decimal(created["rows"][0]["amount"])
    assert first_amount < 0


def test_preview_includes_related_transactions():
    account_id = _create_account(bank_import_type="swedbank")
    groceries_id = _create_category(name="Groceries")
    tx_id = _create_categorized_transaction(
        account_id=account_id,
        category_id=groceries_id,
        description="ICA supermarket",
    )
    payload = _swedbank_workbook()
    response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    related = body["rows"][0]["related_transactions"]
    assert any(item["id"] == str(tx_id) for item in related)


def test_commit_is_all_or_nothing():
    account_id = _create_account(bank_import_type="swedbank")
    response = commit_imports(
        {
            "body": json.dumps(
                {
                    "note": "commit",
                    "rows": [
                        {
                            "id": str(UUID(int=1)),
                            "account_id": str(account_id),
                            "occurred_at": "2024-01-01",
                            "amount": "10.00",
                            "description": "Valid row",
                        },
                        {
                            "id": str(UUID(int=2)),
                            "account_id": str(account_id),
                            "occurred_at": "2024-01-02",
                            "amount": "not-a-number",
                            "description": "Invalid row",
                        },
                    ],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 400

    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        assert session.exec(select(Transaction)).all() == []
        assert session.exec(select(TransactionImportBatch)).all() == []


def test_commit_creates_batch_and_transactions():
    account_id = _create_account(bank_import_type="swedbank")
    response = commit_imports(
        {
            "body": json.dumps(
                {
                    "note": "commit ok",
                    "rows": [
                        {
                            "id": str(UUID(int=1)),
                            "account_id": str(account_id),
                            "occurred_at": "2024-01-01",
                            "amount": "10.00",
                            "description": "Committed row",
                        }
                    ],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["import_batch_id"]
    assert body["transaction_ids"] and len(body["transaction_ids"]) == 1
