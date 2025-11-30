"""Service layer for imports."""

# pylint: disable=broad-exception-caught,too-many-lines

from __future__ import annotations

import base64
import io
import json
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, cast
from uuid import UUID

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from openpyxl import load_workbook
from sqlalchemy import func
from sqlmodel import Session, select

from ..models import (
    Account,
    Category,
    ImportErrorRecord,
    ImportFile,
    ImportRow,
    ImportRule,
    Subscription,
    Transaction,
    TransactionImportBatch,
    TransactionLeg,
)
from ..repositories.imports import ImportRepository
from ..schemas import ExampleTransaction, ImportBatchCreate, ImportCommitRequest
from ..schemas import ImportFile as ImportFilePayload
from ..shared import (
    AccountType,
    BankImportType,
    CreatedSource,
    TransactionStatus,
    TransactionType,
)
from .transaction import TransactionService


@dataclass
class ParsedImportFile:
    """Captured parsing results for a file."""

    model: ImportFile
    rows: List[dict]
    preview_rows: List[dict[str, Any]]
    errors: List[Tuple[int, str]]
    column_map: Optional[Dict[str, str]]


@dataclass
class CategorySuggestion:
    """Represents a suggested category for a transaction row."""

    category: Optional[str]
    confidence: float
    reason: Optional[str] = None


@dataclass
class SubscriptionSuggestion:
    """Represents a suggested subscription for a transaction row."""

    subscription_id: UUID
    subscription_name: str
    confidence: float
    reason: Optional[str] = None


@dataclass
class RuleMatch:
    """Represents a deterministic rule hit for a row."""

    rule_id: UUID
    category_id: Optional[UUID]
    category_name: Optional[str]
    subscription_id: Optional[UUID]
    subscription_name: Optional[str]
    summary: str
    score: float
    rule_type: str


BEDROCK_REGION = "eu-north-1"
BEDROCK_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0"
SUBSCRIPTION_SUGGESTION_THRESHOLD = 0.8


