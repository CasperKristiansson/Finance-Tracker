"""Service helpers for persisted import files."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, cast
from uuid import UUID

from sqlalchemy import desc
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ...models import Account, ImportFile, Transaction
from ...schemas import ImportFileDownloadResponse, ImportFileListResponse, ImportFileRead
from ...shared import BankImportType
from .storage import ImportFileStorage


class ImportFileService:
    """Retrieve and serve stored import files."""

    def __init__(self, session: Session, *, storage: Optional[ImportFileStorage] = None):
        self.session = session
        self.storage = storage

    def list_files(self) -> Dict[str, Any]:
        transactions_attr = cast(Any, ImportFile.transactions)
        account_attr = cast(Any, ImportFile.account)
        statement = (
            select(ImportFile)
            .options(
                selectinload(transactions_attr).load_only(cast(Any, Transaction.id)),
                selectinload(account_attr).load_only(
                    cast(Any, Account.id), cast(Any, Account.name)
                ),
            )
            .order_by(desc(cast(Any, ImportFile.created_at)))
        )
        files: List[ImportFile] = list(self.session.exec(statement).unique().all())
        payload: List[ImportFileRead] = []
        for file in files:
            account = getattr(file, "account", None)
            bank_type: BankImportType | None = None
            try:
                bank_type = BankImportType(file.bank_type) if file.bank_type else None
            except ValueError:
                bank_type = None
            payload.append(
                ImportFileRead(
                    id=file.id,
                    filename=file.filename,
                    account_id=file.account_id,
                    account_name=account.name if account else None,
                    bank_import_type=bank_type,
                    row_count=file.row_count,
                    error_count=file.error_count,
                    transaction_ids=[tx.id for tx in file.transactions or []],
                    import_batch_id=file.batch_id,
                    size_bytes=file.size_bytes,
                    content_type=file.content_type,
                    uploaded_at=file.created_at,
                    status=file.status,
                )
            )

        return ImportFileListResponse(files=payload).model_dump(mode="python")

    def build_download_url(self, file_id: UUID | str) -> Dict[str, str]:
        if isinstance(file_id, str):
            file_id = UUID(file_id)

        file = self.session.get(ImportFile, file_id)
        if file is None:
            raise LookupError("File not found")
        if not file.object_key:
            raise ValueError("File is not stored")

        storage = self.storage or ImportFileStorage.from_env()
        url = storage.create_download_url(key=file.object_key)
        return ImportFileDownloadResponse(url=url).model_dump(mode="python")


__all__ = ["ImportFileService"]
