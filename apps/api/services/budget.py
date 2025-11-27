"""Service layer for budgets."""

from __future__ import annotations

from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from sqlmodel import Session

from ..models import Budget, Category
from ..repositories.budget import BudgetRepository
from ..shared import BudgetPeriod


class BudgetService:
    """Coordinates budget operations."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = BudgetRepository(session)

    def list_budgets(self) -> List[Budget]:
        return self.repository.list()

    def create_budget(
        self,
        *,
        category_id: UUID,
        period: BudgetPeriod,
        amount: Decimal,
        note: Optional[str] = None,
    ) -> Budget:
        self._ensure_category_exists(category_id)
        budget = Budget(category_id=category_id, period=period, amount=amount, note=note)
        return self.repository.create(budget)

    def update_budget(
        self,
        budget_id: UUID,
        *,
        period: Optional[BudgetPeriod] = None,
        amount: Optional[Decimal] = None,
        note: Optional[str] = None,
    ) -> Budget:
        budget = self.repository.get(budget_id)
        if budget is None:
            raise LookupError("Budget not found")
        return self.repository.update(budget, period=period, amount=amount, note=note)

    def delete_budget(self, budget_id: UUID) -> None:
        budget = self.repository.get(budget_id)
        if budget is None:
            raise LookupError("Budget not found")
        self.repository.delete(budget)

    def _ensure_category_exists(self, category_id: UUID) -> None:
        category = self.session.get(Category, category_id)
        if category is None:
            raise LookupError("Category not found")


__all__ = ["BudgetService"]
