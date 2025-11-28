from __future__ import annotations

import base64
import io
import json
from typing import Iterator

import pytest
from openpyxl import Workbook
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, select

from apps.api.handlers.imports import (
    commit_import_session,
    create_import_batch,
    list_import_batches,
    reset_handler_state,
)
from apps.api.models import Subscription, Transaction
from apps.api.shared import configure_engine, get_engine


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


def test_create_import_batch_parses_csv_and_returns_preview():
    csv_body = "\n".join(
        [
            "date,description,amount",
            "2024-01-01,Deposit,100.50",
            "2024-01-02,Transfer,-100.50",
        ]
    )
    event = {
        "body": json.dumps(
            {
                "files": [
                    {
                        "filename": "bank.csv",
                        "content_base64": base64.b64encode(csv_body.encode()).decode(),
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
    assert file_meta["status"] in {"ready", "imported"}
    assert file_meta["row_count"] == 2
    assert file_meta["errors"] == []
    assert file_meta["preview_rows"][0]["description"] == "Deposit"
    first_row = file_meta["preview_rows"][0]
    assert "suggested_confidence" in first_row

    # Transfer matcher pairs opposite amounts
    transfer_row = file_meta["preview_rows"][1]
    assert transfer_row["transfer_match"]["paired_with"] == 1


def test_create_import_batch_with_xlsx_reports_errors_and_lists_batches():
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["date", "amount"])  # missing description column
    sheet.append(["2024-02-01", "oops"])

    buffer = io.BytesIO()
    workbook.save(buffer)
    payload = base64.b64encode(buffer.getvalue()).decode()

    create_event = {
        "body": json.dumps(
            {
                "files": [
                    {
                        "filename": "upload.xlsx",
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
    file_meta = created["files"][0]
    assert file_meta["status"] == "error"
    assert file_meta["error_count"] >= 1
    assert file_meta["errors"]

    list_response = list_import_batches({"queryStringParameters": None}, None)
    assert list_response["statusCode"] == 200
    listed = _json_body(list_response)["imports"][0]
    assert listed["total_errors"] >= 1
    assert listed["files"][0]["errors"][0]["row_number"] == 0


def test_subscription_suggestions_surface_without_auto_apply():
    engine = get_engine()
    with Session(engine) as session:
        subscription = Subscription(name="StreamCo", matcher_text="stream", matcher_day_of_month=1)
        session.add(subscription)
        session.commit()
        session.refresh(subscription)
        subscription_id = str(subscription.id)

    csv_body = "\n".join(
        [
            "date,description,amount",
            "2024-01-01,StreamCo Premium,-99.00",
        ]
    )
    create_response = create_import_batch(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "subs.csv",
                            "content_base64": base64.b64encode(csv_body.encode()).decode(),
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
        transactions = list(session.exec(select(Transaction)).all())
        assert len(transactions) == 1
        assert transactions[0].subscription_id is None


def test_subscription_applied_when_explicit_override():
    engine = get_engine()
    with Session(engine) as session:
        subscription = Subscription(name="Gym", matcher_text="gym")
        session.add(subscription)
        session.commit()
        session.refresh(subscription)
        subscription_id = str(subscription.id)

    csv_body = "\n".join(
        [
            "date,description,amount",
            "2024-02-10,Gym Unlimited,-50.00",
        ]
    )
    create_response = create_import_batch(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "gym.csv",
                            "content_base64": base64.b64encode(csv_body.encode()).decode(),
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
            "body": json.dumps({"rows": [{"row_id": row["id"], "subscription_id": subscription_id}]}),
            "isBase64Encoded": False,
        },
        None,
    )
    assert commit_response["statusCode"] == 200

    with Session(engine) as session:
        transactions = list(session.exec(select(Transaction)).all())
        assert len(transactions) == 1
        assert transactions[0].subscription_id == subscription.id
