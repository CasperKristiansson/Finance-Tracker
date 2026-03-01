from __future__ import annotations

from uuid import uuid4

from sqlmodel import Session

from apps.api.models import ImportErrorRecord, ImportFile, ImportRow, TransactionImportBatch
from apps.api.repositories.imports import ImportRepository


def _import_file(filename: str = "statement.xlsx") -> ImportFile:
    return ImportFile(
        batch_id=uuid4(),
        filename=filename,
        account_id=None,
        row_count=1,
        error_count=0,
        status="received",
        bank_type="seb",
    )


def test_create_batch_with_files_rows_and_errors(session: Session) -> None:
    repository = ImportRepository(session)
    batch = TransactionImportBatch(source_name="bank")
    import_file = _import_file()
    row = ImportRow(file_id=import_file.id, row_index=1, data={"amount": "-10.00"})
    error = ImportErrorRecord(file_id=import_file.id, row_number=1, message="bad row")

    created = repository.create_batch(
        batch=batch,
        files=[import_file],
        rows=[row],
        errors=[error],
    )

    assert created.id is not None
    loaded = repository.get_batch(
        created.id,
        include_files=True,
        include_errors=True,
        include_rows=True,
    )
    assert loaded is not None
    assert len(loaded.files) == 1
    assert len(loaded.files[0].rows) == 1
    assert len(loaded.files[0].errors) == 1


def test_add_rows_and_errors_noop_and_persist(session: Session) -> None:
    repository = ImportRepository(session)
    batch = repository.create_batch(
        batch=TransactionImportBatch(source_name="seed"),
        files=[_import_file("seed.xlsx")],
        rows=[],
    )
    file_id = batch.files[0].id

    repository.add_rows([])
    repository.add_errors([])

    repository.add_rows([ImportRow(file_id=file_id, row_index=2, data={"description": "ok"})])
    repository.add_errors([ImportErrorRecord(file_id=file_id, row_number=2, message="warn")])

    loaded = repository.get_batch(
        batch.id,
        include_files=True,
        include_errors=True,
        include_rows=True,
    )
    assert loaded is not None
    assert len(loaded.files[0].rows) == 1
    assert len(loaded.files[0].errors) == 1


def test_get_batch_and_list_batches_variants(session: Session) -> None:
    repository = ImportRepository(session)
    first = repository.create_batch(
        batch=TransactionImportBatch(source_name="a"),
        files=[_import_file("a.xlsx")],
        rows=[],
    )
    second = repository.create_batch(
        batch=TransactionImportBatch(source_name="b"),
        files=[_import_file("b.xlsx")],
        rows=[],
    )

    assert repository.get_batch(uuid4()) is None
    assert repository.get_batch(first.id) is not None

    batches_without_files = repository.list_batches()
    assert len(batches_without_files) >= 2

    batches_with_files = repository.list_batches(include_files=True, include_rows=True)
    ids = {batch.id for batch in batches_with_files}
    assert first.id in ids
    assert second.id in ids

    loaded_with_errors = repository.get_batch(
        first.id,
        include_files=True,
        include_errors=True,
        include_rows=False,
    )
    assert loaded_with_errors is not None

    batches_with_all = repository.list_batches(
        include_files=True,
        include_errors=True,
        include_rows=True,
    )
    assert any(batch.id == first.id for batch in batches_with_all)

    loaded_files_only = repository.get_batch(
        first.id,
        include_files=True,
        include_errors=False,
        include_rows=False,
    )
    assert loaded_files_only is not None
    assert len(loaded_files_only.files) == 1

    batches_files_only = repository.list_batches(
        include_files=True,
        include_errors=False,
        include_rows=False,
    )
    assert any(batch.id == first.id for batch in batches_files_only)
