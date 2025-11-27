"""Service layer for imports."""
# pylint: disable=broad-exception-caught

from __future__ import annotations

import base64
import csv
import io
import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional, Tuple

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from openpyxl import load_workbook
from sqlmodel import Session, select

from ..models import (
    Account,
    Category,
    ImportErrorRecord,
    ImportFile,
    Transaction,
    TransactionImportBatch,
    TransactionLeg,
)
from ..repositories.imports import ImportRepository
from ..schemas import ExampleTransaction, ImportBatchCreate
from ..schemas import ImportFile as ImportFilePayload
from .transaction import TransactionService
from ..shared import AccountType, CreatedSource, TransactionStatus, TransactionType


REQUIRED_FIELDS = ("date", "description", "amount")
DATE_FIELDS = {"date", "transaction_date", "occurred_at", "posted_at"}
DESCRIPTION_FIELDS = {"description", "memo", "payee", "text"}
AMOUNT_FIELDS = {"amount", "amt", "transaction_amount", "value"}

TEMPLATE_MAPPINGS: dict[str, Dict[str, str]] = {
    "default": {"date": "date", "description": "description", "amount": "amount"},
    "nordea": {"date": "bokforingsdatum", "description": "text", "amount": "belopp"},
    "revolut": {"date": "completed_date", "description": "description", "amount": "amount"},
}


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


