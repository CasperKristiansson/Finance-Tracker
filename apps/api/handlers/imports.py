"""Serverless HTTP handlers for imports."""

from __future__ import annotations

from typing import Any, Dict, List

from pydantic import ValidationError

from ..schemas import (
    ImportBatchCreate,
    ImportBatchListResponse,
    ImportBatchRead,
    ImportErrorRead,
    ImportFileRead,
)
from ..services import ImportService
from ..shared import session_scope
from .utils import ensure_engine, json_response, parse_body, reset_engine_state


def reset_handler_state() -> None:
    reset_engine_state()


def create_import_batch(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    parsed_body = parse_body(event)

    try:
        data = ImportBatchCreate.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    with session_scope() as session:
        service = ImportService(session)
        batch, parsed_files = service.create_batch_with_files(data)
        payload = ImportBatchListResponse(
            imports=[_to_batch_read(batch, parsed_files, include_preview=True)]
        )

    return json_response(201, payload.model_dump(mode="json"))


def list_import_batches(_event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    ensure_engine()
    with session_scope() as session:
        service = ImportService(session)
        batches = service.list_imports()
        payload = ImportBatchListResponse(imports=[_to_batch_read(batch) for batch in batches])
    return json_response(200, payload.model_dump(mode="json"))


def _to_batch_read(
    batch, parsed_files: List[Any] | None = None, include_preview: bool = False
) -> ImportBatchRead:
    files: List[ImportFileRead] = []
    file_models = batch.files or []

    for idx, file_model in enumerate(file_models):
        parsed = parsed_files[idx] if parsed_files and idx < len(parsed_files) else None

        errors = (
            parsed.errors
            if parsed
            else [(error.row_number, error.message) for error in getattr(file_model, "errors", [])]
        )
        error_payloads = [ImportErrorRead(row_number=row, message=msg) for row, msg in errors]

        preview_rows = parsed.preview_rows if (include_preview and parsed) else []

        files.append(
            ImportFileRead(
                **file_model.model_dump(mode="python", exclude={"errors"}),
                preview_rows=preview_rows,
                errors=error_payloads,
            )
        )

    total_rows = sum(file.row_count for file in file_models)
    total_errors = sum(file.error_count for file in file_models)
    status = "ready"
    if total_errors:
        status = "error"
    elif not total_rows:
        status = "empty"
    elif all(file.status == "imported" for file in file_models):
        status = "imported"

    return ImportBatchRead(
        **batch.model_dump(mode="python", exclude={"files"}),
        file_count=len(file_models),
        total_rows=total_rows,
        total_errors=total_errors,
        status=status,
        files=files or None,
    )


__all__ = [
    "create_import_batch",
    "list_import_batches",
    "reset_handler_state",
]
