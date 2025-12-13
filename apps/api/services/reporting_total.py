"""Helpers for the total overview report payload."""

from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Callable, Dict, Iterable, List, Optional, Tuple, TypedDict, cast
from uuid import UUID

from sqlmodel import Session, select

from ..models import Account
from ..models.investment_snapshot import InvestmentSnapshot
from ..repositories.reporting import ReportingRepository, TransactionAmountRow
from ..shared import AccountType, TransactionType, coerce_decimal


@dataclass(frozen=True)
class Window:
    start: datetime
    end: datetime
    month_starts: List[datetime]
    month_ends: List[date]


IncomeExpenseClassifier = Callable[[TransactionAmountRow], Tuple[Decimal, Decimal]]
MerchantKeyFn = Callable[[Optional[str]], str]


class SourceBucket(TypedDict):
    source: str
    total: Decimal
    monthly: List[Decimal]
    transaction_count: int


class CategoryBucket12m(TypedDict):
    category_id: Optional[str]
    name: str
    total: Decimal
    monthly: List[Decimal]
    icon: Optional[str]
    color_hex: Optional[str]
    transaction_count: int


class CategoryBucketLifetime(TypedDict):
    category_id: Optional[str]
    name: str
    total: Decimal
    icon: Optional[str]
    color_hex: Optional[str]
    transaction_count: int


class CategoryChangeBucket(TypedDict):
    category_id: Optional[str]
    name: str
    amount: Decimal
    prev_amount: Decimal
    delta: Decimal
    delta_pct: Optional[Decimal]


class AccountFlowBucket(TypedDict):
    account_id: str
    name: str
    account_type: AccountType
    start_balance: Decimal
    end_balance: Decimal
    change: Decimal
    income: Decimal
    expense: Decimal
    transfers_in: Decimal
    transfers_out: Decimal
    net_operating: Decimal
    net_transfers: Decimal
    monthly_income: List[Decimal]
    monthly_expense: List[Decimal]
    monthly_transfers_in: List[Decimal]
    monthly_transfers_out: List[Decimal]
    monthly_change: List[Decimal]


class DebtAccountBucket(TypedDict):
    account_id: str
    name: str
    start_debt: Decimal
    end_debt: Decimal
    delta: Decimal
    monthly_debt: List[Decimal]


def _month_start(base: datetime, months_back: int) -> datetime:
    year = base.year
    month = base.month - months_back
    while month <= 0:
        month += 12
        year -= 1
    return base.replace(year=year, month=month, day=1)


def _month_end(day: date) -> date:
    return date(day.year, day.month, calendar.monthrange(day.year, day.month)[1])


