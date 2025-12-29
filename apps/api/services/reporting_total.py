"""Helpers for the total overview report payload."""

from __future__ import annotations

import calendar
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional, Tuple, TypedDict, cast
from uuid import UUID

from sqlalchemy import case, extract, func
from sqlmodel import Session, select

from ..models import Account, Transaction, TransactionLeg
from ..models.investment_snapshot import InvestmentSnapshot
from ..repositories.reporting import ReportingRepository, TransactionAmountRow
from ..shared import AccountType, TransactionType, coerce_decimal

IncomeExpenseClassifier = Callable[[TransactionAmountRow], Tuple[Decimal, Decimal]]
MerchantKeyFn = Callable[[Optional[str]], str]


class YearTotals(TypedDict):
    income: Decimal
    expense: Decimal


class MonthTotals(TypedDict):
    income: Decimal
    expense: Decimal


class CategoryAgg(TypedDict):
    category_id: Optional[str]
    name: str
    total: Decimal
    icon: Optional[str]
    color_hex: Optional[str]
    transaction_count: int


class SourceAgg(TypedDict):
    source: str
    total: Decimal
    transaction_count: int


class DebtAccountRow(TypedDict):
    account_id: str
    name: str
    current_debt: Decimal
    prev_year_end_debt: Optional[Decimal]
    delta: Optional[Decimal]


class CategoryMixEntry(TypedDict):
    category_id: Optional[str]
    name: str
    total: Decimal
    icon: Optional[str]
    color_hex: Optional[str]
    transaction_count: int


class CategoryMixYear(TypedDict):
    year: int
    categories: List[CategoryMixEntry]


class CategoryChangeRow(TypedDict):
    category_id: Optional[str]
    name: str
    amount: Decimal
    prev_amount: Decimal
    delta: Decimal
    delta_pct: Optional[Decimal]


class SourceRow(TypedDict):
    source: str
    total: Decimal
    transaction_count: int


class SourceChangeRow(TypedDict):
    source: str
    amount: Decimal
    prev_amount: Decimal
    delta: Decimal
    delta_pct: Optional[Decimal]


class AccountOverviewRow(TypedDict):
    account_id: str
    name: str
    account_type: AccountType
    current_balance: Decimal
    operating_income: Decimal
    operating_expense: Decimal
    net_operating: Decimal
    transfers_in: Decimal
    transfers_out: Decimal
    net_transfers: Decimal
    first_transaction_date: Optional[str]


class InvestmentSeriesPoint(TypedDict):
    date: str
    value: Decimal


class InvestmentAccountValue(TypedDict):
    account_name: str
    value: Decimal


class InvestmentYearRow(TypedDict):
    year: int
    end_value: Decimal
    contributions: Decimal
    withdrawals: Decimal
    net_contributions: Decimal
    implied_return: Optional[Decimal]


def _month_end(year: int, month: int) -> date:
    return date(year, month, calendar.monthrange(year, month)[1])


def _next_month(day: date) -> date:
    if day.month == 12:
        return date(day.year + 1, 1, 1)
    return date(day.year, day.month + 1, 1)


def _compress_points_monthly(
    *, points: List[Tuple[date, Decimal]], as_of: date
) -> List[Tuple[date, Decimal]]:
    if not points:
        return []
    start = date(points[0][0].year, points[0][0].month, 1)
    cursor = start
    idx = 0
    latest = points[0][1]
    results: List[Tuple[date, Decimal]] = []

    while cursor <= as_of:
        month_end = _month_end(cursor.year, cursor.month)
        target = as_of if month_end > as_of else month_end
        while idx < len(points) and points[idx][0] <= target:
            latest = points[idx][1]
            idx += 1
        results.append((target, latest))
        cursor = _next_month(cursor)
    return results