BEDROCK_REGION = "eu-north-1"
BEDROCK_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0"


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
        self._enrich_previews(parsed_files, payload.examples or [])
        saved_batch = self.repository.create_batch(batch, [result.model for result in parsed_files])

        error_models: List[ImportErrorRecord] = []
        for saved_file, parsed in zip(saved_batch.files, parsed_files):
            for row_number, message in parsed.errors:
                error_models.append(
                    ImportErrorRecord(file_id=saved_file.id, row_number=row_number, message=message)
                )

        ingestion_errors = self._ingest_files(saved_batch, parsed_files, payload.examples or [])
        error_models.extend(ingestion_errors)

        if error_models:
            self.repository.add_errors(error_models)

        return saved_batch, parsed_files

    def list_imports(self) -> List[TransactionImportBatch]:
        return self.repository.list_batches(include_files=True, include_errors=True)

    def _derive_source_name(self, payload: ImportBatchCreate) -> str:
        return payload.note or (payload.files[0].filename if payload.files else "import")

    def _parse_file(self, file: ImportFilePayload) -> ParsedImportFile:
        decoded = self._decode_base64(file.content_base64)
        rows, parse_errors = self._extract_rows(file.filename, decoded)
        column_map = self._build_column_map(rows, file.template_id)
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
            template_id=file.template_id,
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

    def _extract_rows(
        self, filename: str, content: bytes
    ) -> tuple[List[dict[str, Any]], List[Tuple[int, str]]]:
        name = filename.lower()
        if name.endswith(".xlsx"):
            return self._parse_xlsx(content)
        if name.endswith(".csv"):
            return self._parse_csv(content)
        return ([], [(0, "Unsupported file type; use CSV or XLSX")])

    def _parse_csv(self, content: bytes) -> tuple[List[dict[str, Any]], List[Tuple[int, str]]]:
        text = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        if reader.fieldnames is None:
            return ([], [(0, "CSV is missing a header row")])

        rows: List[dict[str, Any]] = []
        for row in reader:
            cleaned = {self._clean_header(k): self._clean_value(v) for k, v in row.items() if k}
            if not any(cleaned.values()):
                continue
            rows.append(cleaned)
        return rows, []

    def _parse_xlsx(self, content: bytes) -> tuple[List[dict[str, Any]], List[Tuple[int, str]]]:
        try:
            workbook = load_workbook(filename=io.BytesIO(content), read_only=True, data_only=True)
        except Exception as exc:
            return ([], [(0, f"Unable to read XLSX file: {exc}")])

        sheet = workbook.active
        header_row = next(sheet.iter_rows(values_only=True), None)
        if not header_row:
            return ([], [(0, "XLSX is missing a header row")])

        headers = [self._clean_header(cell) for cell in header_row if cell is not None]
        if not headers:
            return ([], [(0, "XLSX is missing a header row")])

        rows: List[dict[str, Any]] = []
        for row in sheet.iter_rows(min_row=2, values_only=True):
            mapped = {}
            for header, cell in zip(headers, row):
                if not header:
                    continue
                mapped[header] = self._clean_value(cell)
            if not any(mapped.values()):
                continue
            rows.append(mapped)
        return rows, []

    def _build_column_map(
        self, rows: List[dict[str, Any]], template_id: Optional[str] = None
    ) -> Optional[Dict[str, str]]:
        if not rows:
            return None
        header_keys: set[str] = set(rows[0].keys())

        if template_id:
            template = TEMPLATE_MAPPINGS.get(template_id)
            if template and all(template.get(field) in header_keys for field in REQUIRED_FIELDS):
                return {
                    "date": str(template["date"]),
                    "description": str(template["description"]),
                    "amount": str(template["amount"]),
                }
        column_map: Dict[str, Optional[str]] = {
            "date": self._resolve_header(header_keys, DATE_FIELDS),
            "description": self._resolve_header(header_keys, DESCRIPTION_FIELDS),
            "amount": self._resolve_header(header_keys, AMOUNT_FIELDS),
        }
        if any(value is None for value in column_map.values()):
            return None
        return {
            "date": str(column_map["date"]),
            "description": str(column_map["description"]),
            "amount": str(column_map["amount"]),
        }

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

            suggestions = self._suggest_rows(parsed.rows, parsed.column_map, examples)
            transfers = self._match_transfers(parsed.rows, parsed.column_map)

            for idx, row in enumerate(parsed.preview_rows):
                suggestion = suggestions.get(idx)
                if suggestion:
                    row["suggested_category"] = suggestion.category
                    row["suggested_confidence"] = round(suggestion.confidence, 2)
                    if suggestion.reason:
                        row["suggested_reason"] = suggestion.reason

                transfer = transfers.get(idx)
                if transfer:
                    row["transfer_match"] = transfer

    def _suggest_rows(
        self,
        rows: List[dict],
        column_map: Dict[str, str],
        examples: List[ExampleTransaction],
    ) -> Dict[int, CategorySuggestion]:
        heuristic: Dict[int, CategorySuggestion] = {}
        for idx, row in enumerate(rows):
            heuristic[idx] = self._suggest_category_heuristic(row, column_map, examples)

        bedrock_client = self._get_bedrock_client()
        if bedrock_client:
            bedrock = self._bedrock_suggest_batch(bedrock_client, rows, column_map, examples)
            for idx, suggestion in bedrock.items():
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

    def _get_bedrock_client(self):
        try:
            return boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
        except (BotoCoreError, ClientError):  # pragma: no cover - environment dependent
            return None

    def _bedrock_suggest_batch(
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
            "max_tokens": 400,
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

        statement = select(Account).where(Account.is_active.is_(False), Account.display_order == 9999)
        account = self.session.exec(statement).one_or_none()
        if account is None:
            account = Account(account_type=AccountType.NORMAL, is_active=False, display_order=9999)
            self.session.add(account)
            self.session.commit()
            self.session.refresh(account)
        setattr(self, "_offset_account", account)
        return account

    def _get_or_create_unassigned_account(self) -> Account:
        if hasattr(self, "_unassigned_account"):
            return getattr(self, "_unassigned_account")

        statement = select(Account).where(Account.is_active.is_(False), Account.display_order == 9998)
        account = self.session.exec(statement).one_or_none()
        if account is None:
            account = Account(account_type=AccountType.NORMAL, is_active=False, display_order=9998)
            self.session.add(account)
            self.session.commit()
            self.session.refresh(account)
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

        for saved_file, parsed in zip(batch.files, parsed_files):
            if saved_file.status == "error" or not parsed.rows or parsed.column_map is None:
                saved_file.status = saved_file.status or "error"
                continue

            suggestions = self._suggest_rows(parsed.rows, parsed.column_map, examples)
            added_errors = 0

            for idx, row in enumerate(parsed.rows, start=1):
                target_account_id = saved_file.account_id or self._get_or_create_unassigned_account().id
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

    def _resolve_header(self, headers: Iterable[str], candidates: set[str]) -> str | None:
        for header in headers:
            normalized = self._clean_header(header)
            if normalized in candidates:
                return header
        return None

    def _is_decimal(self, value: str) -> bool:
        try:
            Decimal(str(value))
        except Exception:
            return False
        return True

    def _is_date_like(self, value: str) -> bool:
        if not value:
            return False
        text = str(value)
        try:
            datetime.fromisoformat(text.replace("Z", "+00:00"))
            return True
        except ValueError:
            return False


__all__ = ["ImportService", "ParsedImportFile", "CategorySuggestion"]
