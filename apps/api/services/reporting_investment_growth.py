"""Investment market-growth helpers for reporting payloads."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Iterable, List, Tuple, cast
from uuid import UUID

from sqlalchemy import select as sa_select
from sqlmodel import Session, select

from ..models import Account, Transaction, TransactionLeg
from ..shared import AccountType, TransactionType, coerce_decimal


@dataclass(frozen=True)
class PortfolioValueEvent:
    """Observed portfolio value on a snapshot date."""

    observed_at: date
    value: Decimal


def month_start(value: date) -> date:
    return date(value.year, value.month, 1)


def month_end(value: date) -> date:
    if value.month == 12:
        return date(value.year, 12, 31)
    return date(value.year, value.month + 1, 1) - timedelta(days=1)


def month_starts_for_year(year: int) -> List[date]:
    return [date(year, month, 1) for month in range(1, 13)]


def investment_account_ids_for_user(session: Session, user_id: str) -> List[UUID]:
    rows = session.exec(
        select(Account.id)
        .where(Account.user_id == user_id)
        .where(Account.account_type == AccountType.INVESTMENT)
    ).all()
    return [account_id for account_id in rows if account_id is not None]


def portfolio_events_from_snapshots(
    snapshots: Iterable[Tuple[date, Decimal]],
) -> List[PortfolioValueEvent]:
    return [
        PortfolioValueEvent(observed_at=observed_at, value=coerce_decimal(value))
        for observed_at, value in sorted(snapshots, key=lambda item: item[0])
    ]


def portfolio_events_from_account_snapshots(
    snapshots: Iterable[Tuple[date, dict[str, Decimal]]],
) -> List[PortfolioValueEvent]:
    latest_by_account: dict[str, Decimal] = {}
    events: List[PortfolioValueEvent] = []
    for observed_at, values in sorted(snapshots, key=lambda item: item[0]):
        latest_by_account.update(values)
        events.append(
            PortfolioValueEvent(
                observed_at=observed_at,
                value=sum(latest_by_account.values(), Decimal("0")),
            )
        )
    return events


def _external_investment_cashflows(
    *,
    session: Session,
    investment_account_ids: List[UUID],
    end: date,
) -> List[Tuple[date, Decimal]]:
    if not investment_account_ids:
        return []

    noninvestment_transaction_ids = (
        select(cast(Any, TransactionLeg.transaction_id))
        .join(Account, cast(Any, TransactionLeg.account_id) == cast(Any, Account.id))
        .where(Account.account_type != AccountType.INVESTMENT)
        .distinct()
    ).subquery()

    statement: Any = (
        sa_select(
            cast(Any, Transaction.occurred_at),
            cast(Any, TransactionLeg.amount),
        )
        .join(Transaction, cast(Any, TransactionLeg.transaction_id) == cast(Any, Transaction.id))
        .where(
            cast(Any, TransactionLeg.account_id).in_(investment_account_ids),
            cast(Any, Transaction.occurred_at)
            < datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc),
            cast(Any, Transaction.transaction_type).notin_(
                [TransactionType.ADJUSTMENT, TransactionType.INVESTMENT_EVENT]
            ),
            cast(Any, TransactionLeg.transaction_id).in_(
                select(cast(Any, noninvestment_transaction_ids.c.transaction_id))
            ),
        )
    )

    cashflows: List[Tuple[date, Decimal]] = []
    for occurred_at, amount in session.exec(statement).all():
        if occurred_at is None:
            continue
        cashflows.append((cast(datetime, occurred_at).date(), coerce_decimal(amount)))
    return cashflows


def investment_market_growth_by_month(
    *,
    session: Session,
    investment_account_ids: List[UUID],
    portfolio_events: List[PortfolioValueEvent],
    months: Iterable[date],
    as_of: date,
) -> dict[date, Decimal]:
    month_keys = sorted({month_start(value) for value in months if value <= as_of})
    growth_by_month = {key: Decimal("0") for key in month_keys}
    if not month_keys or not investment_account_ids or not portfolio_events:
        return growth_by_month

    events = list(sorted(portfolio_events, key=lambda item: item.observed_at))
    cashflows = _external_investment_cashflows(
        session=session,
        investment_account_ids=investment_account_ids,
        end=as_of,
    )

    def net_contributions_after_to(start_exclusive: date, end_inclusive: date) -> Decimal:
        return sum(
            (
                amount
                for occurred_at, amount in cashflows
                if start_exclusive < occurred_at <= end_inclusive
            ),
            Decimal("0"),
        )

    event_index = 0
    previous_event: PortfolioValueEvent | None = None
    for month in month_keys:
        current_month_end = min(month_end(month), as_of)
        month_events: List[PortfolioValueEvent] = []
        while event_index < len(events) and events[event_index].observed_at <= current_month_end:
            event = events[event_index]
            if event.observed_at < month:
                previous_event = event
            else:
                month_events.append(event)
            event_index += 1

        if not month_events:
            continue

        current_event = month_events[-1]
        baseline_event = previous_event
        if baseline_event is None and len(month_events) > 1:
            baseline_event = month_events[0]
        if baseline_event is None or baseline_event.observed_at == current_event.observed_at:
            previous_event = current_event
            continue

        net_contributions = net_contributions_after_to(
            baseline_event.observed_at,
            current_event.observed_at,
        )
        growth_by_month[month] = current_event.value - baseline_event.value - net_contributions
        previous_event = current_event

    return growth_by_month


__all__ = [
    "PortfolioValueEvent",
    "investment_account_ids_for_user",
    "investment_market_growth_by_month",
    "month_start",
    "month_starts_for_year",
    "portfolio_events_from_account_snapshots",
    "portfolio_events_from_snapshots",
]
