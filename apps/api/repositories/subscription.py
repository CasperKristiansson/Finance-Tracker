"""Repository helpers for subscriptions."""

from __future__ import annotations

from typing import Any, List, Optional, cast
from uuid import UUID

from sqlmodel import Session, select

from ..models import Subscription

_UNSET = object()


class SubscriptionRepository:
    """Handles persistence for subscriptions."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, subscription_id: UUID) -> Optional[Subscription]:
        return self.session.get(Subscription, subscription_id)

    def list(self, *, include_inactive: bool = False) -> List[Subscription]:
        statement = select(Subscription).order_by(Subscription.name)
        if not include_inactive:
            statement = statement.where(cast(Any, Subscription.is_active).is_(True))
        result = self.session.exec(statement)
        return list(result.all())

    def create(self, subscription: Subscription) -> Subscription:
        self.session.add(subscription)
        self.session.commit()
        self.session.refresh(subscription)
        return subscription

    def update(
        self,
        subscription: Subscription,
        *,
        name: Optional[str] = None,
        matcher_text: Optional[str] = None,
        matcher_amount_tolerance=_UNSET,
        matcher_day_of_month=_UNSET,
        category_id=_UNSET,
        is_active: Optional[bool] = None,
    ) -> Subscription:
        if name is not None:
            subscription.name = name
        if matcher_text is not None:
            subscription.matcher_text = matcher_text
        if matcher_amount_tolerance is not _UNSET:
            subscription.matcher_amount_tolerance = matcher_amount_tolerance
        if matcher_day_of_month is not _UNSET:
            subscription.matcher_day_of_month = matcher_day_of_month
        if category_id is not _UNSET:
            subscription.category_id = category_id
        if is_active is not None:
            subscription.is_active = is_active

        self.session.add(subscription)
        self.session.commit()
        self.session.refresh(subscription)
        return subscription


__all__ = ["SubscriptionRepository"]