def _ensure_category(mapping: Dict[str, CategoryAgg], *, row: TransactionAmountRow) -> CategoryAgg:
    key = str(row.category_id or "uncategorized")
    bucket = mapping.get(key)
    if bucket is None:
        new_bucket: CategoryAgg = {
            "category_id": str(row.category_id) if row.category_id else None,
            "name": row.category_name or "Uncategorized",
            "total": Decimal("0"),
            "icon": row.category_icon,
            "color_hex": row.category_color_hex,
            "transaction_count": 0,
        }
        mapping[key] = new_bucket
        return new_bucket

    if row.category_name:
        bucket["name"] = row.category_name
    if row.category_icon:
        bucket["icon"] = row.category_icon
    if row.category_color_hex:
        bucket["color_hex"] = row.category_color_hex
    return bucket


def _ensure_source(mapping: Dict[str, SourceAgg], key: str) -> SourceAgg:
    bucket = mapping.get(key)
    if bucket is None:
        bucket = cast(SourceAgg, {"source": key, "total": Decimal("0"), "transaction_count": 0})
        mapping[key] = bucket
    return bucket


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
    end = datetime.combine(as_of + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)

    rows_all = repository.fetch_transaction_amounts(
        start=datetime(1900, 1, 1, tzinfo=timezone.utc),
        end=end,
        account_ids=account_id_list,
    )

    user_id = repository.user_id
    accounts_statement = select(Account).where(Account.user_id == user_id)
    if account_id_list:
        accounts_statement = accounts_statement.where(cast(Any, Account.id).in_(account_id_list))
    accounts = list(session.exec(accounts_statement).all())
    accounts = [acc for acc in accounts if acc.name not in {"Offset", "Unassigned"}]

    debt_ids = [acc.id for acc in accounts if acc.account_type == AccountType.DEBT]
    cash_ids = [acc.id for acc in accounts if acc.account_type == AccountType.NORMAL]

    def balance_at(day: date, ids: List[UUID]) -> Decimal:
        cutoff = datetime.combine(day + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        return repository.sum_legs_before(before=cutoff, account_ids=ids)

    yearly: Dict[int, YearTotals] = {}
    monthly: Dict[date, MonthTotals] = {}
    expense_categories_by_year: Dict[int, Dict[str, CategoryAgg]] = defaultdict(dict)
    income_categories_by_year: Dict[int, Dict[str, CategoryAgg]] = defaultdict(dict)
    expense_sources_by_year: Dict[int, Dict[str, SourceAgg]] = defaultdict(dict)
    income_sources_by_year: Dict[int, Dict[str, SourceAgg]] = defaultdict(dict)

    expense_categories_lifetime: Dict[str, CategoryAgg] = {}
    income_categories_lifetime: Dict[str, CategoryAgg] = {}
    expense_sources_lifetime: Dict[str, SourceAgg] = {}
    income_sources_lifetime: Dict[str, SourceAgg] = {}

    contributions_by_year: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    withdrawals_by_year: Dict[int, Decimal] = defaultdict(lambda: Decimal("0"))
    contributions_lifetime = Decimal("0")
    withdrawals_lifetime = Decimal("0")

    for row in rows_all:
        year = row.occurred_at.year
        if year not in yearly:
            yearly[year] = {"income": Decimal("0"), "expense": Decimal("0")}
        month_key = date(row.occurred_at.year, row.occurred_at.month, 1)
        if month_key not in monthly:
            monthly[month_key] = {"income": Decimal("0"), "expense": Decimal("0")}

        inc, exp = classify_income_expense(row)
        yearly[year]["income"] += inc
        yearly[year]["expense"] += exp
        monthly[month_key]["income"] += inc
        monthly[month_key]["expense"] += exp

        if exp > 0:
            bucket = _ensure_category(expense_categories_by_year[year], row=row)
            bucket["total"] += exp
            bucket["transaction_count"] += 1
            life_bucket = _ensure_category(expense_categories_lifetime, row=row)
            life_bucket["total"] += exp
            life_bucket["transaction_count"] += 1

            source_key = merchant_key(row.description)
            src = _ensure_source(expense_sources_by_year[year], source_key)
            src["total"] += exp
            src["transaction_count"] += 1
            life_src = _ensure_source(expense_sources_lifetime, source_key)
            life_src["total"] += exp
            life_src["transaction_count"] += 1

        if inc > 0:
            bucket = _ensure_category(income_categories_by_year[year], row=row)
            bucket["total"] += inc
            bucket["transaction_count"] += 1
            life_bucket = _ensure_category(income_categories_lifetime, row=row)
            life_bucket["total"] += inc
            life_bucket["transaction_count"] += 1

            source_key = merchant_key(row.description)
            src = _ensure_source(income_sources_by_year[year], source_key)
            src["total"] += inc
            src["transaction_count"] += 1
            life_src = _ensure_source(income_sources_lifetime, source_key)
            life_src["total"] += inc
            life_src["transaction_count"] += 1

    if account_id_list is None:
        investment_account_ids = [
            acc.id
            for acc in accounts
            if acc.account_type == AccountType.INVESTMENT and acc.id is not None
        ]
        if investment_account_ids:
            noninv_tx_ids = (
                select(cast(Any, TransactionLeg.transaction_id))
                .join(Account, cast(Any, TransactionLeg.account_id) == cast(Any, Account.id))
                .where(Account.account_type != AccountType.INVESTMENT)
                .distinct()
            ).subquery()

            year_expr = cast(Any, extract("year", cast(Any, Transaction.occurred_at)))
            stmt = (
                select(
                    year_expr.label("year"),
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
                    cast(Any, TransactionLeg.account_id).in_(investment_account_ids),
                    cast(Any, Transaction.occurred_at) < end,
                    cast(Any, Transaction.transaction_type) != TransactionType.ADJUSTMENT,
                    cast(Any, TransactionLeg.transaction_id).in_(
                        select(cast(Any, noninv_tx_ids.c.transaction_id))
                    ),
                )
                .group_by(year_expr)
            )
            for year, deposits, withdrawals in session.exec(stmt).all():
                if year is None:
                    continue
                year_key = int(year)
                contributions_by_year[year_key] += coerce_decimal(deposits or 0)
                withdrawals_by_year[year_key] += coerce_decimal(withdrawals or 0)

            contributions_lifetime = sum(contributions_by_year.values(), Decimal("0"))
            withdrawals_lifetime = sum(withdrawals_by_year.values(), Decimal("0"))

    years_sorted = sorted(yearly.keys())
    monthly_income_expense = [
        {"date": month.isoformat(), "income": totals["income"], "expense": totals["expense"]}
        for month, totals in sorted(monthly.items(), key=lambda item: item[0])
    ]
    lifetime_income = sum((yearly[y]["income"] for y in years_sorted), Decimal("0"))
    lifetime_expense = sum((yearly[y]["expense"] for y in years_sorted), Decimal("0"))
    lifetime_saved = lifetime_income - lifetime_expense
    lifetime_rate = (
        lifetime_saved / lifetime_income * Decimal("100") if lifetime_income > 0 else None
    )

    net_worth_now = net_worth_points[-1][1] if net_worth_points else Decimal("0")
    net_worth_monthly = _compress_points_monthly(points=net_worth_points, as_of=as_of)
    net_worth_series = [
        {"date": day.isoformat(), "net_worth": value} for day, value in net_worth_monthly
    ]

    yearly_rows = []
    best_year: Optional[int] = None
    worst_year: Optional[int] = None
    best_net: Optional[Decimal] = None
    worst_net: Optional[Decimal] = None
    for year in years_sorted:
        inc = yearly[year]["income"]
        exp = yearly[year]["expense"]
        net = inc - exp
        rate = net / inc * Decimal("100") if inc > 0 else None
        yearly_rows.append(
            {"year": year, "income": inc, "expense": exp, "net": net, "savings_rate_pct": rate}
        )
        if best_net is None or net > best_net:
            best_net = net
            best_year = year
        if worst_net is None or net < worst_net:
            worst_net = net
            worst_year = year

    cash_balance = (
        repository.current_balance_total(account_ids=cash_ids) if cash_ids else Decimal("0")
    )

    debt_now_ledger = (
        repository.current_balance_total(account_ids=debt_ids) if debt_ids else Decimal("0")
    )
    debt_now = -debt_now_ledger if debt_now_ledger < 0 else debt_now_ledger

    complete_years = [y for y in years_sorted if y < as_of.year]
    yoy_year = (
        complete_years[-1] if complete_years else (years_sorted[-1] if years_sorted else as_of.year)
    )
    yoy_prev_year = complete_years[-2] if len(complete_years) >= 2 else None

    prev_year_end = date(yoy_year - 1, 12, 31) if debt_ids else None
    debt_prev_year_end = None
    if prev_year_end is not None and yoy_year - 1 in yearly:
        prev_ledger = balance_at(prev_year_end, debt_ids)
        debt_prev_year_end = -prev_ledger if prev_ledger < 0 else prev_ledger
    debt_change = debt_now - debt_prev_year_end if debt_prev_year_end is not None else None

    debt_to_income_latest = None
    if yoy_year in yearly and yearly[yoy_year]["income"] > 0:
        debt_to_income_latest = debt_now / yearly[yoy_year]["income"]

    ledger_debt_points = repository.get_net_worth_history(account_ids=debt_ids) if debt_ids else []
    debt_points = [(point.period, coerce_decimal(point.net_worth)) for point in ledger_debt_points]
    debt_monthly = _compress_points_monthly(points=debt_points, as_of=as_of) if debt_points else []
    debt_series = [
        {"date": day.isoformat(), "debt": (-value if value < 0 else value)}
        for day, value in debt_monthly
    ]

    debt_accounts_rows: List[DebtAccountRow] = []
    for acc in [a for a in accounts if a.account_type == AccountType.DEBT]:
        current_ledger = repository.current_balance_total(account_ids=[acc.id])
        current_debt = -current_ledger if current_ledger < 0 else current_ledger
        prev_debt = None
        delta = None
        if prev_year_end is not None and yoy_year - 1 in yearly:
            prev_ledger = balance_at(prev_year_end, [acc.id])
            prev_debt = -prev_ledger if prev_ledger < 0 else prev_ledger
            delta = current_debt - prev_debt
        debt_accounts_rows.append(
            {
                "account_id": str(acc.id),
                "name": acc.name,
                "current_debt": current_debt,
                "prev_year_end_debt": prev_debt,
                "delta": delta,
            }
        )
    debt_accounts_rows.sort(key=lambda item: item["current_debt"], reverse=True)

    expense_lifetime_sorted = sorted(
        expense_categories_lifetime.values(), key=lambda item: item["total"], reverse=True
    )
    income_lifetime_sorted = sorted(
        income_categories_lifetime.values(), key=lambda item: item["total"], reverse=True
    )

    def build_category_heatmap(
        *,
        categories: List[CategoryAgg],
        categories_by_year: Dict[int, Dict[str, CategoryAgg]],
        years: List[int],
    ) -> dict[str, object]:
        rows: List[dict[str, object]] = []
        for cat in categories[:12]:
            key = str(cat["category_id"] or "uncategorized")
            totals: List[Decimal] = []
            for year in years:
                year_map = categories_by_year.get(year)
                if not year_map:
                    totals.append(Decimal("0"))
                    continue
                bucket = year_map.get(key)
                totals.append(bucket["total"] if bucket else Decimal("0"))
            rows.append(
                {
                    "category_id": cat["category_id"],
                    "name": cat["name"],
                    "icon": cat.get("icon"),
                    "color_hex": cat.get("color_hex"),
                    "totals": totals,
                }
            )
        return {"years": years, "rows": rows}

    def top_category_keys(categories: Dict[str, CategoryAgg], limit: int) -> List[str]:
        ranked = sorted(categories.items(), key=lambda kv: kv[1]["total"], reverse=True)
        return [key for key, _bucket in ranked[:limit]]

    expense_mix_keys = top_category_keys(expense_categories_lifetime, 8)
    income_mix_keys = top_category_keys(income_categories_lifetime, 8)

    def year_mix(
        *,
        year: int,
        totals: Dict[int, Dict[str, CategoryAgg]],
        keys: List[str],
        year_total: Decimal,
        lifetimes: Dict[str, CategoryAgg],
    ) -> CategoryMixYear:
        year_map = totals.get(year, {})
        entries: List[CategoryMixEntry] = []
        sum_top = Decimal("0")
        for key in keys:
            bucket = year_map.get(key)
            if bucket is None:
                base = lifetimes.get(key)
                entries.append(
                    {
                        "category_id": None if key == "uncategorized" else key,
                        "name": base["name"] if base else "Category",
                        "total": Decimal("0"),
                        "icon": base["icon"] if base else None,
                        "color_hex": base["color_hex"] if base else None,
                        "transaction_count": 0,
                    }
                )
                continue
            entries.append(
                {
                    "category_id": bucket["category_id"],
                    "name": bucket["name"],
                    "total": bucket["total"],
                    "icon": bucket["icon"],
                    "color_hex": bucket["color_hex"],
                    "transaction_count": bucket["transaction_count"],
                }
            )
            sum_top += bucket["total"]
        other_total = year_total - sum_top if year_total > sum_top else Decimal("0")
        entries.append(
            {
                "category_id": None,
                "name": "Other",
                "total": other_total,
                "icon": None,
                "color_hex": None,
                "transaction_count": 0,
            }
        )
        entries = [e for e in entries if e["total"] > 0]
        return {"year": year, "categories": entries}

    expense_mix_by_year = [
        year_mix(
            year=year,
            totals=expense_categories_by_year,
            keys=expense_mix_keys,
            year_total=yearly[year]["expense"],
            lifetimes=expense_categories_lifetime,
        )
        for year in years_sorted
    ]
    income_mix_by_year = [
        year_mix(
            year=year,
            totals=income_categories_by_year,
            keys=income_mix_keys,
            year_total=yearly[year]["income"],
            lifetimes=income_categories_lifetime,
        )
        for year in years_sorted
    ]

    def yoy_category_changes(
        *,
        latest_year: int,
        prev_year: Optional[int],
        categories: Dict[int, Dict[str, CategoryAgg]],
    ) -> List[CategoryChangeRow]:
        if prev_year is None:
            return []
        latest_map = categories.get(latest_year, {})
        prev_map = categories.get(prev_year, {})
        keys = set(latest_map.keys()) | set(prev_map.keys())
        changes: List[CategoryChangeRow] = []
        for key in keys:
            latest_bucket = latest_map.get(key)
            prev_bucket = prev_map.get(key)
            latest_total = latest_bucket["total"] if latest_bucket else Decimal("0")
            prev_total = prev_bucket["total"] if prev_bucket else Decimal("0")
            delta = latest_total - prev_total
            delta_pct = (delta / prev_total * Decimal("100")) if prev_total > 0 else None
            ref_bucket = latest_bucket if latest_bucket is not None else prev_bucket
            name = ref_bucket["name"] if ref_bucket is not None else "Category"
            category_id = ref_bucket["category_id"] if ref_bucket is not None else None
            changes.append(
                {
                    "category_id": category_id,
                    "name": name,
                    "amount": latest_total,
                    "prev_amount": prev_total,
                    "delta": delta,
                    "delta_pct": delta_pct,
                }
            )
        changes.sort(key=lambda item: abs(item["delta"]), reverse=True)
        return changes[:20]

    expense_changes = yoy_category_changes(
        latest_year=yoy_year, prev_year=yoy_prev_year, categories=expense_categories_by_year
    )
    income_changes = yoy_category_changes(
        latest_year=yoy_year, prev_year=yoy_prev_year, categories=income_categories_by_year
    )

    def sources_to_rows(sources: Dict[str, SourceAgg]) -> List[SourceRow]:
        rows = sorted(sources.values(), key=lambda item: item["total"], reverse=True)[:20]
        return [
            {
                "source": r["source"],
                "total": r["total"],
                "transaction_count": r["transaction_count"],
            }
            for r in rows
        ]

    income_sources_rows = sources_to_rows(income_sources_lifetime)
    expense_sources_rows = sources_to_rows(expense_sources_lifetime)

    def yoy_source_changes(
        *,
        latest_year: int,
        prev_year: Optional[int],
        sources: Dict[int, Dict[str, SourceAgg]],
    ) -> List[SourceChangeRow]:
        if prev_year is None:
            return []
        latest_map = sources.get(latest_year, {})
        prev_map = sources.get(prev_year, {})
        keys = set(latest_map.keys()) | set(prev_map.keys())
        changes: List[SourceChangeRow] = []
        for key in keys:
            latest_total = latest_map.get(key, {"total": Decimal("0")})["total"]
            prev_total = prev_map.get(key, {"total": Decimal("0")})["total"]
            delta = latest_total - prev_total
            delta_pct = (delta / prev_total * Decimal("100")) if prev_total > 0 else None
            changes.append(
                {
                    "source": key,
                    "amount": latest_total,
                    "prev_amount": prev_total,
                    "delta": delta,
                    "delta_pct": delta_pct,
                }
            )
        changes.sort(key=lambda item: abs(item["delta"]), reverse=True)
        return changes[:20]

    income_source_changes = yoy_source_changes(
        latest_year=yoy_year, prev_year=yoy_prev_year, sources=income_sources_by_year
    )
    expense_source_changes = yoy_source_changes(
        latest_year=yoy_year, prev_year=yoy_prev_year, sources=expense_sources_by_year
    )

    accounts_rows: List[AccountOverviewRow] = []
    for acc in accounts:
        current_balance = repository.current_balance_total(account_ids=[acc.id])
        acc_rows = repository.fetch_transaction_amounts(
            start=datetime(1900, 1, 1, tzinfo=timezone.utc),
            end=end,
            account_ids=[acc.id],
        )
        operating_income = Decimal("0")
        operating_expense = Decimal("0")
        transfers_in = Decimal("0")
        transfers_out = Decimal("0")
        first_tx: Optional[date] = acc_rows[0].occurred_at.date() if acc_rows else None
        for row in acc_rows:
            if row.transaction_type == TransactionType.TRANSFER:
                amount = coerce_decimal(row.amount)
                if amount >= 0:
                    transfers_in += amount
                else:
                    transfers_out += -amount
                continue
            inc, exp = classify_income_expense(row)
            operating_income += inc
            operating_expense += exp
        net_operating = operating_income - operating_expense
        net_transfers = transfers_in - transfers_out
        accounts_rows.append(
            {
                "account_id": str(acc.id),
                "name": acc.name,
                "account_type": acc.account_type,
                "current_balance": current_balance,
                "operating_income": operating_income,
                "operating_expense": operating_expense,
                "net_operating": net_operating,
                "transfers_in": transfers_in,
                "transfers_out": transfers_out,
                "net_transfers": net_transfers,
                "first_transaction_date": first_tx.isoformat() if first_tx else None,
            }
        )
    accounts_rows.sort(key=lambda item: abs(item["current_balance"]), reverse=True)

    investments_payload = None
    investments_value = None
    if account_id_list is None:
        snap_rows = repository.list_investment_snapshots_until(end=as_of)
        investment_series: List[InvestmentSeriesPoint] = [
            {"date": day.isoformat(), "value": value} for day, value in snap_rows
        ]

        investment_accounts = list(
            session.exec(
                select(Account)
                .where(Account.user_id == user_id)
                .where(Account.account_type == AccountType.INVESTMENT)
            ).all()
        )
        investment_names = {acc.name for acc in investment_accounts}

        latest_snapshot = session.exec(
            select(InvestmentSnapshot)
            .where(InvestmentSnapshot.user_id == user_id)
            .where(cast(Any, InvestmentSnapshot.snapshot_date) <= as_of)
            .order_by(cast(Any, InvestmentSnapshot.snapshot_date).desc())
            .limit(1)
        ).first()
        accounts_latest: List[InvestmentAccountValue] = []
        if latest_snapshot:
            accounts_raw = cast(dict[str, object], latest_snapshot.parsed_payload or {}).get(
                "accounts"
            )
            if isinstance(accounts_raw, dict):
                for key, value in accounts_raw.items():
                    if isinstance(key, str) and key in investment_names:
                        accounts_latest.append(
                            {"account_name": key, "value": coerce_decimal(value)}
                        )
        accounts_latest.sort(key=lambda item: item["value"], reverse=True)

        year_set = {day.year for day, _value in snap_rows}
        year_set |= set(years_sorted)
        investment_years = sorted(year_set)

        yearly_investments: List[InvestmentYearRow] = []
        snap_idx = 0
        latest_value = Decimal("0")
        prev_end = None
        for year in investment_years:
            if year > as_of.year:
                continue
            end_day = as_of if year == as_of.year else date(year, 12, 31)
            while snap_idx < len(snap_rows) and snap_rows[snap_idx][0] <= end_day:
                latest_value = snap_rows[snap_idx][1]
                snap_idx += 1
            contrib = contributions_by_year.get(year, Decimal("0"))
            withdr = withdrawals_by_year.get(year, Decimal("0"))
            net_contrib = contrib - withdr
            implied = None
            if prev_end is not None:
                implied = (latest_value - prev_end) - net_contrib
            yearly_investments.append(
                {
                    "year": year,
                    "end_value": latest_value,
                    "contributions": contrib,
                    "withdrawals": withdr,
                    "net_contributions": net_contrib,
                    "implied_return": implied,
                }
            )
            prev_end = latest_value
        investments_value = (
            yearly_investments[-1]["end_value"] if yearly_investments else Decimal("0")
        )
        investments_payload = {
            "series": investment_series,
            "yearly": yearly_investments,
            "contributions_lifetime": contributions_lifetime,
            "withdrawals_lifetime": withdrawals_lifetime,
            "net_contributions_lifetime": contributions_lifetime - withdrawals_lifetime,
            "accounts_latest": accounts_latest,
        }

    insights: List[str] = []
    if best_year is not None:
        insights.append(f"Best year: {best_year}")
    if worst_year is not None and worst_year != best_year:
        insights.append(f"Worst year: {worst_year}")
    if expense_lifetime_sorted:
        insights.append(f"Top expense category (lifetime): {expense_lifetime_sorted[0]['name']}")
    if income_lifetime_sorted:
        insights.append(f"Top income category (lifetime): {income_lifetime_sorted[0]['name']}")

    return {
        "as_of": as_of.isoformat(),
        "kpis": {
            "net_worth": net_worth_now,
            "cash_balance": cash_balance,
            "debt_total": debt_now,
            "investments_value": investments_value,
            "lifetime_income": lifetime_income,
            "lifetime_expense": lifetime_expense,
            "lifetime_saved": lifetime_saved,
            "lifetime_savings_rate_pct": lifetime_rate,
        },
        "net_worth_series": net_worth_series,
        "monthly_income_expense": monthly_income_expense,
        "yearly": yearly_rows,
        "best_year": best_year,
        "worst_year": worst_year,
        "expense_categories_lifetime": expense_lifetime_sorted[:12],
        "income_categories_lifetime": income_lifetime_sorted[:12],
        "expense_category_mix_by_year": expense_mix_by_year,
        "income_category_mix_by_year": income_mix_by_year,
        "expense_category_heatmap_by_year": build_category_heatmap(
            categories=expense_lifetime_sorted,
            categories_by_year=expense_categories_by_year,
            years=years_sorted,
        ),
        "income_category_heatmap_by_year": build_category_heatmap(
            categories=income_lifetime_sorted,
            categories_by_year=income_categories_by_year,
            years=years_sorted,
        ),
        "expense_category_changes_yoy": expense_changes,
        "income_category_changes_yoy": income_changes,
        "income_sources_lifetime": income_sources_rows,
        "expense_sources_lifetime": expense_sources_rows,
        "income_source_changes_yoy": income_source_changes,
        "expense_source_changes_yoy": expense_source_changes,
        "accounts": accounts_rows,
        "investments": investments_payload,
        "debt": {
            "total_current": debt_now,
            "total_prev_year_end": debt_prev_year_end,
            "change_since_prev_year_end": debt_change,
            "debt_to_income_latest_year": debt_to_income_latest,
            "series": debt_series,
            "accounts": debt_accounts_rows,
        },
        "insights": insights,
    }
