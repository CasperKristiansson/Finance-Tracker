from __future__ import annotations

import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterator
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel

from apps.api.handlers.import_files import download_import_file, list_import_files
from apps.api.models import (
    Account,
    ImportFile,
    TaxEvent,
    Transaction,
    TransactionImportBatch,
    TransactionLeg,
)
from apps.api.schemas import ImportFileDownloadResponse
from apps.api.services.imports.storage import ImportFileStorage
from apps.api.shared import (
    AccountType,
    CreatedSource,
    TaxEventType,
    TransactionType,
    configure_engine,
    get_default_user_id,
    get_engine,
    scope_session_to_user,
)


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
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


def _create_file_with_transactions() -> ImportFile:
    engine = get_engine()
    batch_id = uuid4()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        account = Account(
            name="Checking",
            account_type=AccountType.NORMAL,
            bank_import_type="seb",
            is_active=True,
        )
        session.add(account)
        session.flush()

        batch = TransactionImportBatch(id=batch_id, source_name="import")
        session.add(batch)
        session.flush()

        import_file = ImportFile(
            filename="statement.xlsx",
            batch_id=batch.id,
            account_id=account.id,
            row_count=2,
            error_count=0,
            status="stored",
            bank_type="seb",
            object_key="imports/test/object.xlsx",
            size_bytes=1200,
        )
        session.add(import_file)
        session.flush()

        transaction = Transaction(
            transaction_type=TransactionType.EXPENSE,
            description="Groceries",
            occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            import_batch_id=batch.id,
            import_file_id=import_file.id,
            created_source=CreatedSource.IMPORT,
        )
        session.add(transaction)
        session.flush()
        session.add(
            TransactionLeg(
                transaction_id=transaction.id,
                account_id=account.id,
                amount=Decimal("-100.00"),
            )
        )
        session.add(TaxEvent(transaction_id=transaction.id, event_type=TaxEventType.PAYMENT))
        session.commit()
        session.refresh(import_file)
        return import_file


def test_list_import_files_returns_file_metadata():
    created_file = _create_file_with_transactions()
    response = list_import_files({"requestContext": {"authorizer": {"jwt": {"claims": {}}}}}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["files"]
    file_payload = body["files"][0]
    assert file_payload["id"] == str(created_file.id)
    assert file_payload["row_count"] == created_file.row_count
    assert file_payload["transaction_ids"]
    assert file_payload["account_name"] == "Checking"


def test_download_import_file_returns_presigned_url(monkeypatch: pytest.MonkeyPatch):
    created_file = _create_file_with_transactions()

    class StubStorage:
        def create_download_url(self, *, key: str) -> str:
            return f"https://example.com/{key}"

    monkeypatch.setattr(ImportFileStorage, "from_env", classmethod(lambda cls: StubStorage()))

    response = download_import_file(
        {
            "body": json.dumps({"file_id": str(created_file.id)}),
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["url"].startswith("https://example.com/")


def test_download_import_file_requires_file_id() -> None:
    response = download_import_file(
        {
            "body": json.dumps({}),
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    assert response["statusCode"] == 400
    assert _json_body(response)["error"] == "file_id is required"


def test_download_import_file_handles_service_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    created_file = _create_file_with_transactions()

    class _FakeService:
        def __init__(self, *_args, **_kwargs) -> None:
            pass

        def build_download_url(self, _file_id):
            raise LookupError("missing")

    monkeypatch.setattr("apps.api.handlers.import_files.ImportFileService", _FakeService)
    lookup_resp = download_import_file(
        {
            "body": json.dumps({"file_id": str(created_file.id)}),
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    assert lookup_resp["statusCode"] == 404

    class _FakeServiceValue(_FakeService):
        def build_download_url(self, _file_id):
            raise ValueError("invalid")

    monkeypatch.setattr("apps.api.handlers.import_files.ImportFileService", _FakeServiceValue)
    value_resp = download_import_file(
        {
            "body": json.dumps({"file_id": str(created_file.id)}),
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    assert value_resp["statusCode"] == 400


def test_download_import_file_handles_validation_error(monkeypatch: pytest.MonkeyPatch) -> None:
    created_file = _create_file_with_transactions()
    validation_error = None
    try:
        ImportFileDownloadResponse.model_validate({})
    except ValidationError as exc:
        validation_error = exc
    assert validation_error is not None
    final_error: ValidationError = validation_error

    class _FakeService:
        def __init__(self, *_args, **_kwargs) -> None:
            pass

        def build_download_url(self, _file_id):
            raise final_error

    monkeypatch.setattr("apps.api.handlers.import_files.ImportFileService", _FakeService)
    response = download_import_file(
        {
            "body": json.dumps({"file_id": str(created_file.id)}),
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    assert response["statusCode"] == 400
