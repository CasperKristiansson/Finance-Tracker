"""Repository for budgets."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlmodel import Session, select

from ..models import Budget


class BudgetRepository:
    """Persistence helpers for budgets."""

    def __init__(self, session: Session):
        self.session = session

    def list(self) -> List[Budget]:
        statement = select(Budget)
        return list(self.session.exec(statement).all())

    def get(self, budget_id: UUID) -> Optional[Budget]:
        return self.session.get(Budget, budget_id)

    def create(self, budget: Budget) -> Budget:
        self.session.add(budget)
        self.session.commit()
        self.session.refresh(budget)
        return budget

    def update(
        self,
        budget: Budget,
        *,
        period=None,
        amount=None,
        note=None,
    ) -> Budget:
        if period is not None:
            budget.period = period
        if amount is not None:
            budget.amount = amount
        if note is not None:
            budget.note = note
        self.session.add(budget)
        self.session.commit()
        self.session.refresh(budget)
        return budget

    def delete(self, budget: Budget) -> None:
        self.session.delete(budget)
        self.session.commit()


__all__ = ["BudgetRepository"]
