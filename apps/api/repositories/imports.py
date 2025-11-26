"""Repository for transaction import batches."""

from __future__ import annotations

from typing import Iterable, List, Optional

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..models import ImportError, ImportFile, TransactionImportBatch


class ImportRepository:
    """Persist and fetch transaction import batches."""

    def __init__(self, session: Session):
        self.session = session

    def create_batch(
        self,
        batch: TransactionImportBatch,
        files: Iterable[ImportFile],
        errors: Optional[Iterable[ImportError]] = None,
    ) -> TransactionImportBatch:
        file_list = list(files)
        error_list = list(errors or [])

        self.session.add(batch)
        self.session.flush()

        for file in file_list:
            file.batch_id = batch.id

        batch.files = file_list
        self.session.add_all(file_list)
        self.session.flush()

        if error_list:
            self.session.add_all(error_list)

        self.session.commit()
        self.session.refresh(batch)
        return batch

    def add_errors(self, errors: Iterable[ImportError]) -> None:
        error_list = list(errors)
        if not error_list:
            return
        self.session.add_all(error_list)
        self.session.commit()

    def list_batches(
        self,
        *,
        include_files: bool = False,
        include_errors: bool = False,
    ) -> List[TransactionImportBatch]:
        statement = select(TransactionImportBatch)
        if include_files:
            file_loader = selectinload(TransactionImportBatch.files)
            if include_errors:
                file_loader = file_loader.options(selectinload(ImportFile.errors))
            statement = statement.options(file_loader)

        result = self.session.exec(statement)
        return list(result.unique().all())


__all__ = ["ImportRepository"]
