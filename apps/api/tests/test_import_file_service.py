from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlmodel import Session

from apps.api.models import Account, ImportFile, Transaction, TransactionImportBatch, TransactionLeg
from apps.api.services.imports.files import ImportFileService
from apps.api.shared import AccountType, CreatedSource, TransactionType


def _seed_import_file(
    session: Session, *, bank_type: str = "seb", object_key: str | None = "k"
) -> ImportFile:
    account = Account(name="Checking", account_type=AccountType.NORMAL, is_active=True)
    session.add(account)
    session.flush()
    batch = TransactionImportBatch(source_name="import")
    session.add(batch)
    session.flush()
    import_file = ImportFile(
        batch_id=batch.id,
        filename="statement.xlsx",
        account_id=account.id,
        row_count=1,
        error_count=0,
        status="stored",
        bank_type=bank_type,
        object_key=object_key,
    )
    session.add(import_file)
    session.flush()
    tx = Transaction(
        transaction_type=TransactionType.EXPENSE,
        description="Coffee",
        occurred_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        posted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        import_batch_id=batch.id,
        import_file_id=import_file.id,
        created_source=CreatedSource.IMPORT,
    )
    session.add(tx)
    session.flush()
    session.add(
        TransactionLeg(transaction_id=tx.id, account_id=account.id, amount=Decimal("-10.00"))
    )
    session.commit()
    session.refresh(import_file)
    return import_file


def test_list_files_handles_unknown_bank_type(session: Session) -> None:
    _seed_import_file(session, bank_type="unknown")
    payload = ImportFileService(session).list_files()
    assert payload["files"]
    assert payload["files"][0]["bank_import_type"] is None


def test_build_download_url_happy_path_and_errors(session: Session) -> None:
    import_file = _seed_import_file(session, object_key="imports/key.xlsx")

    class _Storage:
        def create_download_url(self, *, key: str) -> str:
            return f"https://example.com/{key}"

    service = ImportFileService(session, storage=_Storage())  # type: ignore[arg-type]
    url_payload = service.build_download_url(str(import_file.id))
    assert url_payload["url"].startswith("https://example.com/")

    with pytest.raises(LookupError, match="File not found"):
        service.build_download_url(str(uuid4()))

    missing_object = _seed_import_file(session, object_key=None)
    with pytest.raises(ValueError, match="File is not stored"):
        service.build_download_url(missing_object.id)
