"""Service layer for investment snapshots (Nordnet exports)."""

# pylint: disable=broad-exception-caught

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional, Tuple, cast
from uuid import UUID

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from sqlmodel import Session, select

from ..models import (
    Account,
    InvestmentHolding,
    InvestmentSnapshot,
    InvestmentTransaction,
    Transaction,
    TransactionLeg,
)
from ..repositories.investment_snapshots import InvestmentSnapshotRepository
from ..repositories.investment_transactions import InvestmentTransactionRepository
from ..schemas import NordnetSnapshotCreate
from ..services.transaction import TransactionService
from ..shared import AccountType, TransactionType
from .nordnet_parser import NordnetPreParser

BEDROCK_REGION = "eu-north-1"
BEDROCK_MODEL_ID = "anthropic.claude-haiku-4-5-20251001-v1:0"
BEDROCK_MAX_TOKENS_DEFAULT = 500
BEDROCK_MAX_TOKENS_MIN = 100
BEDROCK_MAX_TOKENS_MAX = 2000


class InvestmentSnapshotService:
    """Coordinates persistence and optional Bedrock cleanup for Nordnet exports."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = InvestmentSnapshotRepository(session)
        self.tx_repository = InvestmentTransactionRepository(session)
        self.pre_parser = NordnetPreParser()
        self._account_cache: dict[str, Account] = {}

    def create_nordnet_snapshot(self, payload: NordnetSnapshotCreate) -> InvestmentSnapshot:
        parsed_payload = payload.parsed_payload or self.parse_nordnet_export(
            payload.raw_text, payload.manual_payload
        )
        if payload.manual_payload:
            parsed_payload = self._deep_merge(parsed_payload, payload.manual_payload)
        parsed_payload = self._coerce_json_safe(parsed_payload)

        snapshot_date = payload.snapshot_date or self._extract_snapshot_date(parsed_payload)
        if snapshot_date is None:
            raise ValueError("snapshot_date could not be derived from payload")

        portfolio_value = payload.portfolio_value
        if portfolio_value is None:
            portfolio_value = self._extract_portfolio_value(parsed_payload)

        cleaned_payload: Optional[dict[str, Any]] = None
        bedrock_metadata: Optional[dict[str, Any]] = None

        if payload.use_bedrock:
            cleaned_payload, bedrock_metadata = self._clean_with_bedrock(
                payload.raw_text,
                parsed_payload,
                model_id=payload.bedrock_model_id,
                max_tokens=payload.bedrock_max_tokens,
            )
            if cleaned_payload:
                cleaned_payload = self._coerce_json_safe(cleaned_payload)
            if bedrock_metadata:
                bedrock_metadata = self._coerce_json_safe(bedrock_metadata)

        snapshot = InvestmentSnapshot(
            provider="nordnet",
            report_type=payload.report_type,
            account_name=payload.account_name,
            snapshot_date=snapshot_date,
            portfolio_value=portfolio_value,
            raw_text=payload.raw_text,
            parsed_payload=parsed_payload,
            cleaned_payload=cleaned_payload,
            bedrock_metadata=bedrock_metadata,
        )
        holdings_payload = cleaned_payload.get("cleaned_rows") if cleaned_payload else None
        holdings = self._to_holdings(
            holdings_payload or parsed_payload,
            snapshot_date=snapshot_date,
            account=payload.account_name,
        )
        snapshot_saved = self.repository.create_with_holdings(snapshot, holdings)

        tx_rows = self._extract_transactions(parsed_payload)
        tx_models = self._to_transactions(tx_rows, snapshot_saved)
        if tx_models:
            self.tx_repository.bulk_insert(tx_models)

        return snapshot_saved

    def list_snapshots(self, limit: Optional[int] = None) -> list[InvestmentSnapshot]:
        return self.repository.list_snapshots(limit=limit)

    def list_transactions(
        self,
        *,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        holding: Optional[str] = None,
        tx_type: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> list[InvestmentTransaction]:
        return self.tx_repository.list_transactions(
            start=start, end=end, holding=holding, tx_type=tx_type, limit=limit
        )

    def benchmark_change_pct(
        self, symbol: str, start_date: date, end_date: date, return_series: bool = False
    ) -> Tuple[Optional[float], Optional[list[tuple[str, float]]]]:
        """Fetch benchmark percentage change (and optional series) from Yahoo."""
        try:
            delta_days = max(1, (end_date - start_date).days)
            range_param = "1mo"
            if delta_days > 365:
                range_param = "2y"
            elif delta_days > 180:
                range_param = "1y"
            elif delta_days > 90:
                range_param = "6mo"
            elif delta_days > 30:
                range_param = "3mo"

            url = (
                f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
                f"?range={range_param}&interval=1d"
            )
            with urllib.request.urlopen(url, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            result = (
                data.get("chart", {})
                .get("result", [{}])[0]
                .get("indicators", {})
                .get("quote", [{}])[0]
                .get("close", [])
            )
            timestamps = data.get("chart", {}).get("result", [{}])[0].get("timestamp", []) or []
            closes = [v for v in result if isinstance(v, (int, float))]
            if len(closes) < 2:
                return None, None
            # Align to date range
            series: list[tuple[str, float]] = []
            for ts, close in zip(timestamps, closes):
                dt = datetime.utcfromtimestamp(ts).date()
                if dt < start_date or dt > end_date:
                    continue
                series.append((dt.isoformat(), float(close)))
            start_price, end_price = closes[0], closes[-1]
            if start_price == 0:
                return None, series if return_series else None
            change = float((end_price - start_price) / start_price)
            return (change, series) if return_series else (change, None)
        except Exception:
            return (None, None)

    def parse_nordnet_export(
        self, raw_text: str, manual_payload: Optional[dict[str, Any]] = None
    ) -> dict[str, Any]:
        parsed = self.pre_parser.parse(raw_text)
        if manual_payload:
            parsed = self._deep_merge(parsed, manual_payload)
        return cast(dict[str, Any], self._coerce_json_safe(parsed))

    def sync_transactions_to_ledger(
        self,
        *,
        default_category_id: UUID | None = None,
    ) -> int:
        """Convert investment transactions into ledger entries.

        Best-effort: maps to a hidden investment account and offset account to keep
        double-entry balanced. Skips rows already linked.
        """

        unsynced = self.tx_repository.list_unsynced(limit=500)
        if not unsynced:
            return 0

        investment_account = self._get_or_create_investment_account()
        offset_account = self._get_or_create_offset_account()
        txn_service = TransactionService(self.session)
        created = 0

        for tx in unsynced:
            amount = Decimal(tx.amount_sek)
            fee = Decimal(tx.fee_sek or 0)
            legs = [
                TransactionLeg(account_id=investment_account.id, amount=amount),
                TransactionLeg(account_id=offset_account.id, amount=-amount),
            ]
            if fee:
                legs.append(TransactionLeg(account_id=offset_account.id, amount=-fee))
                legs.append(TransactionLeg(account_id=investment_account.id, amount=fee))

            transaction = Transaction(
                category_id=default_category_id,
                transaction_type=TransactionType.INVESTMENT_EVENT,
                description=tx.description or tx.transaction_type,
                notes=tx.notes,
                external_id=f"invtx:{tx.id}",
                occurred_at=tx.occurred_at,
                posted_at=tx.occurred_at,
            )
            saved = txn_service.create_transaction(transaction, legs)
            self.tx_repository.mark_linked(str(tx.id), str(saved.id))
            created += 1

        return created

    def _get_or_create_offset_account(self) -> Account:
        key = "offset"
        if key in self._account_cache:
            return self._account_cache[key]
        account = self.session.exec(
            select(Account).where(
                cast(Any, Account.is_active).is_(False), Account.display_order == 9999
            )
        ).one_or_none()
        if account is None:
            account = Account(account_type=AccountType.NORMAL, is_active=False, display_order=9999)
            self.session.add(account)
            self.session.commit()
            self.session.refresh(account)
        self._account_cache[key] = account
        return account

    def _get_or_create_investment_account(self) -> Account:
        key = "investment"
        if key in self._account_cache:
            return self._account_cache[key]
        account = self.session.exec(
            select(Account).where(Account.account_type == AccountType.INVESTMENT)
        ).first()
        if account is None:
            account = Account(
                account_type=AccountType.INVESTMENT, is_active=False, display_order=9997
            )
            self.session.add(account)
            self.session.commit()
            self.session.refresh(account)
        self._account_cache[key] = account
        return account

    def _extract_snapshot_date(self, payload: dict[str, Any]):
        date_value = payload.get("snapshot_date")
        if date_value is None:
            return None
        if isinstance(date_value, str):
            try:
                return datetime.fromisoformat(date_value).date()
            except ValueError:
                return None
        if isinstance(date_value, datetime):
            return date_value.date()
        return date_value

    def _extract_portfolio_value(self, payload: dict[str, Any]):
        value = payload.get("portfolio_value")
        if value is None:
            return None
        try:
            if isinstance(value, (int, float)):
                return Decimal(str(value))
            return Decimal(str(value))
        except Exception:
            return None

    def _deep_merge(self, base: dict[str, Any], overrides: dict[str, Any]) -> dict[str, Any]:
        merged = dict(base)
        for key, value in overrides.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = self._deep_merge(merged[key], value)
            else:
                merged[key] = value
        return merged

    def _coerce_json_safe(self, value: Any):
        if isinstance(value, Decimal):
            return float(value)
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, list):
            return [self._coerce_json_safe(item) for item in value]
        if isinstance(value, dict):
            return {key: self._coerce_json_safe(val) for key, val in value.items()}
        return value

    def _clean_with_bedrock(
        self,
        raw_text: str,
        parsed_payload: dict[str, Any],
        *,
        model_id: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> Tuple[Optional[dict[str, Any]], Optional[dict[str, Any]]]:
        client = self._get_bedrock_client()
        if client is None:
            return None, None

        rows = self._extract_rows(parsed_payload)
        if not rows:
            return None, {"model_id": BEDROCK_MODEL_ID, "notes": "No rows to classify"}

        prompt_rows = json.dumps(rows[:40])
        prompt = (
            "Clean and classify Nordnet export rows. "
            "Return JSON with keys cleaned_rows (list) and notes (string). "
            "For each row include normalized keys: name, type (stock|fund|etf|cash|other), "
            "currency, quantity, value_sek, price, isin (if present), and any remarks. "
            "Preserve numeric values as numbers. Do not invent holdings."
            f"\nParsed rows: {prompt_rows}"
            f"\nRaw text excerpt: {raw_text[:4000]}"
        )

        tokens = max(
            BEDROCK_MAX_TOKENS_MIN,
            min(max_tokens or BEDROCK_MAX_TOKENS_DEFAULT, BEDROCK_MAX_TOKENS_MAX),
        )
        chosen_model = model_id or BEDROCK_MODEL_ID

        payload = {
            "messages": [
                {
                    "role": "user",
                    "content": [{"type": "text", "text": prompt}],
                }
            ],
            "max_tokens": tokens,
            "temperature": 0.2,
            "top_p": 0.9,
        }

        try:
            response = client.invoke_model(
                modelId=chosen_model,
                contentType="application/json",
                accept="application/json",
                body=json.dumps(payload),
            )
            raw_body = response.get("body")
            if raw_body is None:
                return None, {"model_id": BEDROCK_MODEL_ID, "notes": "Empty Bedrock response"}

            body_text = raw_body.read().decode("utf-8")
            parsed = json.loads(body_text)
            output_text = (
                parsed.get("output_text") or parsed.get("content", [{}])[0].get("text") or ""
            )
            cleaned = json.loads(output_text)
            cleaned_rows = cleaned.get("cleaned_rows") or cleaned.get("rows") or cleaned
            notes = cleaned.get("notes")
            cleaned_payload: dict[str, Any] = {
                "cleaned_rows": cleaned_rows,
                "notes": notes,
                "source_row_count": len(rows),
            }
            metadata = {
                "model_id": chosen_model,
                "notes": notes,
                "requested_max_tokens": tokens,
            }
            return cleaned_payload, metadata
        except Exception:  # pragma: no cover - external dependency
            return None, {
                "model_id": chosen_model,
                "notes": "Bedrock invocation failed",
                "requested_max_tokens": tokens,
            }

    def _get_bedrock_client(self):
        try:
            return boto3.client("bedrock-runtime", region_name=BEDROCK_REGION)
        except (BotoCoreError, ClientError):  # pragma: no cover - environment dependent
            return None

    def _extract_rows(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        keys = ("rows", "holdings", "transactions")
        for key in keys:
            value = payload.get(key)
            if isinstance(value, list):
                return [row for row in value if isinstance(row, dict)]
        return []

    def _extract_transactions(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        txs = payload.get("transactions") or payload.get("rows") or []
        return [row for row in txs if isinstance(row, dict) and row.get("transaction_type")]

    def _to_holdings(
        self,
        payload: dict[str, Any] | list[dict[str, Any]],
        *,
        snapshot_date,
        account: Optional[str],
    ) -> list[InvestmentHolding]:
        rows: list[dict[str, Any]] = []
        if isinstance(payload, list):
            rows = payload
        elif isinstance(payload, dict):
            if isinstance(payload.get("cleaned_rows"), list):
                rows = payload.get("cleaned_rows")  # type: ignore[assignment]
            elif isinstance(payload.get("holdings"), list):
                rows = payload.get("holdings")  # type: ignore[assignment]
            elif isinstance(payload.get("rows"), list):
                rows = payload.get("rows")  # type: ignore[assignment]
        holdings: list[InvestmentHolding] = []
        for row in rows:
            holdings.append(
                InvestmentHolding(
                    snapshot_date=snapshot_date,
                    account_name=account,
                    name=str(row.get("name") or "Unknown"),
                    isin=row.get("isin"),
                    holding_type=row.get("type") or row.get("holding_type"),
                    currency=row.get("currency"),
                    quantity=self._coerce_decimal(row.get("quantity")),
                    price=self._coerce_decimal(row.get("price")),
                    value_sek=self._coerce_decimal(
                        row.get("value_sek") or row.get("market_value_sek") or row.get("value")
                    ),
                    notes=row.get("notes") or row.get("remarks"),
                )
            )
        return holdings

    def _coerce_decimal(self, value: Any) -> Optional[Decimal]:
        if value is None or value == "":
            return None
        try:
            return Decimal(str(value))
        except Exception:
            return None

    def _to_transactions(
        self, rows: list[dict[str, Any]], snapshot: InvestmentSnapshot
    ) -> list[InvestmentTransaction]:
        txs: list[InvestmentTransaction] = []
        seen: set[tuple] = set()
        for row in rows:
            occurred_at = self._extract_snapshot_date(
                {"snapshot_date": row.get("date") or row.get("occurred_at")}
            )
            if occurred_at is None:
                continue
            ttype = str(row.get("transaction_type") or row.get("type") or "other")
            amount = self._coerce_decimal(row.get("amount_sek") or row.get("amount"))
            if amount is None:
                continue
            identity = (
                occurred_at,
                ttype,
                row.get("description"),
                float(amount),
                float(self._coerce_decimal(row.get("quantity")) or 0),
            )
            if identity in seen:
                continue
            seen.add(identity)
            txs.append(
                InvestmentTransaction(
                    snapshot_id=snapshot.id,
                    occurred_at=datetime.combine(occurred_at, datetime.min.time()),
                    transaction_type=ttype,
                    description=row.get("description"),
                    holding_name=row.get("holding") or row.get("name"),
                    isin=row.get("isin"),
                    account_name=row.get("account"),
                    quantity=self._coerce_decimal(row.get("quantity")),
                    amount_sek=amount,
                    currency=row.get("currency"),
                    fee_sek=self._coerce_decimal(row.get("fee")),
                    notes=row.get("notes") or row.get("remarks"),
                )
            )
        return txs


__all__ = ["InvestmentSnapshotService"]
