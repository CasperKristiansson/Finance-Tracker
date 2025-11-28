"""Service layer for goals."""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlmodel import Session, select

from ..models import Goal, Transaction, TransactionLeg
from ..repositories.account import AccountRepository
from ..shared import coerce_decimal


class GoalService:
    """CRUD and progress calculation for goals."""

    def __init__(self, session: Session):
        self.session = session
        self.account_repository = AccountRepository(session)

    def list(self) -> List[Goal]:
        statement = select(Goal).order_by(Goal.created_at.desc())  # type: ignore[arg-type]
        return list(self.session.exec(statement).scalars())

    def create(self, payload: dict[str, object]) -> Goal:
        goal = Goal(**payload)
        self.session.add(goal)
        self.session.commit()
        self.session.refresh(goal)
        return goal

    def update(self, goal_id: UUID, fields: dict[str, object]) -> Goal:
        goal = self.session.get(Goal, goal_id)
        if goal is None:
            raise LookupError("Goal not found")
        for key, value in fields.items():
            if value is not None:
                setattr(goal, key, value)
        self.session.add(goal)
        self.session.commit()
        self.session.refresh(goal)
        return goal

    def delete(self, goal_id: UUID) -> None:
        goal = self.session.get(Goal, goal_id)
        if goal is None:
            raise LookupError("Goal not found")
        self.session.delete(goal)
        self.session.commit()

    def progress(self, goal: Goal) -> tuple[Decimal, float]:
        """Return (current_amount, pct)."""
        current = Decimal("0")
        if goal.account_id:
            current = self.account_repository.calculate_balance(goal.account_id)
        elif goal.category_id:
            current = self._sum_for_category(goal.category_id)
        elif goal.subscription_id:
            current = self._sum_for_subscription(goal.subscription_id)

        pct = float(0)
        if goal.target_amount and goal.target_amount != 0:
            pct = float((current / goal.target_amount) * 100)
        return current, pct

    def _sum_for_category(self, category_id: UUID) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(TransactionLeg.amount), 0))
            .join(Transaction, Transaction.id == TransactionLeg.transaction_id)
            .where(Transaction.category_id == category_id)
        )
        result = self.session.exec(statement).scalar_one()
        return coerce_decimal(result)

    def _sum_for_subscription(self, subscription_id: UUID) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(TransactionLeg.amount), 0))
            .join(Transaction, Transaction.id == TransactionLeg.transaction_id)
            .where(Transaction.subscription_id == subscription_id)
        )
        result = self.session.exec(statement).scalar_one()
        return coerce_decimal(result)


__all__ = ["GoalService"]
