"""Serverless HTTP handlers for staged imports."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict
from uuid import UUID

from pydantic import ValidationError
from sqlmodel import select

from ..models import ImportFile, TransactionImportBatch
from ..schemas import (
    ImportCategorySuggestionRead,
    ImportCommitRequest,
    ImportCommitResponse,
    ImportDraftListResponse,
    ImportDraftSaveRequest,
    ImportDraftSaveResponse,
    ImportPersistFilesRequest,
    ImportPersistFilesResponse,
    ImportPreviewRequest,
    ImportPreviewResponse,
)
from ..services import ImportService
from ..services.imports.preview_builder import build_import_preview
from ..shared import session_scope
from ..shared.import_draft_state import (
    delete_import_draft_preview,
    get_import_draft_preview,
    list_import_draft_summaries,
    mark_import_draft_committed,
    save_import_draft_preview,
    save_import_draft_rows,
)
from ..shared.import_suggestions_state import (
    delete_import_suggestions_state,
    load_import_suggestions_state,
)
from .utils import (
    ensure_engine,
    extract_path_uuid,
    get_user_id,
    json_response,
    parse_body,
    reset_engine_state,
)

def reset_handler_state() -> None:
    reset_engine_state()


def preview_imports(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /imports/preview."""

    user_id = get_user_id(event)
    parsed_body = parse_body(event)

    try:
        data = ImportPreviewRequest.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    try:
        preview = build_import_preview(data)
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    except ValueError as exc:
        return json_response(400, {"error": str(exc)})

    response = ImportPreviewResponse.model_validate(preview).model_dump(mode="json")
    try:
        save_import_draft_preview(user_id=user_id, preview=response, note=data.note)
    except RuntimeError as exc:
        return json_response(503, {"error": str(exc)})
    return json_response(200, response)


