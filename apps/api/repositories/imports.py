"""Repository for transaction import batches."""

from __future__ import annotations

from typing import Any, Iterable, List, Optional
from uuid import UUID

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..models import ImportErrorRecord, ImportFile, ImportRow, TransactionImportBatch


class ImportRepository:
    """Persist and fetch transaction import batches."""

    def __init__(self, session: Session):
        self.session = session

    def create_batch(
        self,
        batch: TransactionImportBatch,
        files: Iterable[ImportFile],
        rows: Iterable[ImportRow],
        errors: Optional[Iterable[ImportErrorRecord]] = None,
    ) -> TransactionImportBatch:
        file_list = list(files)
        row_list = list(rows)
        error_list = list(errors or [])

        self.session.add(batch)
        self.session.flush()

        for file in file_list:
            file.batch_id = batch.id

        batch.files = file_list
        self.session.add_all(file_list)
        self.session.flush()

        for row in row_list:
            self.session.add(row)

        if error_list:
            self.session.add_all(error_list)

        self.session.commit()
        self.session.refresh(batch)
        return batch

    def add_errors(self, errors: Iterable[ImportErrorRecord]) -> None:
        error_list: list[ImportErrorRecord] = list(errors)
        if not error_list:
            return
        self.session.add_all(error_list)
        self.session.commit()

    def add_rows(self, rows: Iterable[ImportRow]) -> None:
        row_list = list(rows)
        if not row_list:
            return
        self.session.add_all(row_list)
        self.session.commit()

    def get_batch(
        self,
        batch_id: UUID,
        *,
        include_files: bool = False,
        include_errors: bool = False,
        include_rows: bool = False,
    ) -> Optional[TransactionImportBatch]:
        statement = select(TransactionImportBatch).where(TransactionImportBatch.id == batch_id)
        if include_files:
            statement = statement.options(
                selectinload(TransactionImportBatch.files)  # type: ignore[arg-type]
            )
            if include_errors:
                statement = statement.options(
                    selectinload(TransactionImportBatch.files)  # type: ignore[arg-type]
                    .selectinload(ImportFile.errors)  # type: ignore[arg-type]
                )
            if include_rows:
                statement = statement.options(
                    selectinload(TransactionImportBatch.files)  # type: ignore[arg-type]
                    .selectinload(ImportFile.rows)  # type: ignore[arg-type]
                )

        result = self.session.exec(statement).one_or_none()
        return result

    def list_batches(
        self,
        *,
        include_files: bool = False,
        include_errors: bool = False,
        include_rows: bool = False,
    ) -> List[TransactionImportBatch]:
        statement = select(TransactionImportBatch)
        if include_files:
            statement = statement.options(
                selectinload(TransactionImportBatch.files)  # type: ignore[arg-type]
            )
            if include_errors:
                statement = statement.options(
                    selectinload(TransactionImportBatch.files)  # type: ignore[arg-type]
                    .selectinload(ImportFile.errors)  # type: ignore[arg-type]
                )
            if include_rows:
                statement = statement.options(
                    selectinload(TransactionImportBatch.files)  # type: ignore[arg-type]
                    .selectinload(ImportFile.rows)  # type: ignore[arg-type]
                )

        result = self.session.exec(statement)
        return list(result.unique().all())


__all__ = ["ImportRepository"]
