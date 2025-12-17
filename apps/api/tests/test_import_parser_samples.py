from __future__ import annotations

import base64
import json
from decimal import Decimal
from pathlib import Path
from typing import Iterator
from uuid import UUID

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from apps.api.handlers.imports import preview_imports, reset_handler_state
from apps.api.models import Account
from apps.api.shared import (
    AccountType,
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


def _create_account(*, bank_import_type: str) -> UUID:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        account = Account(
            name=f"Account ({bank_import_type})",
            account_type=AccountType.NORMAL,
            bank_import_type=bank_import_type,
            is_active=True,
        )
        session.add(account)
        session.commit()
        session.refresh(account)
        return account.id


def _b64_file(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


def _json_body(response: dict) -> dict:
    return json.loads(response["body"])


@pytest.mark.parametrize(
    ("bank_import_type", "filename"),
    [
        ("swedbank", "swedbank transactions nov 2025.xlsx"),
        ("seb", "seb tranasctions nov 2025.xlsx"),
        ("circle_k_mastercard", "circle k transactions nov 2025.xlsx"),
    ],
)
def test_preview_parses_sample_bank_statement(bank_import_type: str, filename: str):
    repo_root = Path(__file__).resolve().parents[3]
    file_path = repo_root / "docs" / "data" / "bank transactions" / filename
    assert file_path.exists(), f"Missing sample file: {file_path}"

    account_id = _create_account(bank_import_type=bank_import_type)
    payload = _b64_file(file_path)

    response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": filename,
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
    assert body["files"][0]["bank_import_type"] == bank_import_type
    assert body["files"][0]["error_count"] == 0
    assert body["files"][0]["row_count"] > 0
    assert len(body["rows"]) == body["files"][0]["row_count"]

    first = body["rows"][0]
    assert first["account_id"] == str(account_id)
    assert first["occurred_at"]
    assert first["description"]
    Decimal(first["amount"])
