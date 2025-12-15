"""Service layer for investment snapshots (Nordnet exports)."""

# pylint: disable=broad-exception-caught,too-many-lines

from __future__ import annotations

import json
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Optional, Tuple, cast
from uuid import UUID

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from sqlalchemy import case, func
from sqlalchemy import select as sa_select
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

    def investment_overview(self) -> dict[str, Any]:
        """Compute investment overview values + cashflows for the UI.

        Uses investment snapshots for value history and ledger transactions for cash in/out.
        """

        investment_accounts = list(
            self.session.exec(
                select(Account)
                .where(
                    Account.account_type == AccountType.INVESTMENT,
                    cast(Any, Account.is_active).is_(True),
                )
                .order_by(cast(Any, Account.name).asc())
            ).all()
        )
        if not investment_accounts:
            zero = Decimal(0)
            return {
                "portfolio": {
                    "start_date": None,
                    "as_of": None,
                    "current_value": zero,
                    "series": [],
                    "cashflow_series": [],
                    "cashflow": {
                        "added_30d": zero,
                        "withdrawn_30d": zero,
                        "net_30d": zero,
                        "added_ytd": zero,
                        "withdrawn_ytd": zero,
                        "net_ytd": zero,
                        "added_12m": zero,
                        "withdrawn_12m": zero,
                        "net_12m": zero,
                        "added_since_start": zero,
                        "withdrawn_since_start": zero,
                        "net_since_start": zero,
                    },
                    "growth_12m_ex_transfers": {"amount": zero, "pct": None},
                    "growth_since_start_ex_transfers": {"amount": zero, "pct": None},
                },
                "accounts": [],
                "recent_cashflows": [],
            }

        account_by_key: dict[str, Account] = {
            self._normalize_key(account.name): account for account in investment_accounts
        }
        account_ids = [account.id for account in investment_accounts if account.id]

        snapshot_rows = list(
            self.session.exec(
                cast(
                    Any,
                    sa_select(
                        cast(Any, InvestmentSnapshot.snapshot_date),
                        cast(Any, InvestmentSnapshot.account_name),
                        cast(Any, InvestmentSnapshot.portfolio_value),
                        cast(Any, InvestmentSnapshot.parsed_payload),
                        cast(Any, InvestmentSnapshot.cleaned_payload),
                        cast(Any, InvestmentSnapshot.created_at),
                        cast(Any, InvestmentSnapshot.updated_at),
                    ).order_by(
                        cast(Any, InvestmentSnapshot.snapshot_date).asc(),
                        cast(Any, InvestmentSnapshot.created_at).asc(),
                    ),
                )
            ).all()
        )

        def extract_snapshot_account_values(
            *,
            account_name: Optional[str],
            portfolio_value: Optional[Decimal],
            parsed_payload: Any,
            cleaned_payload: Any,
        ) -> dict[str, Decimal]:
            payload: dict[str, Any] = {}
            if isinstance(cleaned_payload, dict):
                payload = cleaned_payload
            elif isinstance(parsed_payload, dict):
                payload = parsed_payload

            accounts = payload.get("accounts")
            if isinstance(accounts, dict):
                out: dict[str, Decimal] = {}
                for name, value in accounts.items():
                    amount = self._coerce_decimal(value)
                    if amount is None:
                        continue
                    out[str(name)] = amount
                return out

            if account_name and portfolio_value is not None:
                amount = self._coerce_decimal(portfolio_value)
                if amount is not None:
                    return {str(account_name): amount}

            return {}

        values_by_date: dict[date, dict[UUID, tuple[Decimal, datetime]]] = {}
        for (
            snapshot_date,
            account_name,
            portfolio_value,
            parsed_payload,
            cleaned_payload,
            created_at,
            updated_at,
        ) in snapshot_rows:
            date_key = snapshot_date
            updated_at = updated_at or created_at
            extracted = extract_snapshot_account_values(
                account_name=account_name,
                portfolio_value=portfolio_value,
                parsed_payload=parsed_payload,
                cleaned_payload=cleaned_payload,
            )
            for raw_name, value in extracted.items():
                account = self._match_account(raw_name, investment_accounts, account_by_key)
                if account is None or account.id is None:
                    continue
                bucket = values_by_date.setdefault(date_key, {})
                existing_entry = bucket.get(account.id)
                if existing_entry is None or updated_at > existing_entry[1]:
                    bucket[account.id] = (value, updated_at)

        dates = sorted(values_by_date.keys())
        portfolio_series_base: list[tuple[date, Decimal]] = []
        account_series_base: dict[UUID, list[tuple[date, Decimal]]] = {
            account.id: [] for account in investment_accounts if account.id
        }

        for point_date in dates:
            bucket = values_by_date.get(point_date) or {}
            total = sum((entry[0] for entry in bucket.values()), Decimal(0))
            portfolio_series_base.append((point_date, total))
            for account_id, (value, _updated_at) in bucket.items():
                series = account_series_base.get(account_id)
                if series is not None:
                    series.append((point_date, value))

        today = datetime.now(timezone.utc).date()
        portfolio_series = list(portfolio_series_base)
        if portfolio_series and portfolio_series[-1][0] != today:
            portfolio_series.append((today, portfolio_series[-1][1]))

        account_series: dict[UUID, list[tuple[date, Decimal]]] = {}
        for account_id, series_points in account_series_base.items():
            if not series_points:
                account_series[account_id] = []
                continue
            extended = list(series_points)
            if extended[-1][0] != today:
                extended.append((today, extended[-1][1]))
            account_series[account_id] = extended

        portfolio_snapshot_start_date = (
            portfolio_series_base[0][0] if portfolio_series_base else None
        )
        portfolio_as_of = portfolio_series_base[-1][0] if portfolio_series_base else None
        portfolio_current_value = (
            portfolio_series_base[-1][1] if portfolio_series_base else Decimal(0)
        )

        def value_at(points: list[tuple[date, Decimal]], target: date) -> Optional[Decimal]:
            if not points:
                return None
            last_value: Optional[Decimal] = None
            for point_date, point_value in points:
                if point_date <= target:
                    last_value = point_value
                else:
                    break
            return last_value if last_value is not None else points[0][1]

        noninv_tx_ids = (
            select(cast(Any, TransactionLeg.transaction_id))
            .join(Account, cast(Any, TransactionLeg.account_id) == cast(Any, Account.id))
            .where(Account.account_type != AccountType.INVESTMENT)
            .distinct()
        ).subquery()

        def cashflow_sums(
            start_dt: datetime, end_dt: datetime
        ) -> dict[UUID, tuple[Decimal, Decimal]]:
            if not account_ids:
                return {}
            stmt = (
                select(
                    cast(Any, TransactionLeg.account_id),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    cast(Any, TransactionLeg.amount) > 0,
                                    cast(Any, TransactionLeg.amount),
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("deposits"),
                    func.coalesce(
                        func.sum(
                            case(
                                (
                                    cast(Any, TransactionLeg.amount) < 0,
                                    -cast(Any, TransactionLeg.amount),
                                ),
                                else_=0,
                            )
                        ),
                        0,
                    ).label("withdrawals"),
                )
                .join(
                    Transaction,
                    cast(Any, TransactionLeg.transaction_id) == cast(Any, Transaction.id),
                )
                .where(
                    cast(Any, TransactionLeg.account_id).in_(account_ids),
                    cast(Any, Transaction.occurred_at) >= start_dt,
                    cast(Any, Transaction.occurred_at) <= end_dt,
                    cast(Any, Transaction.transaction_type) != TransactionType.ADJUSTMENT,
                    cast(Any, TransactionLeg.transaction_id).in_(
                        select(cast(Any, noninv_tx_ids.c.transaction_id))
                    ),
                )
                .group_by(cast(Any, TransactionLeg.account_id))
            )
            rows = self.session.exec(stmt).all()
            out: dict[UUID, tuple[Decimal, Decimal]] = {}
            for account_id, deposits, withdrawals in rows:
                out[account_id] = (Decimal(deposits or 0), Decimal(withdrawals or 0))
            return out

        now = datetime.now(timezone.utc)

        cashflow_start_dt_ledger: Optional[datetime] = None
        cashflow_start_by_account_ledger: dict[UUID, datetime] = {}
        if account_ids:
            cashflow_start_stmt: Any = (
                select(func.min(cast(Any, Transaction.occurred_at)))
                .select_from(TransactionLeg)
                .join(
                    Transaction,
                    cast(Any, TransactionLeg.transaction_id) == cast(Any, Transaction.id),
                )
                .where(
                    cast(Any, TransactionLeg.account_id).in_(account_ids),
                    cast(Any, Transaction.transaction_type) != TransactionType.ADJUSTMENT,
                    cast(Any, TransactionLeg.transaction_id).in_(
                        select(cast(Any, noninv_tx_ids.c.transaction_id))
                    ),
                )
            )
            cashflow_start_dt_ledger = self.session.exec(cashflow_start_stmt).one()

            cashflow_start_by_account_stmt: Any = (
                select(
                    cast(Any, TransactionLeg.account_id),
                    func.min(cast(Any, Transaction.occurred_at)),
                )
                .select_from(TransactionLeg)
                .join(
                    Transaction,
                    cast(Any, TransactionLeg.transaction_id) == cast(Any, Transaction.id),
                )
                .where(
                    cast(Any, TransactionLeg.account_id).in_(account_ids),
                    cast(Any, Transaction.transaction_type) != TransactionType.ADJUSTMENT,
                    cast(Any, TransactionLeg.transaction_id).in_(
                        select(cast(Any, noninv_tx_ids.c.transaction_id))
                    ),
                )
                .group_by(cast(Any, TransactionLeg.account_id))
            )
            for account_id, min_dt in self.session.exec(cashflow_start_by_account_stmt).all():
                if account_id is None or min_dt is None:
                    continue
                cashflow_start_by_account_ledger[account_id] = min_dt

        cashflow_start_date = cashflow_start_dt_ledger.date() if cashflow_start_dt_ledger else None
        cashflow_start_by_account = cashflow_start_by_account_ledger

        def totals(sums: dict[UUID, tuple[Decimal, Decimal]]) -> tuple[Decimal, Decimal]:
            dep = sum((v[0] for v in sums.values()), Decimal(0))
            wdr = sum((v[1] for v in sums.values()), Decimal(0))
            return dep, wdr

        since_start_date: Optional[date] = None
        if portfolio_snapshot_start_date and cashflow_start_date:
            since_start_date = min(portfolio_snapshot_start_date, cashflow_start_date)
        else:
            since_start_date = portfolio_snapshot_start_date or cashflow_start_date

        start_30d = now - timedelta(days=30)
        start_12m = now - timedelta(days=365)
        start_ytd = datetime(now.year, 1, 1, tzinfo=timezone.utc)
        start_since = (
            datetime.combine(since_start_date, datetime.min.time(), tzinfo=timezone.utc)
            if since_start_date
            else start_12m
        )

        def cashflow_monthly_series(start_dt: datetime, end_dt: datetime) -> list[dict[str, Any]]:
            if not account_ids or start_dt > end_dt:
                return []

            stmt = (
                select(
                    cast(Any, Transaction.occurred_at),
                    cast(Any, TransactionLeg.amount),
                )
                .select_from(TransactionLeg)
                .join(
                    Transaction,
                    cast(Any, TransactionLeg.transaction_id) == cast(Any, Transaction.id),
                )
                .where(
                    cast(Any, TransactionLeg.account_id).in_(account_ids),
                    cast(Any, Transaction.occurred_at) >= start_dt,
                    cast(Any, Transaction.occurred_at) <= end_dt,
                    cast(Any, Transaction.transaction_type) != TransactionType.ADJUSTMENT,
                    cast(Any, TransactionLeg.transaction_id).in_(
                        select(cast(Any, noninv_tx_ids.c.transaction_id))
                    ),
                )
            )
            rows = self.session.exec(stmt).all()
            by_month: dict[date, tuple[Decimal, Decimal]] = {}
            for occurred_at, amount in rows:
                if occurred_at is None:
                    continue
                dt = cast(datetime, occurred_at)
                month = date(dt.year, dt.month, 1)
                deposits, withdrawals = by_month.get(month, (Decimal(0), Decimal(0)))
                amt = Decimal(amount or 0)
                if amt > 0:
                    deposits += amt
                elif amt < 0:
                    withdrawals += -amt
                by_month[month] = (deposits, withdrawals)

            cursor = date(start_dt.year, start_dt.month, 1)
            end_month = date(end_dt.year, end_dt.month, 1)
            series: list[dict[str, Any]] = []
            while cursor <= end_month:
                deposits, withdrawals = by_month.get(cursor, (Decimal(0), Decimal(0)))
                series.append(
                    {
                        "period": cursor,
                        "added": deposits,
                        "withdrawn": withdrawals,
                        "net": deposits - withdrawals,
                    }
                )
                next_month = cursor.month + 1
                next_year = cursor.year
                if next_month == 13:
                    next_month = 1
                    next_year += 1
                cursor = date(next_year, next_month, 1)

            return series

        sums_30d = cashflow_sums(start_30d, now)
        sums_12m = cashflow_sums(start_12m, now)
        sums_ytd = cashflow_sums(start_ytd, now)
        sums_since = cashflow_sums(start_since, now)

        portfolio_cashflow_series = (
            cashflow_monthly_series(start_since, now) if since_start_date else []
        )

        dep_30d, wdr_30d = totals(sums_30d)
        dep_12m, wdr_12m = totals(sums_12m)
        dep_ytd, wdr_ytd = totals(sums_ytd)
        dep_since, wdr_since = totals(sums_since)

        net_12m = dep_12m - wdr_12m
        net_since = dep_since - wdr_since

        start_value_12m = value_at(portfolio_series_base, (now - timedelta(days=365)).date())
        start_value_12m = start_value_12m if start_value_12m is not None else Decimal(0)

        has_portfolio_values = bool(portfolio_series_base)
        portfolio_end_value = portfolio_current_value

        growth_12m_amount = Decimal(0)
        growth_12m_pct = None
        growth_since_amount = Decimal(0)
        growth_since_pct = None

        if has_portfolio_values:
            growth_12m_amount = portfolio_end_value - start_value_12m - net_12m
            growth_12m_base = start_value_12m + net_12m
            growth_12m_pct = (
                float((growth_12m_amount / growth_12m_base) * 100) if growth_12m_base > 0 else None
            )

            since_start_value = Decimal(0)
            if (
                since_start_date
                and portfolio_snapshot_start_date
                and since_start_date >= portfolio_snapshot_start_date
            ):
                since_start_value = value_at(portfolio_series_base, since_start_date) or Decimal(0)

            growth_since_amount = portfolio_end_value - since_start_value - net_since
            growth_since_base = since_start_value + net_since
            growth_since_pct = (
                float((growth_since_amount / growth_since_base) * 100)
                if growth_since_base > 0
                else None
            )

        recent_stmt = (
            cast(
                Any,
                sa_select(
                    cast(Any, Transaction.id),
                    cast(Any, Transaction.occurred_at),
                    cast(Any, Transaction.description),
                    cast(Any, TransactionLeg.account_id),
                    cast(Any, TransactionLeg.amount),
                ),
            )
            .join(
                Transaction, cast(Any, TransactionLeg.transaction_id) == cast(Any, Transaction.id)
            )
            .where(
                cast(Any, TransactionLeg.account_id).in_(account_ids),
                cast(Any, Transaction.occurred_at) >= start_12m,
                cast(Any, Transaction.transaction_type) != TransactionType.ADJUSTMENT,
                cast(Any, TransactionLeg.transaction_id).in_(
                    select(cast(Any, noninv_tx_ids.c.transaction_id))
                ),
            )
            .order_by(cast(Any, Transaction.occurred_at).desc())
            .limit(50)
        )
        recent_rows = self.session.exec(recent_stmt).all()
        recent_cashflows: list[dict[str, Any]] = []
        for tx_id, occurred_at, description, account_id, amount in recent_rows:
            account = next((a for a in investment_accounts if a.id == account_id), None)
            if account is None:
                continue
            amt = Decimal(amount or 0)
            if amt == 0:
                continue
            recent_cashflows.append(
                {
                    "occurred_at": occurred_at,
                    "account_id": account_id,
                    "account_name": account.name,
                    "direction": "deposit" if amt > 0 else "withdrawal",
                    "amount_sek": abs(amt),
                    "description": description,
                    "transaction_id": tx_id,
                }
            )
        recent_cashflows = recent_cashflows[:12]

        accounts_payload: list[dict[str, Any]] = []
        target_12m_date = (now - timedelta(days=365)).date()
        for account in investment_accounts:
            if account.id is None:
                continue
            series_base = account_series_base.get(account.id) or []
            series_points = account_series.get(account.id) or []
            account_snapshot_start_date = series_base[0][0] if series_base else None
            cashflow_start_dt_for_account = cashflow_start_by_account.get(account.id)
            account_cashflow_start_date = (
                cashflow_start_dt_for_account.date() if cashflow_start_dt_for_account else None
            )
            account_start_date: Optional[date] = None
            if account_snapshot_start_date and account_cashflow_start_date:
                account_start_date = min(account_snapshot_start_date, account_cashflow_start_date)
            else:
                account_start_date = account_snapshot_start_date or account_cashflow_start_date

            as_of = series_base[-1][0] if series_base else None
            current_value = series_base[-1][1] if series_base else Decimal(0)

            dep_acc_12m, wdr_acc_12m = sums_12m.get(account.id, (Decimal(0), Decimal(0)))
            net_acc_12m = dep_acc_12m - wdr_acc_12m
            start_acc_12m = value_at(series_base, target_12m_date)
            if start_acc_12m is None:
                growth_acc = Decimal(0)
                growth_acc_pct = None
            else:
                growth_acc = current_value - start_acc_12m - net_acc_12m
                base_acc = start_acc_12m + net_acc_12m
                growth_acc_pct = float((growth_acc / base_acc) * 100) if base_acc > 0 else None

            dep_acc_since, wdr_acc_since = sums_since.get(account.id, (Decimal(0), Decimal(0)))
            net_acc_since = dep_acc_since - wdr_acc_since

            growth_since_acc = Decimal(0)
            growth_since_acc_pct = None
            if series_base:
                start_value_since = Decimal(0)
                if (
                    account_start_date
                    and account_snapshot_start_date
                    and account_start_date >= account_snapshot_start_date
                ):
                    start_value_since = value_at(series_base, account_start_date) or Decimal(0)
                growth_since_acc = current_value - start_value_since - net_acc_since
                base_since = start_value_since + net_acc_since
                growth_since_acc_pct = (
                    float((growth_since_acc / base_since) * 100) if base_since > 0 else None
                )

            accounts_payload.append(
                {
                    "account_id": account.id,
                    "name": account.name,
                    "icon": account.icon,
                    "start_date": account_start_date,
                    "as_of": as_of,
                    "current_value": current_value,
                    "series": [{"date": d, "value": v} for d, v in series_points],
                    "cashflow_12m_added": dep_acc_12m,
                    "cashflow_12m_withdrawn": wdr_acc_12m,
                    "cashflow_since_start_added": dep_acc_since,
                    "cashflow_since_start_withdrawn": wdr_acc_since,
                    "cashflow_since_start_net": net_acc_since,
                    "growth_12m_ex_transfers": {"amount": growth_acc, "pct": growth_acc_pct},
                    "growth_since_start_ex_transfers": {
                        "amount": growth_since_acc,
                        "pct": growth_since_acc_pct,
                    },
                }
            )

        accounts_payload.sort(key=lambda row: Decimal(row.get("current_value") or 0), reverse=True)

        return {
            "portfolio": {
                "start_date": since_start_date,
                "as_of": portfolio_as_of,
                "current_value": portfolio_current_value,
                "series": [{"date": d, "value": v} for d, v in portfolio_series],
                "cashflow_series": portfolio_cashflow_series,
                "cashflow": {
                    "added_30d": dep_30d,
                    "withdrawn_30d": wdr_30d,
                    "net_30d": dep_30d - wdr_30d,
                    "added_ytd": dep_ytd,
                    "withdrawn_ytd": wdr_ytd,
                    "net_ytd": dep_ytd - wdr_ytd,
                    "added_12m": dep_12m,
                    "withdrawn_12m": wdr_12m,
                    "net_12m": net_12m,
                    "added_since_start": dep_since,
                    "withdrawn_since_start": wdr_since,
                    "net_since_start": net_since,
                },
                "growth_12m_ex_transfers": {"amount": growth_12m_amount, "pct": growth_12m_pct},
                "growth_since_start_ex_transfers": {
                    "amount": growth_since_amount,
                    "pct": growth_since_pct,
                },
            },
            "accounts": accounts_payload,
            "recent_cashflows": recent_cashflows,
        }

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
            select(Account).where(cast(Any, Account.is_active).is_(False), Account.name == "Offset")
        ).one_or_none()
        if account is None:
            account = Account(
                name="Offset",
                account_type=AccountType.NORMAL,
                is_active=False,
            )
            self.session.add(account)
            self.session.commit()
            self.session.refresh(account)
        else:
            account.name = account.name or "Offset"
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
                name="Investments",
                account_type=AccountType.INVESTMENT,
                is_active=False,
            )
            self.session.add(account)
            self.session.commit()
            self.session.refresh(account)
        else:
            account.name = account.name or "Investments"
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

    def _normalize_key(self, value: str | None) -> str:
        return str(value or "").strip().lower()

    def _match_account(
        self,
        raw_name: str,
        accounts: list[Account],
        accounts_by_key: dict[str, Account],
    ) -> Optional[Account]:
        normalized = self._normalize_key(raw_name)
        if not normalized:
            return None
        exact = accounts_by_key.get(normalized)
        if exact is not None:
            return exact

        best: Optional[Account] = None
        best_len = 0
        for account in accounts:
            account_key = self._normalize_key(account.name)
            if not account_key:
                continue
            if normalized in account_key or account_key in normalized:
                if len(account_key) > best_len:
                    best = account
                    best_len = len(account_key)
        return best


__all__ = ["InvestmentSnapshotService"]
