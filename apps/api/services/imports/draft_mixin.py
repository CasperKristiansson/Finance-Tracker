"""Draft-management mixin for import preview flows."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, cast
from uuid import UUID

from sqlalchemy import desc, func, or_
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ...models import (
    Category,
    ImportErrorRecord,
    ImportFile,
    ImportRow,
    Transaction,
    TransactionImportBatch,
    TransactionLeg,
)
from ...schemas import (
    ImportCategorySuggestionRead,
    ImportDraftListResponse,
    ImportDraftRead,
    ImportDraftSaveRequest,
    ImportDraftSaveResponse,
    ImportPreviewResponse,
)
from ...shared import BankImportType

_AI_SUGGESTIONS_STATUS_KEY = "ai_suggestions_status"
_AI_SUGGESTIONS_ERROR_KEY = "ai_suggestions_error"
_AI_SUGGESTIONS_NOT_STARTED = "not_started"
_AI_SUGGESTIONS_RUNNING = "running"
_AI_SUGGESTIONS_COMPLETED = "completed"
_AI_SUGGESTIONS_FAILED = "failed"


class ImportDraftMixin:
    """Operations for import preview drafts and suggestion state."""

    session: Session

    def _coerce_bank_import_type(self, value: Any) -> BankImportType | None:
        raise NotImplementedError

    def _category_lookup_by_id(
        self, *, category_ids: set[UUID] | None = None
    ) -> dict[UUID, Category]:
        raise NotImplementedError

    def list_import_drafts(self) -> dict[str, Any]:
        """Return incomplete draft import sessions for the current user."""

        files_attr = cast(Any, TransactionImportBatch.files)
        statement = (
            select(TransactionImportBatch)
            .options(selectinload(files_attr))
            .order_by(desc(cast(Any, TransactionImportBatch.updated_at)))
        )
        batches = list(self.session.exec(statement).all())

        drafts: list[ImportDraftRead] = []
        for batch in batches:
            files = list(batch.files or [])
            if not files:
                continue
            if self._batch_has_transactions(batch.id):
                continue

            drafts.append(
                ImportDraftRead(
                    import_batch_id=batch.id,
                    note=batch.note,
                    created_at=batch.created_at,
                    updated_at=batch.updated_at,
                    file_count=len(files),
                    row_count=sum(file.row_count or 0 for file in files),
                    error_count=sum(file.error_count or 0 for file in files),
                    file_names=[file.filename for file in files],
                )
            )

        return ImportDraftListResponse(drafts=drafts).model_dump(mode="python")

    def get_import_draft(self, import_batch_id: UUID) -> dict[str, Any]:
        """Load a persisted import draft and return it as preview payload."""

        batch = self._load_batch(import_batch_id)
        return self._build_preview_from_batch(batch)

    def get_import_suggestions_status(self, import_batch_id: UUID) -> str:
        """Return persisted Bedrock suggestion status for a draft batch."""

        batch = self._load_batch(import_batch_id)
        rows = self._rows_for_batch(batch)
        return self._resolve_suggestions_status(rows)

    def mark_import_suggestions_running(self, import_batch_id: UUID) -> None:
        """Mark a draft batch as currently processing Bedrock suggestions."""

        batch = self._load_batch(import_batch_id)
        if self._batch_has_transactions(batch.id):
            raise ValueError("Import batch is already committed")
        self._set_suggestions_status(batch, status=_AI_SUGGESTIONS_RUNNING)

    def persist_import_suggestions(
        self,
        import_batch_id: UUID,
        suggestions: list[ImportCategorySuggestionRead],
    ) -> None:
        """Persist completed Bedrock suggestions for a draft batch."""

        batch = self._load_batch(import_batch_id)
        if self._batch_has_transactions(batch.id):
            raise ValueError("Import batch is already committed")

        rows = self._rows_for_batch(batch)
        suggestions_by_row_id = {suggestion.id: suggestion for suggestion in suggestions}
        category_ids = {
            suggestion.category_id
            for suggestion in suggestions
            if suggestion.category_id is not None
        }
        category_lookup = (
            self._category_lookup_by_id(category_ids=category_ids) if category_ids else {}
        )
        now = datetime.now(timezone.utc)

        for row in rows:
            suggestion = suggestions_by_row_id.get(row.id)
            row_data = dict(row.data or {})
            if suggestion is not None:
                category = (
                    category_lookup.get(suggestion.category_id)
                    if suggestion.category_id is not None
                    else None
                )
                row.suggested_category = category.name if category is not None else None
                row.suggested_confidence = suggestion.confidence
                row.suggested_reason = suggestion.reason
                row_data["suggested_category_id"] = (
                    str(suggestion.category_id) if suggestion.category_id is not None else None
                )
            row_data[_AI_SUGGESTIONS_STATUS_KEY] = _AI_SUGGESTIONS_COMPLETED
            row_data.pop(_AI_SUGGESTIONS_ERROR_KEY, None)
            row.data = row_data
            row.updated_at = now

        batch.updated_at = now

    def mark_import_suggestions_failed(
        self,
        import_batch_id: UUID,
        *,
        error: str | None = None,
    ) -> None:
        """Persist a failed Bedrock suggestion run for a draft batch."""

        batch = self._load_batch(import_batch_id)
        if self._batch_has_transactions(batch.id):
            raise ValueError("Import batch is already committed")
        self._set_suggestions_status(
            batch,
            status=_AI_SUGGESTIONS_FAILED,
            error=error,
        )

    def save_import_draft(
        self, import_batch_id: UUID, payload: ImportDraftSaveRequest
    ) -> dict[str, Any]:
        """Persist in-progress import row edits for a draft import batch."""

        if not payload.rows:
            raise ValueError("No rows provided")

        batch = self._load_batch(import_batch_id)
        if self._batch_has_transactions(batch.id):
            raise ValueError("Import batch is already committed")

        now = datetime.now(timezone.utc)
        file_by_id = {file.id: file for file in batch.files or []}
        if not file_by_id:
            raise LookupError("Import batch not found")

        existing_rows_stmt = (
            select(ImportRow)
            .join(ImportFile, cast(Any, ImportRow.file_id) == cast(Any, ImportFile.id))
            .where(cast(Any, ImportFile.batch_id) == import_batch_id)
        )
        existing_rows = list(self.session.exec(existing_rows_stmt).all())
        existing_by_id = {row.id: row for row in existing_rows}
        touched_row_ids: set[UUID] = set()
        row_count_by_file: dict[UUID, int] = {file_id: 0 for file_id in file_by_id}

        for index, draft_row in enumerate(payload.rows, start=1):
            persisted = existing_by_id.get(draft_row.id)
            file_id = self._resolve_draft_row_file_id(
                row=draft_row,
                file_by_id=file_by_id,
                persisted=persisted,
            )
            if persisted is not None and persisted.file_id != file_id:
                persisted.file_id = file_id
            if persisted is None:
                persisted = ImportRow(
                    id=draft_row.id,
                    file_id=file_id,
                    row_index=index,
                    data={},
                )
                self.session.add(persisted)

            row_count_by_file[file_id] = row_count_by_file.get(file_id, 0) + 1
            persisted.row_index = row_count_by_file[file_id]
            persisted.updated_at = now

            current_data = dict(persisted.data or {})
            current_data["account_id"] = str(draft_row.account_id)
            current_data["occurred_at"] = draft_row.occurred_at
            current_data["amount"] = draft_row.amount
            current_data["description"] = draft_row.description
            current_data["draft"] = draft_row.model_dump(mode="json")
            if draft_row.id not in existing_by_id:
                current_data["is_draft_row"] = True
            persisted.data = current_data
            touched_row_ids.add(draft_row.id)

        for stale_row in existing_rows:
            if stale_row.id in touched_row_ids:
                continue
            row_data = stale_row.data or {}
            if bool(row_data.get("is_draft_row")):
                self.session.delete(stale_row)
                continue
            if row_data.get("draft") is not None:
                next_data = dict(row_data)
                next_data.pop("draft", None)
                stale_row.data = next_data
                stale_row.updated_at = now

        for file_id, file_row_count in row_count_by_file.items():
            file_model = file_by_id[file_id]
            file_model.row_count = file_row_count
            file_model.updated_at = now

        batch.updated_at = now

        return ImportDraftSaveResponse(
            import_batch_id=batch.id,
            updated_at=batch.updated_at,
        ).model_dump(mode="python")

    def delete_import_draft(self, import_batch_id: UUID) -> None:
        """Delete an unfinished import draft session."""

        batch = self._load_batch(import_batch_id)
        if self._batch_has_transactions(batch.id):
            raise ValueError("Cannot delete a committed import batch")
        self.session.delete(batch)

    def _persist_preview_batch(
        self,
        *,
        note: str | None,
        files: list[dict[str, Any]],
        rows: list[dict[str, Any]],
    ) -> UUID:
        now = datetime.now(timezone.utc)
        batch = TransactionImportBatch(
            source_name="import_draft",
            note=note,
            created_at=now,
            updated_at=now,
        )
        self.session.add(batch)
        self.session.flush()

        file_models: list[ImportFile] = []
        error_models: list[ImportErrorRecord] = []
        for file_payload in files:
            bank_type = file_payload.get("bank_import_type")
            bank_type_text = bank_type.value if isinstance(bank_type, BankImportType) else ""
            file_id = cast(UUID, file_payload["id"])
            file_model = ImportFile(
                id=file_id,
                batch_id=batch.id,
                filename=str(file_payload["filename"]),
                account_id=cast(UUID, file_payload["account_id"]),
                row_count=int(file_payload.get("row_count") or 0),
                error_count=int(file_payload.get("error_count") or 0),
                status="draft",
                bank_type=bank_type_text,
                created_at=now,
                updated_at=now,
            )
            file_models.append(file_model)

            for error in file_payload.get("errors") or []:
                error_models.append(
                    ImportErrorRecord(
                        file_id=file_id,
                        row_number=int(error.get("row_number") or 0),
                        message=str(error.get("message") or "Unknown import error"),
                    )
                )

        if file_models:
            self.session.add_all(file_models)
        if error_models:
            self.session.add_all(error_models)

        row_models: list[ImportRow] = []
        for row_payload in rows:
            row_models.append(
                ImportRow(
                    id=cast(UUID, row_payload["id"]),
                    file_id=cast(UUID, row_payload["file_id"]),
                    row_index=int(row_payload["row_index"]),
                    data={
                        "account_id": str(row_payload["account_id"]),
                        "occurred_at": str(row_payload["occurred_at"]),
                        "amount": str(row_payload["amount"]),
                        "description": str(row_payload["description"]),
                        _AI_SUGGESTIONS_STATUS_KEY: _AI_SUGGESTIONS_NOT_STARTED,
                        "suggested_category_id": (
                            str(row_payload["suggested_category_id"])
                            if row_payload.get("suggested_category_id")
                            else None
                        ),
                    },
                    suggested_category=row_payload.get("suggested_category_name"),
                    suggested_confidence=row_payload.get("suggested_confidence"),
                    suggested_reason=row_payload.get("suggested_reason"),
                    transfer_match=row_payload.get("transfer_match"),
                    rule_applied=bool(row_payload.get("rule_applied")),
                    rule_type=row_payload.get("rule_type"),
                    rule_summary=row_payload.get("rule_summary"),
                    created_at=now,
                    updated_at=now,
                )
            )

        if row_models:
            self.session.add_all(row_models)

        return batch.id

    def _load_batch(self, import_batch_id: UUID) -> TransactionImportBatch:
        files_attr = cast(Any, TransactionImportBatch.files)
        statement = (
            select(TransactionImportBatch)
            .where(cast(Any, TransactionImportBatch.id) == import_batch_id)
            .options(
                selectinload(files_attr).selectinload(cast(Any, ImportFile.errors)),
                selectinload(files_attr).selectinload(cast(Any, ImportFile.rows)),
            )
        )
        batch = self.session.exec(statement).one_or_none()
        if batch is None or not batch.files:
            raise LookupError("Import batch not found")
        return batch

    def _batch_has_transactions(self, import_batch_id: UUID) -> bool:
        statement = (
            select(cast(Any, Transaction.id))
            .where(cast(Any, Transaction.import_batch_id) == import_batch_id)
            .limit(1)
        )
        return self.session.exec(statement).first() is not None

    def _build_preview_from_batch(self, batch: TransactionImportBatch) -> dict[str, Any]:
        category_lookup_by_id = self._category_lookup_by_id()

        response_files: list[dict[str, Any]] = []
        response_rows: list[dict[str, Any]] = []
        rows_by_account: dict[UUID, list[tuple[UUID, str]]] = {}

        files = sorted(
            list(batch.files or []),
            key=lambda file: (str(file.created_at), str(file.id)),
        )
        for file in files:
            file_rows = sorted(
                list(file.rows or []),
                key=lambda row: (row.row_index, str(row.id)),
            )
            file_errors = sorted(
                list(file.errors or []),
                key=lambda err: (err.row_number, str(err.id)),
            )
            bank_import_type = self._coerce_bank_import_type(file.bank_type)

            preview_rows: list[dict[str, Any]] = []
            for row in file_rows[:5]:
                data = row.data or {}
                preview_row: dict[str, Any] = {
                    "date": data.get("occurred_at") or data.get("date") or "",
                    "description": data.get("description") or "",
                    "amount": data.get("amount") or "",
                }
                if row.suggested_category:
                    preview_row["suggested_category"] = row.suggested_category
                if row.suggested_confidence is not None:
                    preview_row["suggested_confidence"] = float(row.suggested_confidence)
                if row.suggested_reason:
                    preview_row["suggested_reason"] = row.suggested_reason
                if row.transfer_match:
                    preview_row["transfer_match"] = row.transfer_match
                if row.rule_applied:
                    preview_row["rule_applied"] = True
                    preview_row["rule_type"] = row.rule_type
                    preview_row["rule_summary"] = row.rule_summary
                preview_rows.append(preview_row)

            response_files.append(
                {
                    "id": file.id,
                    "filename": file.filename,
                    "account_id": file.account_id,
                    "bank_import_type": bank_import_type,
                    "row_count": file.row_count,
                    "error_count": file.error_count,
                    "errors": [
                        {"row_number": err.row_number, "message": err.message}
                        for err in file_errors
                    ],
                    "preview_rows": preview_rows,
                }
            )

            for row in file_rows:
                row_data = dict(row.data or {})
                account_id = self._coerce_uuid(row_data.get("account_id")) or file.account_id
                if account_id is None:
                    continue
                occurred_at = str(
                    row_data.get("occurred_at")
                    or row_data.get("date")
                    or row_data.get("posted_at")
                    or ""
                )
                amount = str(row_data.get("amount") or "")
                description = str(row_data.get("description") or "")
                rows_by_account.setdefault(account_id, []).append((row.id, description))
                suggested_category_id = self._coerce_uuid(row_data.get("suggested_category_id"))

                response_rows.append(
                    {
                        "id": row.id,
                        "file_id": file.id,
                        "row_index": row.row_index,
                        "account_id": account_id,
                        "occurred_at": occurred_at,
                        "amount": amount,
                        "description": description,
                        "suggested_category_id": suggested_category_id,
                        "suggested_category_name": row.suggested_category,
                        "suggested_confidence": (
                            float(row.suggested_confidence)
                            if row.suggested_confidence is not None
                            else None
                        ),
                        "suggested_reason": row.suggested_reason,
                        "transfer_match": row.transfer_match,
                        "rule_applied": row.rule_applied,
                        "rule_type": row.rule_type,
                        "rule_summary": row.rule_summary,
                        "draft": row_data.get("draft"),
                    }
                )

        response_accounts: list[dict[str, Any]] = []
        for account_id, row_entries in rows_by_account.items():
            response_accounts.append(
                self._build_account_context(
                    account_id=account_id,
                    row_entries=row_entries,
                    category_lookup_by_id=category_lookup_by_id,
                )
            )

        suggestions_status = self._resolve_suggestions_status(self._rows_for_batch(batch))
        return ImportPreviewResponse.model_validate(
            {
                "import_batch_id": batch.id,
                "suggestions_status": suggestions_status,
                "files": response_files,
                "rows": response_rows,
                "accounts": response_accounts,
            }
        ).model_dump(mode="python")

    def _rows_for_batch(self, batch: TransactionImportBatch) -> list[ImportRow]:
        rows: list[ImportRow] = []
        for file in batch.files or []:
            rows.extend(list(file.rows or []))
        return rows

    def _resolve_suggestions_status(self, rows: list[ImportRow]) -> str:
        statuses = {
            str((row.data or {}).get(_AI_SUGGESTIONS_STATUS_KEY)).strip().lower()
            for row in rows
            if (row.data or {}).get(_AI_SUGGESTIONS_STATUS_KEY) is not None
        }
        if _AI_SUGGESTIONS_RUNNING in statuses:
            return _AI_SUGGESTIONS_RUNNING
        if _AI_SUGGESTIONS_FAILED in statuses:
            return _AI_SUGGESTIONS_FAILED
        if _AI_SUGGESTIONS_COMPLETED in statuses:
            return _AI_SUGGESTIONS_COMPLETED
        return _AI_SUGGESTIONS_NOT_STARTED

    def _set_suggestions_status(
        self,
        batch: TransactionImportBatch,
        *,
        status: str,
        error: str | None = None,
    ) -> None:
        rows = self._rows_for_batch(batch)
        now = datetime.now(timezone.utc)
        error_text = (error or "").strip()[:220] or None
        for row in rows:
            row_data = dict(row.data or {})
            row_data[_AI_SUGGESTIONS_STATUS_KEY] = status
            if status == _AI_SUGGESTIONS_FAILED and error_text:
                row_data[_AI_SUGGESTIONS_ERROR_KEY] = error_text
            else:
                row_data.pop(_AI_SUGGESTIONS_ERROR_KEY, None)
            row.data = row_data
            row.updated_at = now
        batch.updated_at = now

    def _resolve_draft_row_file_id(
        self,
        *,
        row: Any,
        file_by_id: dict[UUID, ImportFile],
        persisted: ImportRow | None,
    ) -> UUID:
        if row.file_id is not None:
            file_id = row.file_id
            if file_id not in file_by_id:
                raise ValueError("Draft row references unknown file")
            return file_id
        if persisted is not None:
            return persisted.file_id
        if len(file_by_id) == 1:
            return next(iter(file_by_id.keys()))
        raise ValueError("Draft row must include file_id")

    def _coerce_uuid(self, value: Any) -> UUID | None:
        if isinstance(value, UUID):
            return value
        if value is None:
            return None
        try:
            return UUID(str(value))
        except (TypeError, ValueError):
            return None

    def _build_account_context(
        self,
        *,
        account_id: UUID,
        row_entries: list[tuple[UUID, str]],
        category_lookup_by_id: dict[UUID, Category],
        latest_limit: int = 40,
        similar_limit: int = 60,
        per_row_limit: int = 5,
    ) -> dict[str, Any]:
        recent = self._latest_transactions_for_account(account_id, limit=latest_limit)

        tokens: list[str] = []
        seen_tokens: set[str] = set()
        for _row_id, description in row_entries:
            for token in self._merchant_tokens(description):
                if token in seen_tokens:
                    continue
                seen_tokens.add(token)
                tokens.append(token)
                if len(tokens) >= 8:
                    break
            if len(tokens) >= 8:
                break

        similar: list[Transaction] = []
        if tokens:
            similar = self._similar_transactions_for_account(
                account_id,
                merchant_tokens=tokens,
                limit=similar_limit,
            )

        def tx_payload(tx: Transaction) -> dict[str, Any]:
            category = category_lookup_by_id.get(tx.category_id) if tx.category_id else None
            return {
                "id": tx.id,
                "account_id": account_id,
                "occurred_at": tx.occurred_at.isoformat(),
                "description": tx.description or "",
                "category_id": tx.category_id,
                "category_name": category.name if category else None,
            }

        recent_payloads = [tx_payload(tx) for tx in recent[:latest_limit]]
        similar_payloads = [tx_payload(tx) for tx in similar[:similar_limit]]

        similar_by_row: list[dict[str, Any]] = []
        similar_candidates = similar
        for row_id, description in row_entries:
            row_tokens = self._merchant_tokens(description)
            if not row_tokens:
                similar_by_row.append({"row_id": row_id, "transaction_ids": []})
                continue
            matches: list[UUID] = []
            for tx in similar_candidates:
                tx_desc = (tx.description or "").lower()
                if not tx_desc:
                    continue
                if any(token in tx_desc for token in row_tokens):
                    matches.append(tx.id)
                if len(matches) >= per_row_limit:
                    break
            similar_by_row.append({"row_id": row_id, "transaction_ids": matches})

        return {
            "account_id": account_id,
            "recent_transactions": recent_payloads,
            "similar_transactions": similar_payloads,
            "similar_by_row": similar_by_row,
        }

    def _latest_transactions_for_account(
        self, account_id: UUID, *, limit: int
    ) -> list[Transaction]:
        statement = (
            select(Transaction)
            .join(TransactionLeg, cast(Any, TransactionLeg.transaction_id) == Transaction.id)
            .where(cast(Any, TransactionLeg.account_id) == account_id)
            .where(cast(Any, Transaction.description).is_not(None))
            .order_by(cast(Any, Transaction.occurred_at).desc())
            .limit(limit)
        )
        return list(self.session.exec(statement).all())

    def _similar_transactions_for_account(
        self,
        account_id: UUID,
        *,
        merchant_tokens: list[str],
        limit: int,
    ) -> list[Transaction]:
        if not merchant_tokens:
            return []

        patterns = [f"%{token}%" for token in merchant_tokens]
        lowered = func.lower(cast(Any, Transaction.description))
        conditions = [lowered.like(pattern) for pattern in patterns]
        statement = (
            select(Transaction)
            .join(TransactionLeg, cast(Any, TransactionLeg.transaction_id) == Transaction.id)
            .where(cast(Any, TransactionLeg.account_id) == account_id)
            .where(cast(Any, Transaction.category_id).is_not(None))
            .where(cast(Any, Transaction.description).is_not(None))
            .where(or_(*conditions))
            .order_by(cast(Any, Transaction.occurred_at).desc())
            .limit(limit)
        )
        return list(self.session.exec(statement).all())

    def _merchant_tokens(self, description: str) -> list[str]:
        cleaned = re.sub(r"[^a-zA-Z0-9\\s]", " ", (description or "")).lower()
        parts = [part for part in cleaned.split() if len(part) >= 4]
        stop = {"card", "konto", "betalning", "payment", "purchase", "ab", "se", "sweden"}
        parts = [part for part in parts if part not in stop]
        return parts[:2]
