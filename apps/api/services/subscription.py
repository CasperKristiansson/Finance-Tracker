"""Service layer for subscription operations."""

from __future__ import annotations

from typing import List
from uuid import UUID

from datetime import datetime, timezone
from decimal import Decimal
from collections import defaultdict
from sqlalchemy import func
from sqlmodel import Session, select

from ..models import Subscription, Transaction, TransactionLeg
from ..repositories.subscription import SubscriptionRepository
from ..repositories.transaction import TransactionRepository
from ..shared import coerce_decimal


class SubscriptionService:
    """Coordinates business logic for subscriptions."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = SubscriptionRepository(session)
        self.transaction_repository = TransactionRepository(session)

    def list_subscriptions(self, include_inactive: bool = False) -> List[Subscription]:
        return self.repository.list(include_inactive=include_inactive)

    def list_subscription_summaries(
        self, include_inactive: bool = False, *, now: datetime | None = None
    ) -> List[dict]:
        subscriptions = self.list_subscriptions(include_inactive=include_inactive)
        if not subscriptions:
            return []

        horizon_now = now or datetime.now(timezone.utc)
        base_now = horizon_now.replace(tzinfo=None)
        start_month = base_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        def month_start(base: datetime, offset: int) -> datetime:
            year = base.year
            month = base.month - offset
            while month <= 0:
                month += 12
                year -= 1
            return base.replace(year=year, month=month, day=1)

        month_starts: list[datetime] = [month_start(start_month, offset) for offset in range(11, -1, -1)]
        oldest_start = month_starts[0]

        sub_ids = [sub.id for sub in subscriptions]
        if not sub_ids:
            return []

        max_leg = (
            select(
                TransactionLeg.transaction_id,
                func.max(func.abs(TransactionLeg.amount)).label("amount"),
            )
            .group_by(TransactionLeg.transaction_id)
            .subquery()
        )

        statement = (
            select(
                Transaction.subscription_id,
                Transaction.occurred_at,
                max_leg.c.amount,
            )
            .join(max_leg, Transaction.id == max_leg.c.transaction_id)
            .where(Transaction.subscription_id.in_(sub_ids))
            .where(Transaction.occurred_at >= oldest_start)
        )

        grouped: dict[UUID, list[tuple[datetime, Decimal]]] = defaultdict(list)
        for sub_id, occurred_at, amount in self.session.exec(statement).all():
            if sub_id is None or occurred_at is None or amount is None:
                continue
            grouped[sub_id].append((occurred_at.replace(tzinfo=None), coerce_decimal(amount)))

        summaries: List[dict] = []
        for sub in subscriptions:
            monthly = [Decimal("0") for _ in range(12)]
            last_charge: datetime | None = None
            for occurred_at, amount in grouped.get(sub.id, []):
                month_index = (occurred_at.year - month_starts[0].year) * 12 + (
                    occurred_at.month - month_starts[0].month
                )
                if 0 <= month_index < 12:
                    monthly[month_index] += amount.copy_abs()
                if last_charge is None or occurred_at > last_charge:
                    last_charge = occurred_at

            current_month_spend = monthly[-1]
            trailing_three = sum(monthly[-3:])
            trailing_twelve = sum(monthly)

            summaries.append(
                {
                    "subscription": sub,
                    "current_month_spend": coerce_decimal(current_month_spend),
                    "trailing_three_month_spend": coerce_decimal(trailing_three),
                    "trailing_twelve_month_spend": coerce_decimal(trailing_twelve),
                    "trend": [coerce_decimal(val) for val in monthly],
                    "last_charge_at": last_charge,
                    "category_name": getattr(sub.category, "name", None)
                    if hasattr(sub, "category")
                    else None,
                }
            )

        return summaries

    def get_subscription(self, subscription_id: UUID) -> Subscription:
        subscription = self.repository.get(subscription_id)
        if subscription is None:
            raise LookupError("Subscription not found")
        return subscription

    def create_subscription(self, subscription: Subscription) -> Subscription:
        return self.repository.create(subscription)

    def update_subscription(self, subscription_id: UUID, **updates) -> Subscription:
        subscription = self.get_subscription(subscription_id)
        return self.repository.update(subscription, **updates)

    def attach_transaction(self, transaction_id: UUID, subscription_id: UUID) -> Transaction:
        subscription = self.get_subscription(subscription_id)
        transaction = self.transaction_repository.get(transaction_id)
        if transaction is None:
            raise LookupError("Transaction not found")
        return self.transaction_repository.set_subscription(transaction, subscription.id)

    def detach_transaction(self, transaction_id: UUID) -> Transaction:
        transaction = self.transaction_repository.get(transaction_id)
        if transaction is None:
            raise LookupError("Transaction not found")
        return self.transaction_repository.set_subscription(transaction, None)


__all__ = ["SubscriptionService"]
