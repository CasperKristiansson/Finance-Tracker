"""Service layer for imports (stateless preview + atomic commit)."""

# pylint: disable=broad-exception-caught,too-many-lines

from __future__ import annotations

import base64
import re
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, cast
from uuid import UUID, uuid4

from sqlalchemy import func, or_
from sqlmodel import Session, select

from ...models import (
    Account,
    Category,
    ImportRule,
    Subscription,
    TaxEvent,
    Transaction,
    TransactionImportBatch,
    TransactionLeg,
)
from ...schemas import (
    ImportCommitRequest,
    ImportCommitResponse,
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
from .parsers import parse_bank_rows
from .suggestions import (
    CategorySuggestion,
    RuleMatch,
    SubscriptionSuggestion,
    suggest_categories,
    suggest_subscriptions,
)
from .transfers import match_transfers
from .utils import is_date_like, is_decimal, parse_iso_date, safe_decimal


class ImportService:
    """Coordinates stateless import preview and atomic commit."""

    def __init__(self, session: Session):
        self.session = session

    def preview_import(self, payload: ImportPreviewRequest) -> dict[str, Any]:
        """Parse files and return draft rows + suggestions without persisting."""

        category_lookup_by_id = self._category_lookup_by_id()
        subscription_lookup_by_id = self._subscription_lookup_by_id()
        category_by_name = self._category_lookup()
        active_subscriptions = self._active_subscriptions()
        last_subscription_amounts = self._subscription_amount_lookup()

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
                subscription_lookup_by_id,
            )
            category_suggestions = suggest_categories(rows, column_map or {}, rule_matches)
            subscription_suggestions = suggest_subscriptions(
                rows,
                column_map or {},
                active_subscriptions,
                last_subscription_amounts,
                rule_matches,
            )
            transfers = match_transfers(rows, column_map or {})

            preview_rows = rows[:5]
            decorated_preview_rows: list[dict[str, Any]] = []
            for idx, row in enumerate(preview_rows):
                decorated = dict(row)
                suggestion = category_suggestions.get(idx)
                subscription_hint = subscription_suggestions.get(idx)
                transfer = transfers.get(idx)
                rule_match = rule_matches.get(idx)
                if suggestion:
                    decorated["suggested_category"] = suggestion.category
                    decorated["suggested_confidence"] = round(suggestion.confidence, 2)
                    if suggestion.reason:
                        decorated["suggested_reason"] = suggestion.reason
                if subscription_hint:
                    decorated["suggested_subscription_id"] = str(subscription_hint.subscription_id)
                    decorated["suggested_subscription_name"] = subscription_hint.subscription_name
                    decorated["suggested_subscription_confidence"] = round(
                        subscription_hint.confidence, 2
                    )
                    if subscription_hint.reason:
                        decorated["suggested_subscription_reason"] = subscription_hint.reason
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

                subscription_hint = subscription_suggestions.get(idx - 1)
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
                        "suggested_subscription_id": (
                            subscription_hint.subscription_id if subscription_hint else None
                        ),
                        "suggested_subscription_name": (
                            subscription_hint.subscription_name if subscription_hint else None
                        ),
                        "suggested_subscription_confidence": (
                            round(subscription_hint.confidence, 2) if subscription_hint else None
                        ),
                        "suggested_subscription_reason": (
                            subscription_hint.reason if subscription_hint else None
                        ),
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

        return ImportPreviewResponse.model_validate(
            {"files": response_files, "rows": response_rows, "accounts": response_accounts}
        ).model_dump(mode="python")

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

    def commit_import(self, payload: ImportCommitRequest) -> dict[str, Any]:
        """Persist reviewed rows as transactions (all-or-nothing)."""

        if not payload.rows:
            raise ValueError("No rows provided")

        now = datetime.now(timezone.utc)
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
            subscription_id = row.subscription_id if tax_event_type is None else None

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
                subscription_id=subscription_id,
                created_source=CreatedSource.IMPORT,
                import_batch_id=batch.id,
                created_at=now,
                updated_at=now,
            )

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
                    description,
                    amount,
                    occurred_at,
                    category_id,
                    subscription_id,
                )

        if tax_events:
            self.session.add_all(tax_events)

        return ImportCommitResponse(
            import_batch_id=batch.id,
            transaction_ids=created_ids,
        ).model_dump(mode="python")

    def _decode_base64(self, payload: str) -> bytes:
        try:
            return base64.b64decode(payload, validate=True)
        except Exception as exc:
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
            amount = safe_decimal(row.get(amount_header)) if amount_header else None
            occurred_at = parse_iso_date(str(row.get(date_header, ""))) if date_header else None
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

    # pylint: disable=too-many-positional-arguments
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
        return {sub.id: sub for sub in subscriptions if getattr(sub, "id", None) is not None}

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

    # pylint: disable=too-many-positional-arguments
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

    def _parse_date(self, value: str) -> Optional[datetime]:
        return parse_iso_date(value)


__all__ = ["ImportService", "CategorySuggestion", "SubscriptionSuggestion", "RuleMatch"]