class ImportService:
    """Coordinates import batch creation and retrieval."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = ImportRepository(session)

    def create_batch_with_files(
        self, payload: ImportBatchCreate
    ) -> tuple[TransactionImportBatch, List[ParsedImportFile]]:
        batch = TransactionImportBatch(
            source_name=self._derive_source_name(payload),
            note=payload.note,
        )

        parsed_files = [self._parse_file(file) for file in payload.files]

        row_models: List[ImportRow] = []
        error_models: List[ImportErrorRecord] = []
        category_lookup_by_id = self._category_lookup_by_id()
        subscription_lookup_by_id = self._subscription_lookup_by_id()

        for parsed in parsed_files:
            rule_matches = self._rule_matches(
                parsed.rows, parsed.column_map or {}, category_lookup_by_id, subscription_lookup_by_id
            )
            suggestions = self._suggest_rows(
                parsed.rows, parsed.column_map or {}, payload.examples or [], rule_matches
            )
            subscription_suggestions = self._suggest_subscriptions(
                parsed.rows, parsed.column_map or {}, rule_matches
            )
            transfers = self._match_transfers(parsed.rows, parsed.column_map or {})

            # decorate preview rows
            for idx, row in enumerate(parsed.preview_rows):
                suggestion = suggestions.get(idx)
                subscription_hint = subscription_suggestions.get(idx)
                transfer = transfers.get(idx)
                rule_match = rule_matches.get(idx)
                if suggestion:
                    row["suggested_category"] = suggestion.category
                    row["suggested_confidence"] = round(suggestion.confidence, 2)
                    if suggestion.reason:
                        row["suggested_reason"] = suggestion.reason
                if subscription_hint:
                    row["suggested_subscription_id"] = str(subscription_hint.subscription_id)
                    row["suggested_subscription_name"] = subscription_hint.subscription_name
                    row["suggested_subscription_confidence"] = round(
                        subscription_hint.confidence, 2
                    )
                    if subscription_hint.reason:
                        row["suggested_subscription_reason"] = subscription_hint.reason
                if transfer:
                    row["transfer_match"] = transfer
                if rule_match:
                    row["rule_applied"] = True
                    row["rule_type"] = rule_match.rule_type
                    row["rule_summary"] = rule_match.summary

            for row_number, message in parsed.errors:
                error_models.append(
                    ImportErrorRecord(
                        file_id=parsed.model.id,
                        row_number=row_number,
                        message=message,
                    )
                )

            parsed.model.row_count = len(parsed.rows)
            parsed.model.error_count = len(parsed.errors)
            parsed.model.status = "ready"
            if parsed.errors:
                parsed.model.status = "error"
            elif not parsed.rows:
                parsed.model.status = "empty"

            for idx, row in enumerate(parsed.rows, start=1):
                suggestion = suggestions.get(idx - 1)
                transfer = transfers.get(idx - 1)
                subscription_hint = subscription_suggestions.get(idx - 1)
                rule_match = rule_matches.get(idx - 1)
                row_models.append(
                    ImportRow(
                        file_id=parsed.model.id,
                        row_index=idx,
                        data=row,
                        suggested_category=suggestion.category if suggestion else None,
                        suggested_confidence=suggestion.confidence if suggestion else None,
                        suggested_reason=suggestion.reason if suggestion else None,
                        suggested_subscription_id=(
                            subscription_hint.subscription_id if subscription_hint else None
                        ),
                        suggested_subscription_name=(
                            subscription_hint.subscription_name if subscription_hint else None
                        ),
                        suggested_subscription_confidence=(
                            subscription_hint.confidence if subscription_hint else None
                        ),
                        suggested_subscription_reason=(
                            subscription_hint.reason if subscription_hint else None
                        ),
                        transfer_match=transfer,
                        rule_applied=bool(rule_match),
                        rule_type=rule_match.rule_type if rule_match else None,
                        rule_summary=rule_match.summary if rule_match else None,
                        rule_id=rule_match.rule_id if rule_match else None,
                    )
                )

        saved_batch = self.repository.create_batch(
            batch,
            [result.model for result in parsed_files],
            row_models,
            error_models,
        )

        return saved_batch, parsed_files

    def list_imports(self) -> List[TransactionImportBatch]:
        return self.repository.list_batches(
            include_files=True, include_errors=True, include_rows=True
        )

    def get_import_session(self, batch_id: UUID) -> Optional[TransactionImportBatch]:
        return self.repository.get_batch(
            batch_id,
            include_files=True,
            include_errors=True,
            include_rows=True,
        )

    def commit_session(
        self,
        batch_id: UUID,
        payload: ImportCommitRequest,
    ) -> TransactionImportBatch:
        batch = self.get_import_session(batch_id)
        if batch is None:
            raise LookupError("Import session not found")

        override_map = {item.row_id: item for item in (payload.rows or [])}
        transaction_service = TransactionService(self.session)
        offset_account = self._get_or_create_offset_account()
        unassigned_account = self._get_or_create_unassigned_account()

        error_models: List[ImportErrorRecord] = []
        category_map = self._category_lookup()

        for file in batch.files:
            added_errors = 0
            for row in getattr(file, "rows", []):
                override = override_map.get(row.id)
                if override and override.delete:
                    continue

                payload_data = dict(row.data)
                if override and override.description is not None:
                    payload_data["description"] = override.description
                if override and override.amount is not None:
                    payload_data["amount"] = override.amount
                if override and override.occurred_at is not None:
                    payload_data["occurred_at"] = override.occurred_at.isoformat()

                date_value = (
                    payload_data.get("date")
                    or payload_data.get("occurred_at")
                    or payload_data.get("posted_at")
                )
                occurred_at = (
                    override.occurred_at
                    if override and override.occurred_at is not None
                    else self._parse_date(str(date_value))
                )
                if occurred_at is None:
                    error_models.append(
                        ImportErrorRecord(
                            file_id=file.id,
                            row_number=row.row_index,
                            message="Date is not a valid ISO date",
                        )
                    )
                    added_errors += 1
                    continue

                amount_text = payload_data.get("amount") or payload_data.get("value")
                if not self._is_decimal(str(amount_text)):
                    error_models.append(
                        ImportErrorRecord(
                            file_id=file.id,
                            row_number=row.row_index,
                            message="Amount must be numeric",
                        )
                    )
                    added_errors += 1
                    continue

                amount = Decimal(str(amount_text))
                description = str(payload_data.get("description", "")) or None
                category_id = None
                if override and override.category_id:
                    category_id = override.category_id
                elif row.suggested_category:
                    category = category_map.get(row.suggested_category.lower())
                    if category:
                        category_id = category.id
                subscription_id = override.subscription_id if override else None

                target_account_id = (
                    override.account_id
                    if override and override.account_id is not None
                    else file.account_id or unassigned_account.id
                )

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
                    status=TransactionStatus.RECORDED,
                    subscription_id=subscription_id,
                    created_source=CreatedSource.IMPORT,
                    import_batch_id=batch.id,
                )

                try:
                    transaction_service.create_transaction(transaction, legs, import_batch=batch)
                    self._record_rule_from_row(
                        description,
                        amount,
                        occurred_at,
                        category_id,
                        subscription_id,
                    )
                except Exception as exc:  # pragma: no cover - defensive
                    error_models.append(
                        ImportErrorRecord(
                            file_id=file.id,
                            row_number=row.row_index,
                            message=str(exc),
                        )
                    )
                    added_errors += 1
                    continue

            if added_errors:
                file.status = "error"
                file.error_count += added_errors
            elif file.status == "staged":
                file.status = "committed"

            self.session.add(file)

        self.session.commit()

        if error_models:
            self.repository.add_errors(error_models)

        self.session.refresh(batch)
        return batch

    def append_files_to_session(
        self,
        batch_id: UUID,
        files: List[ImportFilePayload],
        examples: List[ExampleTransaction] | None = None,
    ) -> TransactionImportBatch:
        batch = self.get_import_session(batch_id)
        if batch is None:
            raise LookupError("Import session not found")

        parsed_files = [self._parse_file(file) for file in files]
        row_models: List[ImportRow] = []
        error_models: List[ImportErrorRecord] = []
        category_lookup_by_id = self._category_lookup_by_id()
        subscription_lookup_by_id = self._subscription_lookup_by_id()

        for parsed in parsed_files:
            rule_matches = self._rule_matches(
                parsed.rows, parsed.column_map or {}, category_lookup_by_id, subscription_lookup_by_id
            )
            suggestions = self._suggest_rows(
                parsed.rows, parsed.column_map or {}, examples or [], rule_matches
            )
            subscription_suggestions = self._suggest_subscriptions(
                parsed.rows, parsed.column_map or {}, rule_matches
            )
            transfers = self._match_transfers(parsed.rows, parsed.column_map or {})

            for idx, row in enumerate(parsed.preview_rows):
                suggestion = suggestions.get(idx)
                subscription_hint = subscription_suggestions.get(idx)
                transfer = transfers.get(idx)
                rule_match = rule_matches.get(idx)
                if suggestion:
                    row["suggested_category"] = suggestion.category
                    row["suggested_confidence"] = round(suggestion.confidence, 2)
                    if suggestion.reason:
                        row["suggested_reason"] = suggestion.reason
                if subscription_hint:
                    row["suggested_subscription_id"] = str(subscription_hint.subscription_id)
                    row["suggested_subscription_name"] = subscription_hint.subscription_name
                    row["suggested_subscription_confidence"] = round(
                        subscription_hint.confidence, 2
                    )
                    if subscription_hint.reason:
                        row["suggested_subscription_reason"] = subscription_hint.reason
                if transfer:
                    row["transfer_match"] = transfer
                if rule_match:
                    row["rule_applied"] = True
                    row["rule_type"] = rule_match.rule_type
                    row["rule_summary"] = rule_match.summary

            for row_number, message in parsed.errors:
                error_models.append(
                    ImportErrorRecord(
                        file_id=parsed.model.id,
                        row_number=row_number,
                        message=message,
                    )
                )

            parsed.model.row_count = len(parsed.rows)
            parsed.model.error_count = len(parsed.errors)
            parsed.model.status = "staged"
            if parsed.errors:
                parsed.model.status = "error"
            if not parsed.rows:
                parsed.model.status = "empty"

            parsed.model.batch_id = batch.id
            self.session.add(parsed.model)

            for idx, row in enumerate(parsed.rows, start=1):
                suggestion = suggestions.get(idx - 1)
                subscription_hint = subscription_suggestions.get(idx - 1)
                transfer = transfers.get(idx - 1)
                rule_match = rule_matches.get(idx - 1)
                row_models.append(
                    ImportRow(
                        file_id=parsed.model.id,
                        row_index=idx,
                        data=row,
                        suggested_category=suggestion.category if suggestion else None,
                        suggested_confidence=suggestion.confidence if suggestion else None,
                        suggested_reason=suggestion.reason if suggestion else None,
                        suggested_subscription_id=(
                            subscription_hint.subscription_id if subscription_hint else None
                        ),
                        suggested_subscription_name=(
                            subscription_hint.subscription_name if subscription_hint else None
                        ),
                        suggested_subscription_confidence=(
                            subscription_hint.confidence if subscription_hint else None
                        ),
                        suggested_subscription_reason=(
                            subscription_hint.reason if subscription_hint else None
                        ),
                        transfer_match=transfer,
                        rule_applied=bool(rule_match),
                        rule_type=rule_match.rule_type if rule_match else None,
                        rule_summary=rule_match.summary if rule_match else None,
                        rule_id=rule_match.rule_id if rule_match else None,
                    )
                )

        self.session.flush()
        for row_model in row_models:
            self.session.add(row_model)

        if error_models:
            self.session.add_all(error_models)

        self.session.commit()
        self.session.refresh(batch)
        return batch

    def _derive_source_name(self, payload: ImportBatchCreate) -> str:
        return payload.note or (payload.files[0].filename if payload.files else "import")

    def _parse_file(self, file: ImportFilePayload) -> ParsedImportFile:
        decoded = self._decode_base64(file.content_base64)
        rows, parse_errors = self._extract_bank_rows(
            filename=file.filename, content=decoded, bank_type=file.bank_type
        )
        column_map: Optional[Dict[str, str]] = (
            {"date": "date", "description": "description", "amount": "amount"} if rows else None
        )
        validation_errors = self._validate_rows(rows, column_map)
        errors = parse_errors + validation_errors

        status = "ready"
        if errors:
            status = "error"
        if not rows:
            status = "empty"

        model = ImportFile(
            filename=file.filename,
            account_id=file.account_id,
            bank_type=(
                file.bank_type.value
                if isinstance(file.bank_type, BankImportType)
                else str(file.bank_type)
            ),
            row_count=len(rows),
            error_count=len(errors),
            status=status,
        )

        preview_rows = rows[:5]
        return ParsedImportFile(
            model=model,
            rows=rows,
            preview_rows=preview_rows,
            errors=errors,
            column_map=column_map,
        )

    def _decode_base64(self, payload: str) -> bytes:
        try:
            return base64.b64decode(payload, validate=True)
        except Exception as exc:  # pragma: no cover - validated earlier
            raise ValueError("Unable to decode file content") from exc

    def _extract_bank_rows(
        self, *, filename: str, content: bytes, bank_type: BankImportType
    ) -> tuple[List[dict[str, Any]], List[Tuple[int, str]]]:
        name = filename.lower()
        if not name.endswith(".xlsx"):
            return ([], [(0, "Unsupported file type; only XLSX exports are accepted")])

        try:
            workbook = load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
        except Exception as exc:
            return ([], [(0, f"Unable to read XLSX file: {exc}")])

        sheet = workbook.active
        if sheet is None:
            return ([], [(0, "XLSX workbook has no active sheet")])

        if bank_type == BankImportType.CIRCLE_K_MASTERCARD:
            return self._parse_circle_k_mastercard(sheet)
        if bank_type == BankImportType.SEB:
            return self._parse_seb(sheet)
        if bank_type == BankImportType.SWEDBANK:
            return self._parse_swedbank(sheet)
        return ([], [(0, "Unknown bank type")])

    def _parse_circle_k_mastercard(
        self, sheet
    ) -> tuple[List[dict[str, Any]], List[Tuple[int, str]]]:
        headers = None
        rows: List[dict[str, Any]] = []
        errors: List[Tuple[int, str]] = []

        for idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            cleaned = [self._clean_value(cell) for cell in row]
            if headers is None:
                if {"datum", "belopp"}.issubset({self._clean_header(cell) for cell in row}):
                    headers = [self._clean_header(cell) for cell in row]
                continue
            if not any(cleaned):
                continue
            if isinstance(cleaned[0], str) and "totalt belopp" in cleaned[0].lower():
                continue

            try:
                date_text = cleaned[0] or cleaned[1] or ""
                occurred_at = self._parse_date(date_text)
                if occurred_at is None:
                    raise ValueError("invalid date")
                description = cleaned[2] or ""
                if cleaned[3]:
                    description = (
                        f"{description} ({cleaned[3]})" if description else str(cleaned[3])
                    )
                amount_raw = cleaned[6] if len(cleaned) > 6 else None
                amount = Decimal(str(amount_raw))
                amount = -abs(amount)
                rows.append(
                    {
                        "date": occurred_at.isoformat(),
                        "description": description,
                        "amount": str(amount),
                    }
                )
            except Exception as exc:
                errors.append((idx, f"Unable to parse row: {exc}"))

        if headers is None:
            errors.append((0, "Circle K Mastercard export is missing the expected headers"))

        return rows, errors

    def _parse_seb(self, sheet) -> tuple[List[dict[str, Any]], List[Tuple[int, str]]]:
        header_index = None
        headers: Dict[str, int] = {}
        rows: List[dict[str, Any]] = []
        errors: List[Tuple[int, str]] = []

        for idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            header_map = {self._clean_header(val): pos for pos, val in enumerate(row) if val}
            if not header_index and {"bokförd", "insättningar/uttag"}.issubset(header_map.keys()):
                header_index = idx
                headers = header_map
                continue
            if header_index is None or idx <= header_index:
                continue
            cleaned = [self._clean_value(cell) for cell in row]
            if not any(cleaned):
                continue
            try:
                date_text = cleaned[headers.get("bokförd", 0)] if headers else cleaned[0]
                occurred_at = self._parse_date(str(date_text))
                if occurred_at is None:
                    raise ValueError("invalid date")
                description = cleaned[headers.get("text", 2)] if headers else ""
                if not description:
                    description = cleaned[headers.get("typ", 3)] if headers else ""
                amount_raw = cleaned[headers.get("insättningar/uttag", 5)] if headers else ""
                amount = Decimal(str(amount_raw))
                rows.append(
                    {
                        "date": occurred_at.isoformat(),
                        "description": str(description),
                        "amount": str(amount),
                    }
                )
            except Exception as exc:
                errors.append((idx, f"Unable to parse row: {exc}"))

        if header_index is None:
            errors.append((0, "SEB export is missing the expected headers"))

        return rows, errors

    def _parse_swedbank(self, sheet) -> tuple[List[dict[str, Any]], List[Tuple[int, str]]]:
        header_index = None
        headers: Dict[str, int] = {}
        rows: List[dict[str, Any]] = []
        errors: List[Tuple[int, str]] = []

        for idx, row in enumerate(sheet.iter_rows(values_only=True), start=1):
            header_map = {self._clean_header(val): pos for pos, val in enumerate(row) if val}
            if not header_index and {"radnummer", "bokföringsdag", "belopp"}.issubset(
                header_map.keys()
            ):
                header_index = idx
                headers = header_map
                continue
            if header_index is None or idx <= header_index:
                continue
            cleaned = [self._clean_value(cell) for cell in row]
            if not any(cleaned):
                continue
            try:
                date_text = cleaned[headers.get("bokföringsdag", 1)]
                occurred_at = self._parse_date(str(date_text))
                if occurred_at is None:
                    raise ValueError("invalid date")
                ref = cleaned[headers.get("referens", 4)] if headers else ""
                desc = cleaned[headers.get("beskrivning", 5)] if headers else ""
                description = f"{ref} {desc}".strip() or desc or ref
                amount_raw = cleaned[headers.get("belopp", 6)] if headers else ""
                amount = Decimal(str(amount_raw))
                rows.append(
                    {
                        "date": occurred_at.isoformat(),
                        "description": description,
                        "amount": str(amount),
                    }
                )
            except Exception as exc:
                errors.append((idx, f"Unable to parse row: {exc}"))

        if header_index is None:
            errors.append((0, "Swedbank export is missing the expected headers"))

        return rows, errors

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
            if not self._is_decimal(amount_value):
                errors.append((idx, "Amount must be numeric"))

            date_value = row[column_map["date"]]
            if not self._is_date_like(date_value):
                errors.append((idx, "Date is not a valid ISO date"))

        return errors

    def _enrich_previews(
        self, parsed_files: List[ParsedImportFile], examples: List[ExampleTransaction]
    ) -> None:
        for parsed in parsed_files:
            if parsed.column_map is None or not parsed.rows:
                continue

            category_lookup_by_id = self._category_lookup_by_id()
            subscription_lookup_by_id = self._subscription_lookup_by_id()
            rule_matches = self._rule_matches(
                parsed.rows, parsed.column_map, category_lookup_by_id, subscription_lookup_by_id
            )
            suggestions = self._suggest_rows(parsed.rows, parsed.column_map, examples, rule_matches)
            subscription_suggestions = self._suggest_subscriptions(
                parsed.rows, parsed.column_map, rule_matches
            )
            transfers = self._match_transfers(parsed.rows, parsed.column_map)

            for idx, row in enumerate(parsed.preview_rows):
                suggestion = suggestions.get(idx)
                if suggestion:
                    row["suggested_category"] = suggestion.category
                    row["suggested_confidence"] = round(suggestion.confidence, 2)
                    if suggestion.reason:
                        row["suggested_reason"] = suggestion.reason

                subscription_hint = subscription_suggestions.get(idx)
                if subscription_hint:
                    row["suggested_subscription_id"] = str(subscription_hint.subscription_id)
                    row["suggested_subscription_name"] = subscription_hint.subscription_name
                    row["suggested_subscription_confidence"] = round(
                        subscription_hint.confidence, 2
                    )
                    if subscription_hint.reason:
                        row["suggested_subscription_reason"] = subscription_hint.reason

                transfer = transfers.get(idx)
                if transfer:
                    row["transfer_match"] = transfer

    def _rule_matches(
        self,
        rows: List[dict],
        column_map: Dict[str, str],
        category_lookup: Dict[UUID, Category],
        subscription_lookup: Dict[UUID, Subscription],
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
            amount = self._safe_decimal(row.get(amount_header)) if amount_header else None
            occurred_at = self._parse_date(str(row.get(date_header, ""))) if date_header else None
            best: RuleMatch | None = None
            for rule in rules:
                candidate = self._score_rule(
                    rule,
                    description,
                    amount,
                    occurred_at,
                    category_lookup,
                    subscription_lookup,
                )
                if candidate and (best is None or candidate.score > best.score):
                    best = candidate
            if best:
                matches[idx] = best
        return matches

    def _score_rule(
        self,
        rule: ImportRule,
        description: str,
        amount: Optional[Decimal],
        occurred_at: Optional[datetime],
        category_lookup: Dict[UUID, Category],
        subscription_lookup: Dict[UUID, Subscription],
    ) -> Optional[RuleMatch]:
        if not rule.is_active:
            return None

        normalized = description.lower()
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
        subscription = (
            subscription_lookup.get(rule.subscription_id) if rule.subscription_id else None
        )
        if category is None and subscription is None:
            return None

        rule_type = "category"
        if category and subscription:
            rule_type = "category+subscription"
        elif subscription and not category:
            rule_type = "subscription"

        return RuleMatch(
            rule_id=rule.id,
            category_id=category.id if category else None,
            category_name=category.name if category else None,
            subscription_id=subscription.id if subscription else None,
            subscription_name=subscription.name if subscription else None,
            summary="; ".join(summary),
            score=float(score),
            rule_type=rule_type,
        )

    def _active_rules(self) -> List[ImportRule]:
        statement = select(ImportRule).where(cast(Any, ImportRule.is_active).is_(True))
        return list(self.session.exec(statement).all())

    def _category_lookup_by_id(self) -> dict[UUID, Category]:
        categories = self.session.exec(select(Category)).all()
        return {cat.id: cat for cat in categories if getattr(cat, "id", None) is not None}

    def _subscription_lookup_by_id(self) -> dict[UUID, Subscription]:
        subscriptions = self.session.exec(select(Subscription)).all()
        return {
            sub.id: sub for sub in subscriptions if getattr(sub, "id", None) is not None
        }

    def _suggest_rows(
        self,
        rows: List[dict],
        column_map: Dict[str, str],
        examples: List[ExampleTransaction],
        rule_matches: Optional[Dict[int, RuleMatch]] = None,
    ) -> Dict[int, CategorySuggestion]:
        if not column_map or not column_map.get("description") or not column_map.get("amount"):
            return {}
        heuristic: Dict[int, CategorySuggestion] = {}
        locked: set[int] = set()
        if rule_matches:
            for idx, match in rule_matches.items():
                if match.category_name:
                    heuristic[idx] = CategorySuggestion(
                        category=match.category_name,
                        confidence=0.95,
                        reason=match.summary or "Rule match",
                    )
                    locked.add(idx)

        for idx, row in enumerate(rows):
            if idx in locked:
                continue
            heuristic[idx] = self._suggest_category_heuristic(row, column_map, examples)

        bedrock_client = self._get_bedrock_client()
        if bedrock_client:
            bedrock = self._bedrock_suggest_batch(bedrock_client, rows, column_map, examples)
            for idx, suggestion in bedrock.items():
                if idx in locked:
                    continue
                heuristic[idx] = suggestion

        return heuristic

    def _suggest_category_heuristic(
        self,
        row: dict,
        column_map: Dict[str, str],
        examples: List[ExampleTransaction],
    ) -> CategorySuggestion:
        description = str(row.get(column_map["description"], ""))
        amount_text = str(row.get(column_map["amount"], ""))

        normalized_desc = description.lower()
        for example in examples:
            if example.description.lower() in normalized_desc:
                return CategorySuggestion(category=example.category_hint, confidence=0.78)

        keyword_map = {
            "rent": "Rent",
            "salary": "Salary",
            "payroll": "Salary",
            "grocery": "Groceries",
            "market": "Groceries",
            "uber": "Transport",
            "lyft": "Transport",
            "electric": "Utilities",
            "water": "Utilities",
            "internet": "Utilities",
        }
        for keyword, category in keyword_map.items():
            if keyword in normalized_desc:
                return CategorySuggestion(category=category, confidence=0.65)

        return CategorySuggestion(
            category=None, confidence=0.3, reason=f"No signal for {amount_text}"
        )

    def _suggest_subscriptions(
        self,
        rows: List[dict],
        column_map: Dict[str, str],
        rule_matches: Optional[Dict[int, RuleMatch]] = None,
    ) -> Dict[int, SubscriptionSuggestion]:
        if not rows:
            return {}
        description_header = column_map.get("description")
        amount_header = column_map.get("amount")
        date_header = column_map.get("date")
        if not description_header:
            return {}

        subscriptions = self._active_subscriptions()
        if not subscriptions:
            return {}
        last_amounts = self._subscription_amount_lookup()

        suggestions: Dict[int, SubscriptionSuggestion] = {}
        locked: set[int] = set()
        if rule_matches:
            for idx, match in rule_matches.items():
                if match.subscription_id:
                    suggestions[idx] = SubscriptionSuggestion(
                        subscription_id=match.subscription_id,
                        subscription_name=match.subscription_name or "Matched rule",
                        confidence=0.99,
                        reason=match.summary or "Rule match",
                    )
                    locked.add(idx)
        for idx, row in enumerate(rows):
            if idx in locked:
                continue
            description = str(row.get(description_header, "") or "")
            amount = self._safe_decimal(row.get(amount_header)) if amount_header else None
            occurred_at = self._parse_date(str(row.get(date_header, ""))) if date_header else None

            best: SubscriptionSuggestion | None = None
            for subscription in subscriptions:
                candidate = self._score_subscription(
                    subscription,
                    description,
                    amount,
                    occurred_at,
                    last_amounts.get(subscription.id),
                )
                if candidate is None:
                    continue
                if best is None or candidate.confidence > best.confidence:
                    best = candidate
            if best and best.confidence >= SUBSCRIPTION_SUGGESTION_THRESHOLD:
                suggestions[idx] = best
        return suggestions

    def _score_subscription(  # pylint: disable=too-many-positional-arguments
        self,
        subscription: Subscription,
        description: str,
        amount: Optional[Decimal],
        occurred_at: Optional[datetime],
        last_amount: Optional[Decimal],
    ) -> Optional[SubscriptionSuggestion]:
        text_match, text_reason = self._match_subscription_text(
            subscription.matcher_text, description
        )
        if not text_match:
            return None

        confidence = 0.82 if text_reason == "regex" else 0.8
        reasons = [f"{text_reason} match"]

        if subscription.matcher_day_of_month and occurred_at:
            if occurred_at.day == subscription.matcher_day_of_month:
                confidence += 0.1
                reasons.append("day-of-month aligns")
            else:
                confidence -= 0.05

        if subscription.matcher_amount_tolerance is not None and amount is not None:
            if last_amount is not None:
                delta = (abs(amount) - abs(last_amount)).copy_abs()
                if delta <= subscription.matcher_amount_tolerance:
                    confidence += 0.08
                    reasons.append("amount within tolerance of last charge")
                else:
                    return None
            else:
                reasons.append("tolerance provided but no history; skipping amount check")

        confidence = min(confidence, 0.98)

        return SubscriptionSuggestion(
            subscription_id=subscription.id,
            subscription_name=subscription.name,
            confidence=confidence,
            reason="; ".join(reasons),
        )

    def _match_subscription_text(self, pattern: str, description: str) -> tuple[bool, str]:
        normalized = description.lower()
        try:
            if re.search(pattern, description, flags=re.IGNORECASE):
                return True, "regex"
        except re.error:
            pass
        if pattern.lower() in normalized:
            return True, "substring"
        return False, ""

    def _active_subscriptions(self) -> List[Subscription]:
        statement = select(Subscription).where(cast(Any, Subscription.is_active).is_(True))
        return list(self.session.exec(statement).all())

    def _subscription_amount_lookup(self) -> dict[UUID, Decimal]:
        latest = (
            select(
                cast(Any, Transaction.id).label("txn_id"),
                cast(Any, Transaction.subscription_id).label("subscription_id"),
                func.row_number()
                .over(
                    partition_by=cast(Any, Transaction.subscription_id),
                    order_by=cast(Any, Transaction.occurred_at).desc(),
                )
                .label("rn"),
            ).where(cast(Any, Transaction.subscription_id).isnot(None))
        ).subquery()

        amounts = (
            select(
                latest.c.subscription_id,
                func.max(func.abs(TransactionLeg.amount)).label("amount"),
            )
            .join(TransactionLeg, cast(Any, TransactionLeg.transaction_id == latest.c.txn_id))
            .where(latest.c.rn == 1)
            .group_by(latest.c.subscription_id)
        )
        results = self.session.exec(amounts).all()
        lookup: dict[UUID, Decimal] = {}
        for sub_id, amount in results:
            if sub_id is None or amount is None:
                continue
            lookup[sub_id] = Decimal(str(amount))
        return lookup

    def _get_bedrock_client(self):
        try:
            cfg = Config(
                read_timeout=5,
                connect_timeout=3,
                retries={"max_attempts": 1, "mode": "standard"},
            )
            return boto3.client("bedrock-runtime", region_name=BEDROCK_REGION, config=cfg)
        except (BotoCoreError, ClientError):  # pragma: no cover - environment dependent
            return None

    def _bedrock_suggest_batch(  # pylint: disable=too-many-positional-arguments
        self,
        client,
        rows: List[dict],
        column_map: Dict[str, str],
        examples: List[ExampleTransaction],
    ) -> Dict[int, CategorySuggestion]:
        transactions: list[dict[str, str]] = []
        for row in rows:
            transactions.append(
                {
                    "description": str(row.get(column_map.get("description") or "")),
                    "amount": str(row.get(column_map.get("amount") or "")),
                }
            )

        prompt = (
            "Suggest spending categories for each transaction. "
            "Return a JSON array of objects with fields category, confidence (0-1), and reason. "
            f"Examples: {json.dumps([ex.model_dump() for ex in examples])}. "
            f"Transactions: {json.dumps(transactions)}"
        )

        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}],
                }
            ],
            "max_tokens": 1200,
            "temperature": 0.2,
            "top_p": 0.9,
        }

        try:
            response = client.invoke_model(
                modelId=BEDROCK_MODEL_ID,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(payload),
            )
            raw_body = response.get("body")
            if raw_body is None:
                return {}
            body_text = raw_body.read().decode("utf-8")
            parsed = json.loads(body_text)
            output_text = (
                parsed.get("output_text") or parsed.get("content", [{}])[0].get("text") or ""
            )

            suggestions_raw = json.loads(output_text)
            suggestions: Dict[int, CategorySuggestion] = {}
            for idx, item in enumerate(suggestions_raw):
                suggestions[idx] = CategorySuggestion(
                    category=item.get("category"),
                    confidence=float(item.get("confidence", 0.5)),
                    reason=item.get("reason"),
                )
            return suggestions
        except Exception:  # pragma: no cover - external dependency
            return {}

    def _record_rule_from_row(
        self,
        description: Optional[str],
        amount: Optional[Decimal],
        occurred_at: Optional[datetime],
        category_id: Optional[UUID],
        subscription_id: Optional[UUID],
    ) -> None:
        if not description or (category_id is None and subscription_id is None):
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
            if subscription_id:
                existing.subscription_id = subscription_id
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
            subscription_id=subscription_id,
        )
        self.session.add(rule)

    def _derive_amount_tolerance(self, amount: Optional[Decimal]) -> Optional[Decimal]:
        if amount is None:
            return None
        amount_abs = abs(amount)
        baseline = Decimal("1.00")
        percent = (amount_abs * Decimal("0.02")).quantize(Decimal("0.01"))
        return max(baseline, percent)

    def _match_transfers(
        self, rows: List[dict[str, Any]], column_map: Dict[str, str]
    ) -> Dict[int, dict[str, Any]]:
        if not rows:
            return {}

        amount_header = column_map.get("amount")
        date_header = column_map.get("date")
        if not amount_header:
            return {}

        entries: List[Dict[str, Any]] = []
        for idx, row in enumerate(rows):
            try:
                amount = Decimal(str(row.get(amount_header, "")))
            except Exception:
                continue
            date_value = self._parse_date(str(row.get(date_header, ""))) if date_header else None
            entries.append({"idx": idx, "amount": amount, "date": date_value})

        matches: Dict[int, dict[str, Any]] = {}
        used: set[int] = set()
        for entry in entries:
            if entry["idx"] in used:
                continue
            for other in entries:
                if other["idx"] in used or other["idx"] == entry["idx"]:
                    continue
                if (entry["amount"] + other["amount"]) != 0:
                    continue
                if entry["date"] and other["date"]:
                    delta = abs((entry["date"] - other["date"]).days)
                    if delta > 2:
                        continue
                match_payload = {
                    "paired_with": other["idx"] + 1,  # human-friendly row number
                    "reason": "Matched transfer by amount and date proximity",
                }
                matches[entry["idx"]] = match_payload
                matches[other["idx"]] = {
                    "paired_with": entry["idx"] + 1,
                    "reason": "Matched transfer by amount and date proximity",
                }
                used.update({entry["idx"], other["idx"]})
                break
        return matches

    def _get_or_create_offset_account(self) -> Account:
        if hasattr(self, "_offset_account"):
            return getattr(self, "_offset_account")

        statement = select(Account).where(
            cast(Any, Account.is_active).is_(False), Account.display_order == 9999
        )
        account = self.session.exec(statement).one_or_none()
        if account is None:
            account = Account(
                name="Offset",
                account_type=AccountType.NORMAL,
                is_active=False,
                display_order=9999,
            )
            self.session.add(account)
            self.session.commit()
            self.session.refresh(account)
        else:
            account.name = account.name or "Offset"
        setattr(self, "_offset_account", account)
        return account

    def _get_or_create_unassigned_account(self) -> Account:
        if hasattr(self, "_unassigned_account"):
            return getattr(self, "_unassigned_account")

        statement = select(Account).where(
            cast(Any, Account.is_active).is_(False), Account.display_order == 9998
        )
        account = self.session.exec(statement).one_or_none()
        if account is None:
            account = Account(
                name="Unassigned",
                account_type=AccountType.NORMAL,
                is_active=False,
                display_order=9998,
            )
            self.session.add(account)
            self.session.commit()
            self.session.refresh(account)
        else:
            account.name = account.name or "Unassigned"
        setattr(self, "_unassigned_account", account)
        return account

    def _category_lookup(self) -> dict[str, Category]:
        statement = select(Category)
        categories = self.session.exec(statement).all()
        return {cat.name.lower(): cat for cat in categories}

    def _ingest_files(
        self,
        batch: TransactionImportBatch,
        parsed_files: List[ParsedImportFile],
        examples: List[ExampleTransaction],
    ) -> List[ImportErrorRecord]:
        errors: List[ImportErrorRecord] = []
        transaction_service = TransactionService(self.session)
        offset_account = self._get_or_create_offset_account()
        category_map = self._category_lookup()
        category_lookup_by_id = self._category_lookup_by_id()
        subscription_lookup_by_id = self._subscription_lookup_by_id()

        for saved_file, parsed in zip(batch.files, parsed_files):
            if saved_file.status == "error" or not parsed.rows or parsed.column_map is None:
                saved_file.status = saved_file.status or "error"
                continue

            rule_matches = self._rule_matches(
                parsed.rows, parsed.column_map, category_lookup_by_id, subscription_lookup_by_id
            )
            suggestions = self._suggest_rows(parsed.rows, parsed.column_map, examples, rule_matches)
            added_errors = 0

            for idx, row in enumerate(parsed.rows, start=1):
                target_account_id = (
                    saved_file.account_id or self._get_or_create_unassigned_account().id
                )
                date_value = row.get(parsed.column_map["date"], "")
                occurred_at = self._parse_date(str(date_value))
                if occurred_at is None:
                    errors.append(
                        ImportErrorRecord(
                            file_id=saved_file.id,
                            row_number=idx,
                            message="Date is not a valid ISO date",
                        )
                    )
                    added_errors += 1
                    continue

                amount_text = row.get(parsed.column_map["amount"], "")
                if not self._is_decimal(str(amount_text)):
                    errors.append(
                        ImportErrorRecord(
                            file_id=saved_file.id,
                            row_number=idx,
                            message="Amount must be numeric",
                        )
                    )
                    added_errors += 1
                    continue

                amount = Decimal(str(amount_text))
                description = str(row.get(parsed.column_map["description"], "")).strip() or None
                suggestion = suggestions.get(idx - 1)
                category_id = None
                if suggestion and suggestion.category:
                    category = category_map.get(suggestion.category.lower())
                    if category:
                        category_id = category.id

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
                    status=TransactionStatus.IMPORTED,
                    created_source=CreatedSource.IMPORT,
                )

                try:
                    transaction_service.create_transaction(
                        transaction,
                        legs,
                        import_batch=batch,
                    )
                except Exception as exc:  # pragma: no cover - defensive
                    errors.append(
                        ImportErrorRecord(
                            file_id=saved_file.id,
                            row_number=idx,
                            message=str(exc),
                        )
                    )
                    added_errors += 1
                    continue

            if added_errors:
                saved_file.status = "error"
                saved_file.error_count += added_errors
            elif saved_file.status == "ready":
                saved_file.status = "imported"

            self.session.add(saved_file)

        self.session.commit()
        return errors

    def _parse_date(self, value: str) -> Optional[datetime]:
        if not value:
            return None
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return None

    def _clean_header(self, header: object) -> str:
        return str(header).strip().lower().replace(" ", "_") if header is not None else ""

    def _clean_value(self, value: object) -> str:
        if value is None:
            return ""
        if isinstance(value, (int, float, Decimal)):
            return str(value)
        return str(value).strip()

    def _is_decimal(self, value: str) -> bool:
        try:
            Decimal(str(value))
        except Exception:
            return False
        return True

    def _safe_decimal(self, value: Any) -> Optional[Decimal]:
        try:
            return Decimal(str(value))
        except Exception:
            return None

    def _is_date_like(self, value: str) -> bool:
        if not value:
            return False
        text = str(value)
        try:
            datetime.fromisoformat(text.replace("Z", "+00:00"))
            return True
        except ValueError:
            return False


__all__ = ["ImportService", "ParsedImportFile", "CategorySuggestion", "RuleMatch"]