def _window_last_months(*, as_of: date, months: int) -> Window:
    now = datetime.combine(as_of, datetime.min.time(), tzinfo=timezone.utc)
    start_month = now.replace(day=1)
    month_starts = [_month_start(start_month, offset) for offset in range(months - 1, -1, -1)]
    month_ends = [_month_end(ms.date()) for ms in month_starts]
    start = month_starts[0]
    end = datetime.combine(as_of + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    return Window(start=start, end=end, month_starts=month_starts, month_ends=month_ends)


def _bucket_monthly(
    *,
    rows: Iterable[TransactionAmountRow],
    month_starts: List[datetime],
    classify_income_expense: IncomeExpenseClassifier,
) -> Tuple[List[Decimal], List[Decimal]]:
    income = [Decimal("0") for _ in range(len(month_starts))]
    expense = [Decimal("0") for _ in range(len(month_starts))]
    base = month_starts[0]
    for row in rows:
        idx = (row.occurred_at.year - base.year) * 12 + (row.occurred_at.month - base.month)
        if idx < 0 or idx >= len(month_starts):
            continue
        inc, exp = classify_income_expense(row)
        income[idx] += inc
        expense[idx] += exp
    return income, expense


def _value_at_or_before(points: List[Tuple[date, Decimal]], target: date) -> Optional[Decimal]:
    if not points:
        return None
    idx = 0
    latest: Optional[Decimal] = None
    while idx < len(points) and points[idx][0] <= target:
        latest = points[idx][1]
        idx += 1
    return latest


def build_total_overview(
    *,
    session: Session,
    repository: ReportingRepository,
    as_of: date,
    account_id_list: Optional[List[UUID]],
    net_worth_points: List[Tuple[date, Decimal]],
    classify_income_expense: IncomeExpenseClassifier,
    merchant_key: MerchantKeyFn,
) -> dict[str, object]:
    window_12m = _window_last_months(as_of=as_of, months=12)
    window_prev_12m = _window_last_months(
        as_of=window_12m.month_starts[0].date() - timedelta(days=1),
        months=12,
    )

    # Lifetime totals.
    rows_all = repository.fetch_transaction_amounts(
        start=datetime(1900, 1, 1, tzinfo=timezone.utc),
        end=window_12m.end,
        account_ids=account_id_list,
    )
    lifetime_income = Decimal("0")
    lifetime_expense = Decimal("0")
    for row in rows_all:
        inc, exp = classify_income_expense(row)
        lifetime_income += inc
        lifetime_expense += exp
    lifetime_saved = lifetime_income - lifetime_expense
    lifetime_rate = (
        lifetime_saved / lifetime_income * Decimal("100") if lifetime_income > 0 else None
    )

    # Last 12 months + run-rate.
    rows_12m = repository.fetch_transaction_amounts(
        start=window_12m.start,
        end=window_12m.end,
        account_ids=account_id_list,
    )
    rows_prev_12m = repository.fetch_transaction_amounts(
        start=window_prev_12m.start,
        end=window_prev_12m.end,
        account_ids=account_id_list,
    )

    income_12m, expense_12m = _bucket_monthly(
        rows=rows_12m,
        month_starts=window_12m.month_starts,
        classify_income_expense=classify_income_expense,
    )
    income_prev_12m, expense_prev_12m = _bucket_monthly(
        rows=rows_prev_12m,
        month_starts=window_prev_12m.month_starts,
        classify_income_expense=classify_income_expense,
    )

    total_income_12m = sum(income_12m, Decimal("0"))
    total_expense_12m = sum(expense_12m, Decimal("0"))
    saved_12m = total_income_12m - total_expense_12m
    rate_12m = saved_12m / total_income_12m * Decimal("100") if total_income_12m > 0 else None
    avg_income_12m = total_income_12m / Decimal("12") if total_income_12m > 0 else Decimal("0")
    avg_expense_12m = total_expense_12m / Decimal("12") if total_expense_12m > 0 else Decimal("0")
    avg_net_12m = saved_12m / Decimal("12")

    total_income_6m = sum(income_12m[-6:], Decimal("0"))
    total_expense_6m = sum(expense_12m[-6:], Decimal("0"))
    saved_6m = total_income_6m - total_expense_6m
    rate_6m = saved_6m / total_income_6m * Decimal("100") if total_income_6m > 0 else None
    avg_income_6m = total_income_6m / Decimal("6") if total_income_6m > 0 else Decimal("0")
    avg_expense_6m = total_expense_6m / Decimal("6") if total_expense_6m > 0 else Decimal("0")
    avg_net_6m = saved_6m / Decimal("6")

    # Net worth now + deltas.
    net_worth_now = net_worth_points[-1][1] if net_worth_points else Decimal("0")

    def net_worth_at(days_back: int) -> Optional[Decimal]:
        target = as_of - timedelta(days=days_back)
        return _value_at_or_before(net_worth_points, target)

    nw_30 = net_worth_at(30)
    nw_90 = net_worth_at(90)
    nw_365 = net_worth_at(365)
    nw_start = net_worth_points[0][1] if net_worth_points else None

    net_worth_change = {
        "days_30": (net_worth_now - nw_30) if nw_30 is not None else Decimal("0"),
        "days_90": (net_worth_now - nw_90) if nw_90 is not None else Decimal("0"),
        "days_365": (net_worth_now - nw_365) if nw_365 is not None else Decimal("0"),
        "since_start": (net_worth_now - nw_start) if nw_start is not None else Decimal("0"),
    }

    # Sources (last 12m).
    income_sources: Dict[str, SourceBucket] = {}
    expense_sources: Dict[str, SourceBucket] = {}
    for row in rows_12m:
        idx = (row.occurred_at.year - window_12m.month_starts[0].year) * 12 + (
            row.occurred_at.month - window_12m.month_starts[0].month
        )
        if idx < 0 or idx >= 12:
            continue
        inc, exp = classify_income_expense(row)
        if inc > 0:
            key = merchant_key(row.description)
            if key not in income_sources:
                income_sources[key] = {
                    "source": key,
                    "total": Decimal("0"),
                    "monthly": [Decimal("0") for _ in range(12)],
                    "transaction_count": 0,
                }
            source_bucket = income_sources[key]
            source_bucket["total"] += inc
            source_bucket["monthly"][idx] += inc
            source_bucket["transaction_count"] += 1
        if exp > 0:
            key = merchant_key(row.description)
            if key not in expense_sources:
                expense_sources[key] = {
                    "source": key,
                    "total": Decimal("0"),
                    "monthly": [Decimal("0") for _ in range(12)],
                    "transaction_count": 0,
                }
            source_bucket = expense_sources[key]
            source_bucket["total"] += exp
            source_bucket["monthly"][idx] += exp
            source_bucket["transaction_count"] += 1

    income_sources_rows = sorted(
        income_sources.values(), key=lambda item: item["total"], reverse=True
    )
    expense_sources_rows = sorted(
        expense_sources.values(), key=lambda item: item["total"], reverse=True
    )

    # Categories (expense) last 12m and lifetime.
    exp_by_category_12: Dict[str, CategoryBucket12m] = {}
    exp_by_category_prev: Dict[str, Decimal] = {}
    exp_by_category_lifetime: Dict[str, CategoryBucketLifetime] = {}

    def cat_key(row: TransactionAmountRow) -> str:
        return str(row.category_id or "uncategorized")

    for row in rows_12m:
        _inc, exp = classify_income_expense(row)
        if exp <= 0:
            continue
        idx = (row.occurred_at.year - window_12m.month_starts[0].year) * 12 + (
            row.occurred_at.month - window_12m.month_starts[0].month
        )
        if idx < 0 or idx >= 12:
            continue
        key = cat_key(row)
        category_bucket = exp_by_category_12.get(key)
        if category_bucket is None:
            category_bucket = {
                "category_id": str(row.category_id) if row.category_id else None,
                "name": row.category_name or "Uncategorized",
                "total": Decimal("0"),
                "monthly": [Decimal("0") for _ in range(12)],
                "icon": row.category_icon,
                "color_hex": row.category_color_hex,
                "transaction_count": 0,
            }
            exp_by_category_12[key] = category_bucket
        category_bucket["total"] += exp
        category_bucket["monthly"][idx] += exp
        category_bucket["transaction_count"] += 1

    for row in rows_prev_12m:
        _inc, exp = classify_income_expense(row)
        if exp <= 0:
            continue
        key = cat_key(row)
        exp_by_category_prev[key] = exp_by_category_prev.get(key, Decimal("0")) + exp

    for row in rows_all:
        _inc, exp = classify_income_expense(row)
        if exp <= 0:
            continue
        key = cat_key(row)
        lifetime_bucket = exp_by_category_lifetime.get(key)
        if lifetime_bucket is None:
            lifetime_bucket = {
                "category_id": str(row.category_id) if row.category_id else None,
                "name": row.category_name or "Uncategorized",
                "total": Decimal("0"),
                "icon": row.category_icon,
                "color_hex": row.category_color_hex,
                "transaction_count": 0,
            }
            exp_by_category_lifetime[key] = lifetime_bucket
        lifetime_bucket["total"] += exp
        lifetime_bucket["transaction_count"] += 1

    categories_12m_sorted = sorted(
        exp_by_category_12.values(), key=lambda item: coerce_decimal(item["total"]), reverse=True
    )
    categories_lifetime_sorted = sorted(
        exp_by_category_lifetime.values(),
        key=lambda item: coerce_decimal(item["total"]),
        reverse=True,
    )

    category_changes: List[CategoryChangeBucket] = []
    for key, current_bucket in exp_by_category_12.items():
        current_total = coerce_decimal(current_bucket["total"])
        prev_total = exp_by_category_prev.get(key, Decimal("0"))
        delta = current_total - prev_total
        delta_pct = (delta / prev_total * Decimal("100")) if prev_total > 0 else None
        category_changes.append(
            {
                "category_id": current_bucket["category_id"],
                "name": current_bucket["name"],
                "amount": current_total,
                "prev_amount": prev_total,
                "delta": delta,
                "delta_pct": delta_pct,
            }
        )
    category_changes.sort(key=lambda item: item["delta"], reverse=True)

    # Account flows (last 12m) + debt breakdown.
    user_id = repository.user_id
    accounts_statement = select(Account).where(Account.user_id == user_id)
    if account_id_list:
        accounts_statement = accounts_statement.where(cast(Any, Account.id).in_(account_id_list))
    accounts = list(session.exec(accounts_statement).all())
    accounts = [acc for acc in accounts if acc.name not in {"Offset", "Unassigned"}]

    account_flows: List[AccountFlowBucket] = []
    debt_accounts: List[DebtAccountBucket] = []
    debt_ids = [acc.id for acc in accounts if acc.account_type == AccountType.DEBT]

    def balance_at(day: date, ids: List[UUID]) -> Decimal:
        cutoff = datetime.combine(day + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        return repository.sum_legs_before(before=cutoff, account_ids=ids)

    window_start_balance = window_12m.start

    for account in accounts:
        if account.account_type == AccountType.INVESTMENT:
            continue
        start_balance = repository.sum_legs_before(
            before=window_start_balance, account_ids=[account.id]
        )
        end_balance = repository.sum_legs_before(before=window_12m.end, account_ids=[account.id])
        change = end_balance - start_balance
        account_rows = repository.fetch_transaction_amounts(
            start=window_12m.start, end=window_12m.end, account_ids=[account.id]
        )

        monthly_income_by_acc = [Decimal("0") for _ in range(12)]
        monthly_expense_by_acc = [Decimal("0") for _ in range(12)]
        monthly_transfers_in = [Decimal("0") for _ in range(12)]
        monthly_transfers_out = [Decimal("0") for _ in range(12)]
        monthly_change = [Decimal("0") for _ in range(12)]

        base = window_12m.month_starts[0]
        for row in account_rows:
            idx = (row.occurred_at.year - base.year) * 12 + (row.occurred_at.month - base.month)
            if idx < 0 or idx >= 12:
                continue
            amount = coerce_decimal(row.amount)
            monthly_change[idx] += amount
            if row.transaction_type == TransactionType.TRANSFER:
                if amount >= 0:
                    monthly_transfers_in[idx] += amount
                else:
                    monthly_transfers_out[idx] += -amount
                continue
            inc, exp = classify_income_expense(row)
            monthly_income_by_acc[idx] += inc
            monthly_expense_by_acc[idx] += exp

        income_total = sum(monthly_income_by_acc, Decimal("0"))
        expense_total = sum(monthly_expense_by_acc, Decimal("0"))
        transfers_in_total = sum(monthly_transfers_in, Decimal("0"))
        transfers_out_total = sum(monthly_transfers_out, Decimal("0"))
        net_operating = income_total - expense_total
        net_transfers = transfers_in_total - transfers_out_total

        account_flows.append(
            {
                "account_id": str(account.id),
                "name": account.name,
                "account_type": account.account_type,
                "start_balance": start_balance,
                "end_balance": end_balance,
                "change": change,
                "income": income_total,
                "expense": expense_total,
                "transfers_in": transfers_in_total,
                "transfers_out": transfers_out_total,
                "net_operating": net_operating,
                "net_transfers": net_transfers,
                "monthly_income": monthly_income_by_acc,
                "monthly_expense": monthly_expense_by_acc,
                "monthly_transfers_in": monthly_transfers_in,
                "monthly_transfers_out": monthly_transfers_out,
                "monthly_change": monthly_change,
            }
        )

        if account.account_type == AccountType.DEBT:
            debt_monthly = []
            for month_end in window_12m.month_ends:
                bal = balance_at(month_end, [account.id])
                debt_monthly.append(-bal if bal < 0 else bal)
            start_debt = debt_monthly[0] if debt_monthly else Decimal("0")
            end_debt = debt_monthly[-1] if debt_monthly else Decimal("0")
            debt_accounts.append(
                {
                    "account_id": str(account.id),
                    "name": account.name,
                    "start_debt": start_debt,
                    "end_debt": end_debt,
                    "delta": end_debt - start_debt,
                    "monthly_debt": debt_monthly,
                }
            )

    account_flows.sort(key=lambda item: abs(item["change"]), reverse=True)
    debt_accounts.sort(key=lambda item: item["end_debt"], reverse=True)

    # Debt totals.
    debt_now_ledger = (
        repository.current_balance_total(account_ids=debt_ids) if debt_ids else Decimal("0")
    )
    debt_now = -debt_now_ledger if debt_now_ledger < 0 else debt_now_ledger
    debt_12m_ago_ledger = (
        balance_at(window_12m.month_ends[0], debt_ids) if debt_ids else Decimal("0")
    )
    debt_12m_ago = -debt_12m_ago_ledger if debt_12m_ago_ledger < 0 else debt_12m_ago_ledger
    debt_change_12m = debt_now - debt_12m_ago
    debt_to_income = (debt_now / total_income_12m) if total_income_12m > 0 else None

    # Cash runway (NORMAL accounts only).
    cash_ids = [acc.id for acc in accounts if acc.account_type == AccountType.NORMAL]
    cash_balance = (
        repository.current_balance_total(account_ids=cash_ids) if cash_ids else Decimal("0")
    )
    runway_months = (
        cash_balance / avg_expense_6m if avg_expense_6m > 0 and cash_balance > 0 else None
    )

    # Investments summary (only for full view).
    investments = {
        "as_of": as_of.isoformat(),
        "current_value": Decimal("0"),
        "value_12m_ago": Decimal("0"),
        "change_12m": Decimal("0"),
        "change_pct_12m": None,
        "contributions_lifetime": Decimal("0"),
        "withdrawals_lifetime": Decimal("0"),
        "net_contributions_lifetime": Decimal("0"),
        "contributions_12m": Decimal("0"),
        "withdrawals_12m": Decimal("0"),
        "net_contributions_12m": Decimal("0"),
        "monthly_values_12m": [Decimal("0") for _ in range(12)],
        "accounts": [],
    }
    if account_id_list is None:
        start_target = window_12m.month_starts[0].date() - timedelta(days=1)
        start_snapshot = session.exec(
            select(InvestmentSnapshot)
            .where(InvestmentSnapshot.user_id == user_id)
            .where(cast(Any, InvestmentSnapshot.snapshot_date) <= start_target)
            .order_by(cast(Any, InvestmentSnapshot.snapshot_date).desc())
            .limit(1)
        ).first()
        end_snapshot = session.exec(
            select(InvestmentSnapshot)
            .where(InvestmentSnapshot.user_id == user_id)
            .where(cast(Any, InvestmentSnapshot.snapshot_date) <= as_of)
            .order_by(cast(Any, InvestmentSnapshot.snapshot_date).desc())
            .limit(1)
        ).first()

        start_value = (
            coerce_decimal(start_snapshot.portfolio_value)
            if start_snapshot and start_snapshot.portfolio_value is not None
            else Decimal("0")
        )
        end_value = (
            coerce_decimal(end_snapshot.portfolio_value)
            if end_snapshot and end_snapshot.portfolio_value is not None
            else Decimal("0")
        )
        change_value = end_value - start_value
        change_pct = (change_value / start_value * Decimal("100")) if start_value > 0 else None

        snap_rows = repository.list_investment_snapshots_until(end=as_of)
        snap_idx = 0
        latest = Decimal("0")
        monthly_values = [Decimal("0") for _ in range(12)]
        for idx, month_end in enumerate(window_12m.month_ends):
            while snap_idx < len(snap_rows) and snap_rows[snap_idx][0] <= month_end:
                latest = snap_rows[snap_idx][1]
                snap_idx += 1
            monthly_values[idx] = latest

        investment_accounts = list(
            session.exec(
                select(Account)
                .where(Account.user_id == user_id)
                .where(Account.account_type == AccountType.INVESTMENT)
            ).all()
        )
        investment_names = {acc.name for acc in investment_accounts}

        def accounts_map(snapshot: InvestmentSnapshot | None) -> Dict[str, Decimal]:
            if not snapshot:
                return {}
            accounts_raw = cast(dict[str, object], snapshot.parsed_payload or {}).get("accounts")
            if not isinstance(accounts_raw, dict):
                return {}
            mapped: Dict[str, Decimal] = {}
            for key, value in accounts_raw.items():
                if not isinstance(key, str) or key not in investment_names:
                    continue
                mapped[key] = coerce_decimal(value)
            return mapped

        start_accounts = accounts_map(start_snapshot)
        end_accounts = accounts_map(end_snapshot)
        per_account = []
        for name in sorted(set(start_accounts.keys()) | set(end_accounts.keys())):
            acc_start = start_accounts.get(name, Decimal("0"))
            acc_end = end_accounts.get(name, Decimal("0"))
            per_account.append(
                {
                    "account_name": name,
                    "start_value": acc_start,
                    "end_value": acc_end,
                    "change": acc_end - acc_start,
                }
            )

        # Contributions/withdrawals (lifetime + last 12m) from labeled transfers.
        contrib_life = Decimal("0")
        withdr_life = Decimal("0")
        contrib_12 = Decimal("0")
        withdr_12 = Decimal("0")
        for row in rows_all:
            if row.transaction_type != TransactionType.TRANSFER:
                continue
            desc = (row.description or "").lower()
            amount = abs(coerce_decimal(row.amount))
            is_recent = row.occurred_at >= window_12m.start
            if "transfer to investments" in desc:
                contrib_life += amount
                if is_recent:
                    contrib_12 += amount
            elif "transfer from investments" in desc:
                withdr_life += amount
                if is_recent:
                    withdr_12 += amount

        investments = {
            "as_of": as_of.isoformat(),
            "current_value": end_value,
            "value_12m_ago": start_value,
            "change_12m": change_value,
            "change_pct_12m": change_pct,
            "contributions_lifetime": contrib_life,
            "withdrawals_lifetime": withdr_life,
            "net_contributions_lifetime": contrib_life - withdr_life,
            "contributions_12m": contrib_12,
            "withdrawals_12m": withdr_12,
            "net_contributions_12m": contrib_12 - withdr_12,
            "monthly_values_12m": monthly_values,
            "accounts": per_account,
        }

    # Insights.
    insights: List[str] = []
    if rate_12m is not None:
        insights.append(f"Savings rate (12m): {rate_12m.quantize(Decimal('1'))}%")
    if runway_months is not None:
        insights.append(f"Cash runway: ~{runway_months.quantize(Decimal('1'))} months")

    return {
        "as_of": as_of.isoformat(),
        "net_worth": net_worth_now,
        "net_worth_change": net_worth_change,
        "lifetime": {
            "income": lifetime_income,
            "expense": lifetime_expense,
            "saved": lifetime_saved,
            "savings_rate_pct": lifetime_rate,
        },
        "last_12m": {
            "income": total_income_12m,
            "expense": total_expense_12m,
            "saved": saved_12m,
            "savings_rate_pct": rate_12m,
        },
        "run_rate_6m": {
            "avg_monthly_income": avg_income_6m,
            "avg_monthly_expense": avg_expense_6m,
            "avg_monthly_net": avg_net_6m,
            "savings_rate_pct": rate_6m,
        },
        "run_rate_12m": {
            "avg_monthly_income": avg_income_12m,
            "avg_monthly_expense": avg_expense_12m,
            "avg_monthly_net": avg_net_12m,
            "savings_rate_pct": rate_12m,
        },
        "cash_runway": {
            "cash_balance": cash_balance,
            "avg_monthly_expense_6m": avg_expense_6m,
            "runway_months": runway_months,
        },
        "investments": investments,
        "debt": {
            "total": debt_now,
            "value_12m_ago": debt_12m_ago,
            "change_12m": debt_change_12m,
            "debt_to_income_12m": debt_to_income,
            "accounts": debt_accounts,
        },
        "account_flows": account_flows,
        "income_sources": income_sources_rows[:50],
        "expense_sources": expense_sources_rows[:50],
        "top_categories_12m": categories_12m_sorted[:20],
        "top_categories_lifetime": categories_lifetime_sorted[:20],
        "category_changes_12m": category_changes[:20],
        "monthly_income_12m": income_12m,
        "monthly_expense_12m": expense_12m,
        "monthly_income_prev_12m": income_prev_12m,
        "monthly_expense_prev_12m": expense_prev_12m,
        "insights": insights,
    }
