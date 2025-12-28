"""Service layer for goals."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, List, Optional, cast
from uuid import UUID

from sqlalchemy import func
from sqlmodel import Session, select

from ..models import Goal, Transaction, TransactionLeg
from ..repositories.account import AccountRepository
from ..repositories.reporting import NetWorthPoint, ReportingRepository
from ..shared import coerce_decimal


class GoalService:
    """CRUD and progress calculation for goals."""

    def __init__(self, session: Session):
        self.session = session
        self.account_repository = AccountRepository(session)
        self.reporting_repository = ReportingRepository(session)
        self._net_worth_history: Optional[List[NetWorthPoint]] = None

    def list(self) -> List[Goal]:
        statement = select(Goal).order_by(cast(Any, Goal.created_at).desc())
        return list(self.session.exec(statement).all())

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

    def progress(self, goal: Goal) -> tuple[Decimal, float, Optional[date], Optional[int]]:
        """Return (current_amount, pct, achieved_at, achieved_delta_days)."""
        current = Decimal("0")
        achieved_at = None
        achieved_delta_days = None
        if goal.account_id:
            current = self.account_repository.calculate_balance(goal.account_id)
        elif goal.category_id:
            current = self._sum_for_category(goal.category_id)
        elif goal.subscription_id:
            current = self._sum_for_subscription(goal.subscription_id)
        else:
            history = self._get_net_worth_history()
            if history:
                current = history[-1].net_worth
                achieved_at = self._find_achieved_at(history, goal.target_amount)

        pct = float(0)
        if goal.target_amount and goal.target_amount != 0:
            pct = float((current / goal.target_amount) * 100)

        if achieved_at and goal.target_date:
            achieved_delta_days = (achieved_at - goal.target_date).days

        return current, pct, achieved_at, achieved_delta_days

    def _sum_for_category(self, category_id: UUID) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(TransactionLeg.amount), 0))
            .join(Transaction, cast(Any, Transaction.id == TransactionLeg.transaction_id))
            .where(Transaction.category_id == category_id)
        )
        result = cast(Any, self.session.exec(statement)).scalar_one()
        return coerce_decimal(result)

    def _sum_for_subscription(self, subscription_id: UUID) -> Decimal:
        statement = (
            select(func.coalesce(func.sum(TransactionLeg.amount), 0))
            .join(Transaction, cast(Any, Transaction.id == TransactionLeg.transaction_id))
            .where(Transaction.subscription_id == subscription_id)
        )
        result = cast(Any, self.session.exec(statement)).scalar_one()
        return coerce_decimal(result)

    def _get_net_worth_history(self) -> List[NetWorthPoint]:
        if self._net_worth_history is None:
            self._net_worth_history = self.reporting_repository.get_net_worth_history()
        return self._net_worth_history

    @staticmethod
    def _find_achieved_at(history: List[NetWorthPoint], target_amount: Decimal) -> Optional[date]:
        for point in history:
            if point.net_worth >= target_amount:
                return point.period
        return None


__all__ = ["GoalService"]
