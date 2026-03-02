"""Helpers for the total overview report payload."""

from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, cast
from uuid import UUID

from sqlalchemy import case, extract, func
from sqlalchemy import select as sa_select
from sqlmodel import Session, select

from ..models import Account, Transaction, TransactionLeg
from ..models.investment_snapshot import InvestmentSnapshot
from ..repositories.reporting import ReportingRepository
from ..shared import AccountType, TransactionType, coerce_decimal
from .reporting_total_helpers import (
    build_category_heatmap,
    compress_points_monthly,
    ensure_category,
    ensure_source,
    sources_to_rows,
    top_category_keys,
    year_mix,
    yoy_category_changes,
    yoy_source_changes,
)
from .reporting_total_types import (
    AccountOverviewRow,
    CategoryAgg,
    DebtAccountRow,
    IncomeExpenseClassifier,
    InvestmentAccountValue,
    InvestmentSeriesPoint,
    InvestmentYearRow,
    MerchantKeyFn,
    MonthTotals,
    SourceAgg,
    YearTotals,
)


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
            bucket = ensure_category(expense_categories_by_year[year], row=row)
            bucket["total"] += exp
            bucket["transaction_count"] += 1
            life_bucket = ensure_category(expense_categories_lifetime, row=row)
            life_bucket["total"] += exp
            life_bucket["transaction_count"] += 1

            source_key = merchant_key(row.description)
            src = ensure_source(expense_sources_by_year[year], source_key)
            src["total"] += exp
            src["transaction_count"] += 1
            life_src = ensure_source(expense_sources_lifetime, source_key)
            life_src["total"] += exp
            life_src["transaction_count"] += 1

        if inc > 0:
            bucket = ensure_category(income_categories_by_year[year], row=row)
            bucket["total"] += inc
            bucket["transaction_count"] += 1
            life_bucket = ensure_category(income_categories_lifetime, row=row)
            life_bucket["total"] += inc
            life_bucket["transaction_count"] += 1

            source_key = merchant_key(row.description)
            src = ensure_source(income_sources_by_year[year], source_key)
            src["total"] += inc
            src["transaction_count"] += 1
            life_src = ensure_source(income_sources_lifetime, source_key)
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
                    cast(Any, Transaction.transaction_type).notin_(
                        [TransactionType.ADJUSTMENT, TransactionType.INVESTMENT_EVENT]
                    ),
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
    net_worth_monthly = compress_points_monthly(points=net_worth_points, as_of=as_of)
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
    debt_monthly = compress_points_monthly(points=debt_points, as_of=as_of) if debt_points else []
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

    expense_mix_keys = top_category_keys(expense_categories_lifetime, 8)
    income_mix_keys = top_category_keys(income_categories_lifetime, 8)

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

    expense_changes = yoy_category_changes(
        latest_year=yoy_year, prev_year=yoy_prev_year, categories=expense_categories_by_year
    )
    income_changes = yoy_category_changes(
        latest_year=yoy_year, prev_year=yoy_prev_year, categories=income_categories_by_year
    )

    income_sources_rows = sources_to_rows(income_sources_lifetime)
    expense_sources_rows = sources_to_rows(expense_sources_lifetime)

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

        accounts_latest: List[InvestmentAccountValue] = []
        investment_name_map = {name.strip().lower(): name for name in investment_names}
        snapshot_statement: Any = sa_select(
            cast(Any, InvestmentSnapshot.snapshot_date),
            cast(Any, InvestmentSnapshot.account_name),
            cast(Any, InvestmentSnapshot.portfolio_value),
            cast(Any, InvestmentSnapshot.parsed_payload),
            cast(Any, InvestmentSnapshot.cleaned_payload),
            cast(Any, InvestmentSnapshot.created_at),
            cast(Any, InvestmentSnapshot.updated_at),
        )
        snapshot_statement = (
            snapshot_statement.where(InvestmentSnapshot.user_id == user_id)
            .where(cast(Any, InvestmentSnapshot.snapshot_date) <= as_of)
            .order_by(
                cast(Any, InvestmentSnapshot.snapshot_date).asc(),
                cast(Any, InvestmentSnapshot.created_at).asc(),
            )
        )
        snapshot_rows = session.exec(snapshot_statement).all()

        latest_by_name: Dict[str, Decimal] = {}
        for (
            _snapshot_date,
            account_name,
            portfolio_value,
            parsed_payload,
            cleaned_payload,
            _created_at,
            _updated_at,
        ) in snapshot_rows:
            payload: dict[str, Any] = {}
            if isinstance(cleaned_payload, dict):
                payload = cleaned_payload
            elif isinstance(parsed_payload, dict):
                payload = parsed_payload

            accounts_payload = payload.get("accounts") if isinstance(payload, dict) else None
            if isinstance(accounts_payload, dict):
                for key, value in accounts_payload.items():
                    normalized = str(key).strip().lower()
                    if normalized not in investment_name_map:
                        continue
                    latest_by_name[normalized] = coerce_decimal(value)
                continue

            if account_name and portfolio_value is not None:
                normalized = str(account_name).strip().lower()
                if normalized in investment_name_map:
                    latest_by_name[normalized] = coerce_decimal(portfolio_value)

        for normalized, display_name in investment_name_map.items():
            accounts_latest.append(
                {
                    "account_name": display_name,
                    "value": latest_by_name.get(normalized, Decimal("0")),
                }
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
