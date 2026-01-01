"""Helpers for the yearly overview report payload.

Split out to keep `reporting.py` below pylint's module length limit.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional, Tuple, TypedDict, cast
from uuid import UUID

from sqlalchemy import case, func
from sqlalchemy import select as sa_select
from sqlmodel import Session, select

from ..models import Account, Transaction, TransactionLeg
from ..models.investment_snapshot import InvestmentSnapshot
from ..repositories.reporting import ReportingRepository, TransactionAmountRow
from ..shared import AccountType, TransactionType, coerce_decimal

IncomeExpenseClassifier = Callable[[TransactionAmountRow], Tuple[Decimal, Decimal]]
MerchantKeyFn = Callable[[Optional[str]], str]
MonthEndSeriesFn = Callable[[int, Optional[List[UUID]]], List[Tuple[date, Decimal]]]
MonthEndDatesFn = Callable[[int], List[date]]


class SourceBucket(TypedDict):
    source: str
    total: Decimal
    monthly: List[Decimal]
    transaction_count: int


def build_yearly_overview_enhancements(
    *,
    session: Session,
    repository: ReportingRepository,
    year: int,
    start: datetime,
    end: datetime,
    as_of_date: date,
    account_id_list: Optional[List[UUID]],
    rows: List[TransactionAmountRow],
    classify_income_expense: IncomeExpenseClassifier,
    merchant_key: MerchantKeyFn,
    month_end_balance_series: MonthEndSeriesFn,
    month_end_dates: MonthEndDatesFn,
) -> Tuple[
    Dict[str, object],
    List[Dict[str, object]],
    List[Dict[str, object]],
    List[Dict[str, object]],
    List[Dict[str, object]],
]:
    """Compute yearly overview add-ons (sources, flows, debt, investments summary)."""

    def _investment_value_at(
        *,
        account_name: str,
        snapshots: List[Tuple[date, Dict[str, Decimal]]],
        target: date,
    ) -> Decimal:
        key = account_name.strip().lower()
        last: Decimal | None = None
        for snapshot_date, values in snapshots:
            if snapshot_date > target:
                break
            value = values.get(key)
            if value is not None:
                last = value
        return last if last is not None else Decimal("0")

    def _portfolio_value_at(
        *,
        snapshots: List[Tuple[date, Dict[str, Decimal]]],
        target: date,
    ) -> Decimal:
        latest: Dict[str, Decimal] = {}
        for snapshot_date, values in snapshots:
            if snapshot_date > target:
                break
            latest.update(values)
        return sum(latest.values(), Decimal("0"))

    income_sources: Dict[str, SourceBucket] = {}
    expense_sources: Dict[str, SourceBucket] = {}
    for row in rows:
        month_idx = row.occurred_at.month - 1
        income, expense = classify_income_expense(row)
        if income > 0:
            key = merchant_key(row.description)
            if key not in income_sources:
                income_sources[key] = {
                    "source": key,
                    "total": Decimal("0"),
                    "monthly": [Decimal("0") for _ in range(12)],
                    "transaction_count": 0,
                }
            bucket = income_sources[key]
            bucket["total"] += income
            bucket["monthly"][month_idx] += income
            bucket["transaction_count"] += 1
        if expense > 0:
            key = merchant_key(row.description)
            if key not in expense_sources:
                expense_sources[key] = {
                    "source": key,
                    "total": Decimal("0"),
                    "monthly": [Decimal("0") for _ in range(12)],
                    "transaction_count": 0,
                }
            bucket = expense_sources[key]
            bucket["total"] += expense
            bucket["monthly"][month_idx] += expense
            bucket["transaction_count"] += 1

    income_sources_rows = sorted(
        income_sources.values(),
        key=lambda item: item["total"],
        reverse=True,
    )
    expense_sources_rows = sorted(
        expense_sources.values(),
        key=lambda item: item["total"],
        reverse=True,
    )

    debt_overview: List[Dict[str, object]] = []
    account_flows: List[Dict[str, object]] = []
    investments_summary: Dict[str, object] = {
        "as_of": as_of_date.isoformat(),
        "start_value": Decimal("0"),
        "end_value": Decimal("0"),
        "change": Decimal("0"),
        "change_pct": None,
        "contributions": Decimal("0"),
        "withdrawals": Decimal("0"),
        "net_contributions": Decimal("0"),
        "monthly_values": [Decimal("0") for _ in range(12)],
        "accounts": [],
    }

    user_id = repository.user_id
    accounts_statement = select(Account).where(Account.user_id == user_id)
    if account_id_list:
        accounts_statement = accounts_statement.where(cast(Any, Account.id).in_(account_id_list))
    else:
        accounts_statement = accounts_statement.where(cast(Any, Account.is_active).is_(True))
    accounts = list(session.exec(accounts_statement).all())
    accounts = [acc for acc in accounts if acc.name not in {"Offset", "Unassigned"}]

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
        .where(cast(Any, InvestmentSnapshot.snapshot_date) <= as_of_date)
        .order_by(
            cast(Any, InvestmentSnapshot.snapshot_date).asc(),
            cast(Any, InvestmentSnapshot.created_at).asc(),
        )
    )
    snapshot_rows = list(session.exec(snapshot_statement).all())
    investment_snapshots: List[Tuple[date, Dict[str, Decimal]]] = []
    for (
        snapshot_date,
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
        values: Dict[str, Decimal] = {}
        if isinstance(accounts_payload, dict):
            for name, value in accounts_payload.items():
                values[str(name).strip().lower()] = coerce_decimal(value)
        elif account_name and portfolio_value is not None:
            values[str(account_name).strip().lower()] = coerce_decimal(portfolio_value)

        if values:
            investment_snapshots.append((cast(date, snapshot_date), values))

    for account in accounts:
        if account.account_type == AccountType.INVESTMENT:
            start_target = start.date() - timedelta(days=1)
            start_value = _investment_value_at(
                account_name=account.name,
                snapshots=investment_snapshots,
                target=start_target,
            )
            end_value = _investment_value_at(
                account_name=account.name,
                snapshots=investment_snapshots,
                target=as_of_date,
            )

            monthly_income_by_acc = [Decimal("0") for _ in range(12)]
            monthly_expense_by_acc = [Decimal("0") for _ in range(12)]
            monthly_transfers_in = [Decimal("0") for _ in range(12)]
            monthly_transfers_out = [Decimal("0") for _ in range(12)]

            month_ends = month_end_dates(year)
            month_end_values: List[Decimal] = []
            for month_end in month_ends:
                target = month_end if month_end <= as_of_date else as_of_date
                month_end_values.append(
                    _investment_value_at(
                        account_name=account.name,
                        snapshots=investment_snapshots,
                        target=target,
                    )
                )

            monthly_change: List[Decimal] = []
            prev_value = start_value
            for value in month_end_values:
                monthly_change.append(value - prev_value)
                prev_value = value

            change = end_value - start_value
            account_flows.append(
                {
                    "account_id": str(account.id),
                    "name": account.name,
                    "account_type": account.account_type,
                    "start_balance": start_value,
                    "end_balance": end_value,
                    "change": change,
                    "income": Decimal("0"),
                    "expense": Decimal("0"),
                    "transfers_in": Decimal("0"),
                    "transfers_out": Decimal("0"),
                    "net_operating": Decimal("0"),
                    "net_transfers": Decimal("0"),
                    "monthly_income": monthly_income_by_acc,
                    "monthly_expense": monthly_expense_by_acc,
                    "monthly_transfers_in": monthly_transfers_in,
                    "monthly_transfers_out": monthly_transfers_out,
                    "monthly_change": monthly_change,
                }
            )
            continue

        start_balance = repository.sum_legs_before(before=start, account_ids=[account.id])
        end_balance = repository.sum_legs_before(before=end, account_ids=[account.id])
        change = end_balance - start_balance

        account_rows = repository.fetch_transaction_amounts(
            start=start, end=end, account_ids=[account.id]
        )

        monthly_income_by_acc = [Decimal("0") for _ in range(12)]
        monthly_expense_by_acc = [Decimal("0") for _ in range(12)]
        monthly_transfers_in = [Decimal("0") for _ in range(12)]
        monthly_transfers_out = [Decimal("0") for _ in range(12)]
        monthly_change = [Decimal("0") for _ in range(12)]

        for row in account_rows:
            month_idx = row.occurred_at.month - 1
            amount = coerce_decimal(row.amount)
            monthly_change[month_idx] += amount
            if row.transaction_type == TransactionType.TRANSFER:
                if amount >= 0:
                    monthly_transfers_in[month_idx] += amount
                else:
                    monthly_transfers_out[month_idx] += -amount
                continue

            income, expense = classify_income_expense(row)
            monthly_income_by_acc[month_idx] += income
            monthly_expense_by_acc[month_idx] += expense

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
            debt_series_acc = month_end_balance_series(year, [account.id])
            monthly_debt = [(-bal if bal < 0 else bal) for _d, bal in debt_series_acc]
            start_debt = -start_balance if start_balance < 0 else start_balance
            end_debt = -end_balance if end_balance < 0 else end_balance
            debt_overview.append(
                {
                    "account_id": str(account.id),
                    "name": account.name,
                    "start_debt": start_debt,
                    "end_debt": end_debt,
                    "delta": end_debt - start_debt,
                    "monthly_debt": monthly_debt,
                }
            )

    if account_id_list is None:
        investment_accounts = list(
            session.exec(
                select(Account)
                .where(Account.user_id == user_id)
                .where(Account.account_type == AccountType.INVESTMENT)
            ).all()
        )

        start_target = date(year, 1, 1) - timedelta(days=1)
        start_value = _portfolio_value_at(
            snapshots=investment_snapshots,
            target=start_target,
        )
        end_value = _portfolio_value_at(
            snapshots=investment_snapshots,
            target=as_of_date,
        )
        change_value = end_value - start_value
        change_pct = (change_value / start_value * Decimal("100")) if start_value > 0 else None

        contributions = Decimal("0")
        withdrawals = Decimal("0")
        investment_account_ids = [acc.id for acc in investment_accounts if acc.id]
        if investment_account_ids:
            noninv_tx_ids = (
                select(cast(Any, TransactionLeg.transaction_id))
                .join(Account, cast(Any, TransactionLeg.account_id) == cast(Any, Account.id))
                .where(Account.account_type != AccountType.INVESTMENT)
                .distinct()
            ).subquery()

            stmt = (
                select(
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
                    cast(Any, Transaction.occurred_at) >= start,
                    cast(Any, Transaction.occurred_at) < end,
                    cast(Any, Transaction.transaction_type).notin_(
                        [TransactionType.ADJUSTMENT, TransactionType.INVESTMENT_EVENT]
                    ),
                    cast(Any, TransactionLeg.transaction_id).in_(
                        select(cast(Any, noninv_tx_ids.c.transaction_id))
                    ),
                )
            )
            deposits, withdrawals_sum = session.exec(stmt).one()
            contributions = coerce_decimal(deposits or 0)
            withdrawals = coerce_decimal(withdrawals_sum or 0)

        account_rows_summary = []
        for account in investment_accounts:
            name = account.name
            acc_start = _investment_value_at(
                account_name=name,
                snapshots=investment_snapshots,
                target=start_target,
            )
            acc_end = _investment_value_at(
                account_name=name,
                snapshots=investment_snapshots,
                target=as_of_date,
            )
            account_rows_summary.append(
                {
                    "account_name": name,
                    "start_value": acc_start,
                    "end_value": acc_end,
                    "change": acc_end - acc_start,
                }
            )
        account_rows_summary.sort(key=lambda item: cast(Decimal, item["end_value"]), reverse=True)

        monthly_values = []
        for month_end in month_end_dates(year):
            target = min(month_end, as_of_date)
            monthly_values.append(
                _portfolio_value_at(snapshots=investment_snapshots, target=target)
            )

        investments_summary = {
            "as_of": as_of_date.isoformat(),
            "start_value": start_value,
            "end_value": end_value,
            "change": change_value,
            "change_pct": change_pct,
            "contributions": contributions,
            "withdrawals": withdrawals,
            "net_contributions": contributions - withdrawals,
            "monthly_values": monthly_values,
            "accounts": account_rows_summary,
        }

    return (
        investments_summary,
        debt_overview,
        account_flows,
        [dict(item) for item in income_sources_rows],
        [dict(item) for item in expense_sources_rows],
    )
