"""Service layer for staged imports and atomic commit."""

from __future__ import annotations

import base64
import binascii
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, cast
from uuid import UUID, uuid4

from sqlalchemy import func
from sqlmodel import Session, select

from ...models import (
    Account,
    Category,
    ImportFile,
    ImportRule,
    TaxEvent,
    Transaction,
    TransactionImportBatch,
    TransactionLeg,
)
from ...schemas import (
    ImportCommitRequest,
    ImportCommitResponse,
    ImportPersistFilesRequest,
    ImportPersistFilesResponse,
    ImportPreviewRequest,
    ImportPreviewResponse,
)
from ...shared import (
    AccountType,
    BankImportType,
    CreatedSource,
    TaxEventType,
    TransactionType,
)
from ..transaction import TransactionService
from .draft_mixin import ImportDraftMixin
from .parsers import parse_bank_rows
from .storage import ImportFileStorage
from .suggestions import (
    CategorySuggestion,
    RuleMatch,
    suggest_categories,
)
from .transfers import match_transfers
from .utils import is_date_like, is_decimal, parse_iso_date, safe_decimal


class ImportService(ImportDraftMixin):
    """Coordinates staged import preview drafts and atomic commit."""

    def __init__(self, session: Session, *, storage: ImportFileStorage | None = None):
        self.session = session
        self.storage = storage

    def preview_import(self, payload: ImportPreviewRequest) -> dict[str, Any]:
        """Parse files, persist draft state, and return import preview data."""

        category_lookup_by_id = self._category_lookup_by_id()
        category_by_name = self._category_lookup()

        response_files: list[dict[str, Any]] = []
        response_rows: list[dict[str, Any]] = []
        rows_by_account: dict[UUID, list[tuple[UUID, str]]] = {}

        for file_payload in payload.files:
            file_id = uuid4()
            file_errors: list[tuple[int, str]] = []
            rows: list[dict[str, Any]] = []
            bank_import_type: BankImportType | None = None

            account = self.session.get(Account, file_payload.account_id)
            if account is None:
                file_errors.append((0, "Account not found"))
            else:
                bank_import_type = self._coerce_bank_import_type(account.bank_import_type)
                if bank_import_type is None:
                    file_errors.append((0, "Account has no bank import type configured"))
                else:
                    decoded = self._decode_base64(file_payload.content_base64)
                    rows, parse_errors = parse_bank_rows(
                        filename=file_payload.filename,
                        content=decoded,
                        bank_type=bank_import_type,
                    )
                    file_errors.extend(parse_errors)

            column_map: dict[str, str] | None = (
                {"date": "date", "description": "description", "amount": "amount"} if rows else None
            )
            file_errors.extend(self._validate_rows(rows, column_map))

            rule_matches = self._rule_matches(
                rows,
                column_map or {},
                category_lookup_by_id,
            )
            category_suggestions = suggest_categories(rows, column_map or {}, rule_matches)
            transfers = match_transfers(rows, column_map or {})

            preview_rows = rows[:5]
            decorated_preview_rows: list[dict[str, Any]] = []
            for idx, row in enumerate(preview_rows):
                decorated = dict(row)
                suggestion = category_suggestions.get(idx)
                transfer = transfers.get(idx)
                rule_match = rule_matches.get(idx)
                if suggestion:
                    decorated["suggested_category"] = suggestion.category
                    decorated["suggested_confidence"] = round(suggestion.confidence, 2)
                    if suggestion.reason:
                        decorated["suggested_reason"] = suggestion.reason
                if transfer:
                    decorated["transfer_match"] = transfer
                if rule_match:
                    decorated["rule_applied"] = True
                    decorated["rule_type"] = rule_match.rule_type
                    decorated["rule_summary"] = rule_match.summary
                decorated_preview_rows.append(decorated)

            error_payloads = [{"row_number": row, "message": msg} for row, msg in file_errors]

            response_files.append(
                {
                    "id": file_id,
                    "filename": file_payload.filename,
                    "account_id": file_payload.account_id,
                    "bank_import_type": bank_import_type,
                    "row_count": len(rows),
                    "error_count": len(file_errors),
                    "errors": error_payloads,
                    "preview_rows": decorated_preview_rows,
                }
            )

            for idx, row in enumerate(rows, start=1):
                row_id = uuid4()
                occurred_at = str(row.get("date") or "")
                amount = str(row.get("amount") or "")
                description = str(row.get("description") or "")
                rows_by_account.setdefault(file_payload.account_id, []).append(
                    (row_id, description)
                )

                suggestion = category_suggestions.get(idx - 1)
                suggested_category_id: UUID | None = None
                suggested_category_name: str | None = None
                suggested_confidence: float | None = None
                suggested_reason: str | None = None
                if suggestion:
                    suggested_category_id = suggestion.category_id
                    suggested_category_name = suggestion.category
                    suggested_confidence = round(suggestion.confidence, 2)
                    suggested_reason = suggestion.reason
                    if suggested_category_id is None and suggestion.category:
                        category = category_by_name.get(suggestion.category.lower())
                        if category is not None:
                            suggested_category_id = category.id

                rule_match = rule_matches.get(idx - 1)

                response_rows.append(
                    {
                        "id": row_id,
                        "file_id": file_id,
                        "row_index": idx,
                        "account_id": file_payload.account_id,
                        "occurred_at": occurred_at,
                        "amount": amount,
                        "description": description,
                        "suggested_category_id": suggested_category_id,
                        "suggested_category_name": suggested_category_name,
                        "suggested_confidence": suggested_confidence,
                        "suggested_reason": suggested_reason,
                        "transfer_match": transfers.get(idx - 1),
                        "rule_applied": bool(rule_match),
                        "rule_type": rule_match.rule_type if rule_match else None,
                        "rule_summary": rule_match.summary if rule_match else None,
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

        batch_id = self._persist_preview_batch(
            note=payload.note,
            files=response_files,
            rows=response_rows,
        )
        return ImportPreviewResponse.model_validate(
            {
                "import_batch_id": batch_id,
                "files": response_files,
                "rows": response_rows,
                "accounts": response_accounts,
            }
        ).model_dump(mode="python")

    def commit_import(self, payload: ImportCommitRequest) -> dict[str, Any]:
        """Persist reviewed rows as transactions (all-or-nothing)."""

        if not payload.rows:
            raise ValueError("No rows provided")

        now = datetime.now(timezone.utc)
        if payload.import_batch_id is not None:
            batch = self.session.get(TransactionImportBatch, payload.import_batch_id)
            if batch is None:
                raise LookupError("Import batch not found")
            if self._batch_has_transactions(batch.id):
                raise ValueError("Import batch is already committed")
            if payload.note is not None:
                batch.note = payload.note
            batch.source_name = payload.note or batch.source_name or "import"
            batch.updated_at = now
        else:
            batch = TransactionImportBatch(
                source_name=payload.note or "import",
                note=payload.note,
                created_at=now,
                updated_at=now,
            )
            self.session.add(batch)
            self.session.flush()

        transaction_service = TransactionService(self.session)
        offset_account = self._get_or_create_offset_account()

        created_ids: list[UUID] = []
        tax_events: list[TaxEvent] = []
        user_id = self.session.info.get("user_id") or ""

        existing_files_stmt = select(ImportFile).where(cast(Any, ImportFile.batch_id) == batch.id)
        existing_files = {file.id: file for file in self.session.exec(existing_files_stmt).all()}

        commit_files = payload.files or []
        file_uploads: dict[UUID, dict[str, Any]] = {}
        stored_files: dict[UUID, ImportFile] = {}
        storage: ImportFileStorage | None = None
        if commit_files:
            storage = self.storage or ImportFileStorage.from_env()
            for commit_file in commit_files:
                content = self._decode_base64(commit_file.content_base64)
                file_id = commit_file.id
                object_key = storage.build_object_key(
                    user_id=str(user_id),
                    batch_id=batch.id,
                    file_id=file_id,
                    filename=commit_file.filename,
                )
                file_model = existing_files.get(file_id)
                if file_model is None:
                    file_model = ImportFile(
                        id=file_id,
                        batch_id=batch.id,
                        filename=commit_file.filename,
                        account_id=commit_file.account_id,
                        row_count=commit_file.row_count,
                        error_count=commit_file.error_count,
                        status="stored",
                        bank_type=str(commit_file.bank_import_type or ""),
                        object_key=object_key,
                        content_type=commit_file.content_type,
                        size_bytes=len(content),
                        created_at=now,
                        updated_at=now,
                    )
                    existing_files[file_id] = file_model
                    self.session.add(file_model)
                else:
                    file_model.filename = commit_file.filename
                    file_model.account_id = commit_file.account_id
                    file_model.row_count = commit_file.row_count
                    file_model.error_count = commit_file.error_count
                    file_model.status = "stored"
                    file_model.bank_type = str(commit_file.bank_import_type or "")
                    file_model.object_key = object_key
                    file_model.content_type = commit_file.content_type
                    file_model.size_bytes = len(content)
                    file_model.updated_at = now
                stored_files[file_id] = file_model
                file_uploads[file_id] = {
                    "key": object_key,
                    "content": content,
                    "content_type": commit_file.content_type,
                }

        valid_file_ids = set(existing_files.keys())

        for row in payload.rows:
            if row.delete:
                continue

            occurred_at = self._parse_date(row.occurred_at)
            if occurred_at is None:
                raise ValueError("Date is not a valid ISO date")

            if not is_decimal(row.amount):
                raise ValueError("Amount must be numeric")

            amount = Decimal(str(row.amount))
            description = str(row.description or "").strip()
            if not description:
                raise ValueError("Description is required")

            tax_event_type: TaxEventType | None = row.tax_event_type
            category_id = row.category_id if tax_event_type is None else None

            target_account_id = row.account_id
            counterparty_account_id = row.transfer_account_id

            abs_amount = abs(amount)
            if tax_event_type is not None:
                cash_delta = abs_amount if tax_event_type == TaxEventType.REFUND else -abs_amount
                legs = [
                    TransactionLeg(account_id=target_account_id, amount=cash_delta),
                    TransactionLeg(account_id=offset_account.id, amount=-cash_delta),
                ]
                counterparty_account_id = None
            elif counterparty_account_id is not None:
                legs = [
                    TransactionLeg(account_id=target_account_id, amount=amount),
                    TransactionLeg(account_id=counterparty_account_id, amount=-amount),
                ]
            else:
                legs = [
                    TransactionLeg(account_id=target_account_id, amount=amount),
                    TransactionLeg(account_id=offset_account.id, amount=-amount),
                ]

            transaction = Transaction(
                category_id=category_id,
                transaction_type=TransactionType.TRANSFER,
                description=description,
                notes=None,
                external_id=None,
                occurred_at=occurred_at,
                posted_at=occurred_at,
                created_source=CreatedSource.IMPORT,
                import_batch_id=batch.id,
                import_file_id=(
                    row.file_id
                    if row.file_id is not None and row.file_id in valid_file_ids
                    else None
                ),
                created_at=now,
                updated_at=now,
            )

            if row.file_id is not None and row.file_id not in valid_file_ids:
                raise ValueError("Row references unknown import file")

            created_tx = transaction_service.create_transaction(
                transaction,
                legs,
                import_batch=batch,
                commit=False,
            )
            if created_tx.id is None:  # pragma: no cover - defensive
                raise ValueError("Transaction was not persisted")
            created_ids.append(created_tx.id)

            if tax_event_type is not None:
                tax_events.append(
                    TaxEvent(
                        transaction_id=created_tx.id,
                        event_type=tax_event_type,
                    )
                )
            else:
                self._record_rule_from_row(
                    description=description,
                    amount=amount,
                    occurred_at=occurred_at,
                    category_id=category_id,
                )

        if tax_events:
            self.session.add_all(tax_events)

        # Upload files after DB objects are staged to ensure matching identifiers
        if file_uploads:
            storage_for_upload = cast(ImportFileStorage, storage)
            for file_id, upload in file_uploads.items():
                storage_for_upload.upload_file(
                    key=upload["key"],
                    content=upload["content"],
                    content_type=upload["content_type"],
                )

        if existing_files:
            for file_model in existing_files.values():
                file_model.status = "processed"
                file_model.updated_at = now
        batch.updated_at = now

        return ImportCommitResponse(
            import_batch_id=batch.id,
            transaction_ids=created_ids,
        ).model_dump(mode="python")

    def persist_import_files(
        self,
        *,
        import_batch_id: UUID,
        payload: ImportPersistFilesRequest,
    ) -> dict[str, Any]:
        """Persist uploaded import files in storage and RDS before commit."""

        commit_files = payload.files or []
        if not commit_files:
            raise ValueError("No files provided")

        now = datetime.now(timezone.utc)
        batch = self.session.get(TransactionImportBatch, import_batch_id)
        if batch is None:
            batch = TransactionImportBatch(
                id=import_batch_id,
                source_name=payload.note or "import",
                note=payload.note,
                created_at=now,
                updated_at=now,
            )
            self.session.add(batch)
            self.session.flush()
        else:
            if self._batch_has_transactions(batch.id):
                raise ValueError("Import batch is already committed")
            if payload.note is not None:
                batch.note = payload.note
            batch.source_name = payload.note or batch.source_name or "import"
            batch.updated_at = now

        existing_files_stmt = select(ImportFile).where(cast(Any, ImportFile.batch_id) == batch.id)
        existing_files = {file.id: file for file in self.session.exec(existing_files_stmt).all()}

        storage = self.storage or ImportFileStorage.from_env()
        user_id = self.session.info.get("user_id") or ""
        file_uploads: dict[UUID, dict[str, Any]] = {}

        for commit_file in commit_files:
            content = self._decode_base64(commit_file.content_base64)
            file_id = commit_file.id
            object_key = storage.build_object_key(
                user_id=str(user_id),
                batch_id=batch.id,
                file_id=file_id,
                filename=commit_file.filename,
            )
            file_model = existing_files.get(file_id)
            if file_model is None:
                file_model = ImportFile(
                    id=file_id,
                    batch_id=batch.id,
                    filename=commit_file.filename,
                    account_id=commit_file.account_id,
                    row_count=commit_file.row_count,
                    error_count=commit_file.error_count,
                    status="stored",
                    bank_type=str(commit_file.bank_import_type or ""),
                    object_key=object_key,
                    content_type=commit_file.content_type,
                    size_bytes=len(content),
                    created_at=now,
                    updated_at=now,
                )
                existing_files[file_id] = file_model
                self.session.add(file_model)
            else:
                file_model.filename = commit_file.filename
                file_model.account_id = commit_file.account_id
                file_model.row_count = commit_file.row_count
                file_model.error_count = commit_file.error_count
                file_model.status = "stored"
                file_model.bank_type = str(commit_file.bank_import_type or "")
                file_model.object_key = object_key
                file_model.content_type = commit_file.content_type
                file_model.size_bytes = len(content)
                file_model.updated_at = now

            file_uploads[file_id] = {
                "key": object_key,
                "content": content,
                "content_type": commit_file.content_type,
            }

        for upload in file_uploads.values():
            storage.upload_file(
                key=upload["key"],
                content=upload["content"],
                content_type=upload["content_type"],
            )

        return ImportPersistFilesResponse(
            import_batch_id=batch.id,
            file_ids=list(file_uploads.keys()),
        ).model_dump(mode="python")

    def _decode_base64(self, payload: str) -> bytes:
        try:
            return base64.b64decode(payload, validate=True)
        except (binascii.Error, TypeError, ValueError) as exc:
            raise ValueError("Unable to decode file content") from exc

    def _coerce_bank_import_type(self, value: Any) -> BankImportType | None:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        try:
            return BankImportType(text)
        except ValueError:
            return None

    def _validate_rows(
        self, rows: List[dict[str, Any]], column_map: Optional[Dict[str, str]]
    ) -> List[Tuple[int, str]]:
        if not rows:
            return []

        errors: List[Tuple[int, str]] = []

        if column_map is None:
            errors.append((0, "Missing required columns: date, description, amount"))
            return errors

        missing_columns = [field for field, header in column_map.items() if header is None]
        if missing_columns:
            errors.append((0, f"Missing required columns: {', '.join(missing_columns)}"))
            return errors

        for idx, row in enumerate(rows, start=1):
            missing_fields = [
                field for field, header in column_map.items() if not row.get(header, "")
            ]
            if missing_fields:
                errors.append((idx, f"Missing required fields: {', '.join(missing_fields)}"))
                continue

            amount_value = row[column_map["amount"]]
            if not is_decimal(amount_value):
                errors.append((idx, "Amount must be numeric"))

            date_value = row[column_map["date"]]
            if not is_date_like(date_value):
                errors.append((idx, "Date is not a valid ISO date"))

        return errors

    def _rule_matches(
        self,
        rows: List[dict],
        column_map: Dict[str, str],
        category_lookup: Dict[UUID, Category],
    ) -> Dict[int, RuleMatch]:
        rules = self._active_rules()
        description_header = column_map.get("description")
        if not rules or not description_header:
            return {}

        amount_header = column_map.get("amount")
        date_header = column_map.get("date")
        matches: Dict[int, RuleMatch] = {}
        for idx, row in enumerate(rows):
            description = str(row.get(description_header, "") or "")
            amount = safe_decimal(row.get(amount_header)) if amount_header else None
            occurred_at = parse_iso_date(str(row.get(date_header, ""))) if date_header else None
            best: RuleMatch | None = None
            for rule in rules:
                candidate = self._score_rule(
                    rule,
                    description=description,
                    amount=amount,
                    occurred_at=occurred_at,
                    category_lookup=category_lookup,
                )
                if candidate and (best is None or candidate.score > best.score):
                    best = candidate
            if best:
                matches[idx] = best
        return matches

    def _score_rule(
        self,
        rule: ImportRule,
        *args: object,
        description: Optional[str] = None,
        amount: Optional[Decimal] = None,
        occurred_at: Optional[datetime] = None,
        category_lookup: Dict[UUID, Category] | None = None,
    ) -> Optional[RuleMatch]:
        if args:
            if len(args) != 4:
                raise TypeError("_score_rule expected 4 positional arguments after rule")
            description = cast(Optional[str], args[0])
            amount = cast(Optional[Decimal], args[1])
            occurred_at = cast(Optional[datetime], args[2])
            category_lookup = cast(Optional[Dict[UUID, Category]], args[3])
        if category_lookup is None:
            category_lookup = {}
        if not rule.is_active:
            return None

        normalized = (description or "").lower()
        matcher = rule.matcher_text.lower()
        if matcher not in normalized:
            return None

        score = 0.7
        summary: List[str] = [f"matched '{rule.matcher_text}'"]

        if rule.matcher_day_of_month and occurred_at:
            if abs(occurred_at.day - rule.matcher_day_of_month) <= 1:
                score += 0.15
                summary.append(f"day≈{rule.matcher_day_of_month}")
            else:
                return None

        if rule.matcher_amount is not None and amount is not None:
            target = abs(rule.matcher_amount)
            delta = (abs(amount) - target).copy_abs()
            tolerance = rule.amount_tolerance or Decimal("0")
            if delta <= tolerance:
                score += 0.15
                summary.append(f"amount within ±{tolerance}")
            else:
                return None

        category = category_lookup.get(rule.category_id) if rule.category_id else None
        if category is None:
            return None

        return RuleMatch(
            rule_id=rule.id,
            category_id=category.id,
            category_name=category.name,
            summary="; ".join(summary),
            score=float(score),
            rule_type="category",
        )

    def _active_rules(self) -> List[ImportRule]:
        statement = select(ImportRule).where(cast(Any, ImportRule.is_active).is_(True))
        return list(self.session.exec(statement).all())

    def _category_lookup_by_id(
        self, *, category_ids: set[UUID] | None = None
    ) -> dict[UUID, Category]:
        statement = select(Category)
        if category_ids:
            statement = statement.where(cast(Any, Category.id).in_(category_ids))
        categories = self.session.exec(statement).all()
        return {cat.id: cat for cat in categories if getattr(cat, "id", None) is not None}

    def _get_or_create_offset_account(self) -> Account:
        if hasattr(self, "_offset_account"):
            return getattr(self, "_offset_account")

        statement = select(Account).where(
            cast(Any, Account.is_active).is_(False), Account.name == "Offset"
        )
        account = self.session.exec(statement).one_or_none()
        if account is None:
            account = Account(
                name="Offset",
                account_type=AccountType.NORMAL,
                is_active=False,
            )
            self.session.add(account)
            self.session.flush()
        else:
            account.name = account.name or "Offset"
        setattr(self, "_offset_account", account)
        return account

    def _category_lookup(self) -> dict[str, Category]:
        statement = select(Category)
        categories = self.session.exec(statement).all()
        return {cat.name.lower(): cat for cat in categories}

    def _record_rule_from_row(
        self,
        *args: object,
        description: Optional[str] = None,
        amount: Optional[Decimal] = None,
        occurred_at: Optional[datetime] = None,
        category_id: Optional[UUID] = None,
    ) -> None:
        if args:
            if len(args) != 4:
                raise TypeError("_record_rule_from_row expected 4 positional arguments")
            description = cast(Optional[str], args[0])
            amount = cast(Optional[Decimal], args[1])
            occurred_at = cast(Optional[datetime], args[2])
            category_id = cast(Optional[UUID], args[3])
        if not description or category_id is None:
            return

        matcher_text = description.lower().strip()
        if not matcher_text:
            return

        amount_abs = abs(amount) if amount is not None else None
        tolerance = self._derive_amount_tolerance(amount_abs)
        day_of_month = occurred_at.day if occurred_at else None

        existing = self.session.exec(
            select(ImportRule).where(func.lower(ImportRule.matcher_text) == matcher_text)
        ).one_or_none()

        if existing:
            if category_id:
                existing.category_id = category_id
            if amount_abs is not None and existing.matcher_amount is None:
                existing.matcher_amount = amount_abs
            if tolerance and existing.amount_tolerance is None:
                existing.amount_tolerance = tolerance
            if day_of_month and existing.matcher_day_of_month is None:
                existing.matcher_day_of_month = day_of_month
            existing.updated_at = datetime.now(timezone.utc)
            return

        rule = ImportRule(
            matcher_text=matcher_text,
            matcher_amount=amount_abs,
            amount_tolerance=tolerance,
            matcher_day_of_month=day_of_month,
            category_id=category_id,
        )
        self.session.add(rule)

    def _derive_amount_tolerance(self, amount: Optional[Decimal]) -> Optional[Decimal]:
        if amount is None:
            return None
        amount_abs = abs(amount)
        baseline = Decimal("1.00")
        percent = (amount_abs * Decimal("0.02")).quantize(Decimal("0.01"))
        return max(baseline, percent)

    def _parse_date(self, value: str) -> Optional[datetime]:
        return parse_iso_date(value)


__all__ = ["ImportService", "CategorySuggestion", "RuleMatch"]
