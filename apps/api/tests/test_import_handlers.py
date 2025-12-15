from __future__ import annotations

import base64
import io
import json
from decimal import Decimal
from typing import Iterator

import pytest
from openpyxl import Workbook
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, select

from apps.api.handlers.imports import (
    commit_import_session,
    create_import_batch,
    reset_handler_state,
)
from apps.api.models import (
    Account,
    Loan,
    LoanEvent,
    Subscription,
    TaxEvent,
    Transaction,
    TransactionLeg,
)
from apps.api.shared import (
    AccountType,
    InterestCompound,
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


def _swedbank_workbook() -> str:
    workbook = Workbook()
    sheet = workbook.active
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
    buffer = io.BytesIO()
    workbook.save(buffer)
    return base64.b64encode(buffer.getvalue()).decode()


def _circle_k_workbook() -> str:
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Transaktionsexport"])
    sheet.append([])
    sheet.append(["Datum", "Bokfört", "Specifikation", "Ort", "Valuta", "Utl. belopp", "Belopp"])
    sheet.append(["2024-02-01", "2024-02-02", "Groceries", "Stockholm", "SEK", "", "250"])
    buffer = io.BytesIO()
    workbook.save(buffer)
    return base64.b64encode(buffer.getvalue()).decode()


def test_create_import_batch_parses_swedbank_and_returns_preview():
    payload = _swedbank_workbook()
    event = {
        "body": json.dumps(
            {
                "files": [
                    {
                        "filename": "swedbank.xlsx",
                        "bank_type": "swedbank",
                        "content_base64": payload,
                    }
                ]
            }
        ),
        "isBase64Encoded": False,
    }

    response = create_import_batch(event, None)
    assert response["statusCode"] == 201
    body = _json_body(response)
    created = body["imports"][0]
    assert created["file_count"] == 1
    assert created["total_rows"] == 2
    assert created["status"] in {"ready", "imported"}

    file_meta = created["files"][0]
    assert file_meta["bank_type"] == "swedbank"
    assert file_meta["status"] in {"ready", "imported"}
    assert file_meta["row_count"] == 2
    assert file_meta["errors"] == []
    assert file_meta["preview_rows"][0]["description"]
    first_row = file_meta["preview_rows"][0]
    assert "suggested_confidence" in first_row


def test_create_import_batch_with_xlsx_reports_errors_and_lists_batches():
    payload = _swedbank_workbook()
    create_event = {
        "body": json.dumps(
            {
                "files": [
                    {
                        "filename": "upload.xlsx",
                        "bank_type": "swedbank",
                        "content_base64": payload,
                    }
                ]
            }
        ),
        "isBase64Encoded": False,
    }

    create_response = create_import_batch(create_event, None)
    assert create_response["statusCode"] == 201
    created = _json_body(create_response)["imports"][0]
    assert created["files"][0]["status"] in {"ready", "imported"}


def test_circle_k_amounts_are_negated():
    payload = _circle_k_workbook()
    response = create_import_batch(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "ck.xlsx",
                            "bank_type": "circle_k_mastercard",
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 201
    created = _json_body(response)["imports"][0]
    preview_amount = Decimal(created["files"][0]["preview_rows"][0]["amount"])
    assert preview_amount < 0


def test_subscription_suggestions_surface_without_auto_apply():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        subscription = Subscription(name="StreamCo", matcher_text="stream", matcher_day_of_month=1)
        session.add(subscription)
        session.commit()
        session.refresh(subscription)
        subscription_id = str(subscription.id)

    workbook = Workbook()
    sheet = workbook.active
    sheet.append(
        [
            "Radnummer",
            "Bokföringsdag",
            "Transaktionsdag",
            "Valutadag",
            "Referens",
            "Beskrivning",
            "Belopp",
        ]
    )
    sheet.append(
        ["1", "2024-01-01", "2024-01-01", "2024-01-01", "StreamCo", "StreamCo Premium", "-99.00"]
    )
    buffer = io.BytesIO()
    workbook.save(buffer)

    create_response = create_import_batch(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "subs.xlsx",
                            "bank_type": "swedbank",
                            "content_base64": base64.b64encode(buffer.getvalue()).decode(),
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert create_response["statusCode"] == 201
    created = _json_body(create_response)["imports"][0]
    row = created["rows"][0]
    assert row["suggested_subscription_id"] == subscription_id
    assert row["suggested_subscription_confidence"] >= 0.8

    commit_response = commit_import_session(
        {
            "pathParameters": {"batch_id": created["id"]},
            "body": json.dumps({"rows": [{"row_id": row["id"]}]}),
            "isBase64Encoded": False,
        },
        None,
    )
    assert commit_response["statusCode"] == 200

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        transactions = list(session.exec(select(Transaction)).all())
        assert len(transactions) == 1
        assert transactions[0].subscription_id is None


def test_subscription_applied_when_explicit_override():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        subscription = Subscription(name="Gym", matcher_text="gym")
        session.add(subscription)
        session.commit()
        session.refresh(subscription)
        subscription_id = str(subscription.id)

    workbook = Workbook()
    sheet = workbook.active
    sheet.append(
        [
            "Radnummer",
            "Bokföringsdag",
            "Transaktionsdag",
            "Valutadag",
            "Referens",
            "Beskrivning",
            "Belopp",
        ]
    )
    sheet.append(["1", "2024-02-10", "2024-02-10", "2024-02-10", "Gym", "Gym Unlimited", "-50.00"])
    buffer = io.BytesIO()
    workbook.save(buffer)
    create_response = create_import_batch(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "gym.xlsx",
                            "bank_type": "swedbank",
                            "content_base64": base64.b64encode(buffer.getvalue()).decode(),
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    created = _json_body(create_response)["imports"][0]
    row = created["rows"][0]

    commit_response = commit_import_session(
        {
            "pathParameters": {"batch_id": created["id"]},
            "body": json.dumps(
                {"rows": [{"row_id": row["id"], "subscription_id": subscription_id}]}
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert commit_response["statusCode"] == 200

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        transactions = list(session.exec(select(Transaction)).all())
        assert len(transactions) == 1
        assert transactions[0].subscription_id == subscription.id


def test_commit_can_link_rows_to_loan_account_transfer():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        bank = Account(name="Bank", account_type=AccountType.NORMAL)
        debt = Account(name="Debt", account_type=AccountType.DEBT)
        session.add_all([bank, debt])
        session.flush()
        loan = Loan(
            account_id=debt.id,
            origin_principal=Decimal("1000.00"),
            current_principal=Decimal("1000.00"),
            interest_rate_annual=Decimal("0.05"),
            interest_compound=InterestCompound.MONTHLY,
        )
        session.add(loan)
        session.commit()
        bank_id = str(bank.id)
        debt_id = str(debt.id)

    payload = _swedbank_workbook()
    create_event = {
        "body": json.dumps(
            {
                "files": [
                    {
                        "filename": "swedbank.xlsx",
                        "bank_type": "swedbank",
                        "content_base64": payload,
                        "account_id": bank_id,
                    }
                ]
            }
        ),
        "isBase64Encoded": False,
    }
    create_response = create_import_batch(create_event, None)
    assert create_response["statusCode"] == 201
    created = _json_body(create_response)["imports"][0]
    keep_row_id = created["rows"][1]["id"]
    delete_row_id = created["rows"][0]["id"]

    commit_response = commit_import_session(
        {
            "pathParameters": {"batch_id": created["id"]},
            "body": json.dumps(
                {
                    "rows": [
                        {
                            "row_id": delete_row_id,
                            "delete": True,
                        },
                        {
                            "row_id": keep_row_id,
                            "transfer_account_id": debt_id,
                        },
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert commit_response["statusCode"] == 200

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tx = session.exec(select(Transaction)).one()
        legs = session.exec(
            select(TransactionLeg).where(TransactionLeg.transaction_id == tx.id)
        ).all()
        account_ids = {str(leg.account_id) for leg in legs}
        assert account_ids == {bank_id, debt_id}

        events = session.exec(select(LoanEvent)).all()
        assert len(events) == 1
        assert events[0].event_type == "disbursement"


def test_commit_supports_tax_event_type_and_creates_tax_event():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        bank = Account(name="Bank", account_type=AccountType.NORMAL, is_active=True)
        session.add(bank)
        session.commit()
        session.refresh(bank)
        bank_id = str(bank.id)

    payload = _swedbank_workbook()
    create_response = create_import_batch(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "bank_type": "swedbank",
                            "content_base64": payload,
                            "account_id": bank_id,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert create_response["statusCode"] == 201
    created = _json_body(create_response)["imports"][0]
    deposit_row_id = created["rows"][0]["id"]
    outgoing_row_id = created["rows"][1]["id"]

    commit_response = commit_import_session(
        {
            "pathParameters": {"batch_id": created["id"]},
            "body": json.dumps(
                {
                    "rows": [
                        {"row_id": deposit_row_id, "delete": True},
                        {"row_id": outgoing_row_id, "tax_event_type": "payment"},
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert commit_response["statusCode"] == 200

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tx = session.exec(select(Transaction)).one()
        assert tx.transaction_type == TransactionType.TRANSFER
        assert tx.category_id is None

        tax_events = list(session.exec(select(TaxEvent)).all())
        assert len(tax_events) == 1
        assert str(tax_events[0].event_type) == "payment"