def commit_imports(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /imports/commit."""

    ensure_engine()
    user_id = get_user_id(event)
    parsed_body = parse_body(event)

    try:
        data = ImportCommitRequest.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    try:
        with session_scope(user_id=user_id) as session:
            _seed_commit_batch_from_payload(payload=data, session=session)
            service = ImportService(session)
            result = service.commit_import(data)
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    except ValueError as exc:
        return json_response(400, {"error": str(exc)})

    mark_import_draft_committed(
        user_id=user_id,
        import_batch_id=result["import_batch_id"],
    )
    delete_import_suggestions_state(result["import_batch_id"])
    response = ImportCommitResponse.model_validate(result).model_dump(mode="json")
    return json_response(200, response)


def list_import_drafts(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP GET /imports/drafts."""

    user_id = get_user_id(event)
    try:
        drafts_payload = {"drafts": list_import_draft_summaries(user_id=user_id)}
    except RuntimeError as exc:
        return json_response(503, {"error": str(exc)})
    response = ImportDraftListResponse.model_validate(drafts_payload).model_dump(mode="json")
    return json_response(200, response)


def get_import_draft(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP GET /imports/{importBatchId}."""

    user_id = get_user_id(event)
    import_batch_id = extract_path_uuid(
        event,
        param_names=("importBatchId", "import_batch_id"),
    )
    if import_batch_id is None:
        return json_response(400, {"error": "importBatchId is required"})

    try:
        preview = get_import_draft_preview(
            user_id=user_id,
            import_batch_id=import_batch_id,
        )
    except RuntimeError as exc:
        return json_response(503, {"error": str(exc)})
    if preview is None:
        return json_response(404, {"error": "Import batch not found"})

    preview = _apply_import_suggestions_state(
        preview=preview,
        import_batch_id=import_batch_id,
        user_id=user_id,
    )
    response = ImportPreviewResponse.model_validate(preview).model_dump(mode="json")
    return json_response(200, response)


def save_import_draft(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /imports/{importBatchId}/draft."""

    user_id = get_user_id(event)
    import_batch_id = extract_path_uuid(
        event,
        param_names=("importBatchId", "import_batch_id"),
    )
    if import_batch_id is None:
        return json_response(400, {"error": "importBatchId is required"})

    parsed_body = parse_body(event)
    try:
        data = ImportDraftSaveRequest.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    if data.snapshot is not None:
        snapshot = data.snapshot.model_dump(mode="json")
        if str(snapshot.get("import_batch_id") or "") != str(import_batch_id):
            return json_response(400, {"error": "Snapshot import_batch_id mismatch"})
        try:
            save_import_draft_preview(user_id=user_id, preview=snapshot, note=data.note)
        except ValueError as exc:
            return json_response(400, {"error": str(exc)})
        except RuntimeError as exc:
            return json_response(503, {"error": str(exc)})

    try:
        updated_at = save_import_draft_rows(
            user_id=user_id,
            import_batch_id=import_batch_id,
            rows=data.model_dump(mode="json")["rows"],
        )
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    except ValueError as exc:
        return json_response(400, {"error": str(exc)})
    except RuntimeError as exc:
        return json_response(503, {"error": str(exc)})
    payload = {"import_batch_id": import_batch_id, "updated_at": updated_at}

    response = ImportDraftSaveResponse.model_validate(payload).model_dump(mode="json")
    return json_response(200, response)


def persist_import_files(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /imports/{importBatchId}/files."""

    ensure_engine()
    user_id = get_user_id(event)
    import_batch_id = extract_path_uuid(
        event,
        param_names=("importBatchId", "import_batch_id"),
    )
    if import_batch_id is None:
        return json_response(400, {"error": "importBatchId is required"})

    parsed_body = parse_body(event)
    try:
        data = ImportPersistFilesRequest.model_validate(parsed_body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    try:
        with session_scope(user_id=user_id) as session:
            service = ImportService(session)
            result = service.persist_import_files(
                import_batch_id=import_batch_id,
                payload=data,
            )
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    except ValueError as exc:
        return json_response(400, {"error": str(exc)})
    except RuntimeError as exc:
        return json_response(503, {"error": str(exc)})

    response = ImportPersistFilesResponse.model_validate(result).model_dump(mode="json")
    return json_response(200, response)


def delete_import_draft(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP DELETE /imports/{importBatchId}."""

    user_id = get_user_id(event)
    import_batch_id = extract_path_uuid(
        event,
        param_names=("importBatchId", "import_batch_id"),
    )
    if import_batch_id is None:
        return json_response(400, {"error": "importBatchId is required"})

    try:
        delete_import_draft_preview(
            user_id=user_id,
            import_batch_id=import_batch_id,
        )
        delete_import_suggestions_state(import_batch_id)
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    except ValueError as exc:
        return json_response(400, {"error": str(exc)})
    except RuntimeError as exc:
        return json_response(503, {"error": str(exc)})

    return json_response(200, {"import_batch_id": str(import_batch_id), "deleted": True})


def _seed_commit_batch_from_payload(
    *,
    payload: ImportCommitRequest,
    session: Any,
) -> None:
    if payload.import_batch_id is None:
        return

    import_batch_id = payload.import_batch_id
    batch = session.get(TransactionImportBatch, import_batch_id)
    now = datetime.now(timezone.utc)
    if batch is None:
        batch = TransactionImportBatch(
            id=import_batch_id,
            source_name=payload.note or "import",
            note=payload.note,
            created_at=now,
            updated_at=now,
        )
        session.add(batch)
        session.flush()
    else:
        batch.updated_at = now
        if payload.note is not None:
            batch.note = payload.note

    existing_files = {
        file.id: file
        for file in session.exec(select(ImportFile).where(ImportFile.batch_id == import_batch_id))
    }

    if payload.files:
        return

    file_rows: dict[UUID, list[Any]] = {}
    for row in payload.rows:
        if row.delete or row.file_id is None:
            continue
        file_rows.setdefault(row.file_id, []).append(row)

    referenced_file_ids = set(file_rows.keys())
    existing_file_ids = set(existing_files.keys())
    if existing_file_ids:
        unknown_file_ids = referenced_file_ids - existing_file_ids
        if unknown_file_ids:
            raise ValueError("Row references unknown import file")
    elif len(file_rows) > 1:
        raise ValueError("Rows reference multiple import files; include files payload")

    for file_id, rows in file_rows.items():
        if file_id in existing_files:
            continue
        first_row = rows[0]
        session.add(
            ImportFile(
                id=file_id,
                batch_id=import_batch_id,
                filename=f"import-{file_id}.xlsx",
                account_id=first_row.account_id,
                row_count=len(rows),
                error_count=0,
                status="draft",
                bank_type="",
                created_at=now,
                updated_at=now,
            )
        )


def _apply_import_suggestions_state(
    *,
    preview: dict[str, Any],
    import_batch_id: UUID,
    user_id: str,
) -> dict[str, Any]:
    state = load_import_suggestions_state(import_batch_id, user_id=user_id)
    if not state:
        return preview

    status = state.get("status")
    if isinstance(status, str) and status in {"not_started", "running", "completed", "failed"}:
        preview["suggestions_status"] = status

    if status != "completed":
        return preview

    suggestions = state.get("suggestions")
    if not isinstance(suggestions, list):
        return preview

    by_row_id: dict[str, ImportCategorySuggestionRead] = {}
    for item in suggestions:
        if not isinstance(item, ImportCategorySuggestionRead):
            continue
        by_row_id[str(item.id)] = item

    for row in preview.get("rows", []):
        if not isinstance(row, dict):
            continue
        suggestion = by_row_id.get(str(row.get("id")))
        if suggestion is None:
            continue
        row["suggested_category_id"] = suggestion.category_id
        row["suggested_confidence"] = suggestion.confidence
        row["suggested_reason"] = suggestion.reason

    return preview


__all__ = [
    "preview_imports",
    "commit_imports",
    "list_import_drafts",
    "get_import_draft",
    "save_import_draft",
    "persist_import_files",
    "delete_import_draft",
    "reset_handler_state",
]
