"""Service layer for category operations."""

from __future__ import annotations

from typing import Any, List, cast
from uuid import UUID

from sqlalchemy import update
from sqlmodel import Session, select

from ..models import Budget, Category, Transaction
from ..repositories.category import CategoryRepository


class CategoryService:
    """Coordinates business logic around categories."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = CategoryRepository(session)

    def list_categories(self, include_archived: bool = False) -> List[Category]:
        return self.repository.list(include_archived=include_archived)

    def get_category(self, category_id: UUID) -> Category:
        category = self.repository.get(category_id)
        if category is None:
            raise LookupError("Category not found")
        return category

    def create_category(self, category: Category) -> Category:
        return self.repository.create(category)

    def update_category(self, category_id: UUID, **updates) -> Category:
        category = self.get_category(category_id)
        return self.repository.update(category, **updates)

    def archive_category(self, category_id: UUID) -> Category:
        category = self.get_category(category_id)
        return self.repository.archive(category)

    def merge_categories(
        self,
        source_category_id: UUID,
        target_category_id: UUID,
        *,
        rename_target_to: str | None = None,
    ) -> Category:
        source = self.get_category(source_category_id)
        target = self.get_category(target_category_id)

        if rename_target_to and rename_target_to != target.name:
            if self.repository.find_by_name(rename_target_to):
                raise ValueError("Category with this name already exists")
            target.name = rename_target_to

        # Re-point transactions
        self.session.exec(
            update(Transaction)
            .where(cast(Any, Transaction.category_id == source_category_id))
            .values(category_id=target_category_id)
        )

        # Merge budgets for the same period
        source_budgets = list(
            self.session.exec(select(Budget).where(Budget.category_id == source_category_id)).all()
        )
        for budget in source_budgets:
            existing = self.session.exec(
                select(Budget).where(
                    Budget.category_id == target_category_id,
                    Budget.period == budget.period,
                )
            ).one_or_none()
            if existing:
                existing.amount += budget.amount
                self.session.delete(budget)
                self.session.add(existing)
            else:
                budget.category_id = target_category_id
                self.session.add(budget)

        # Archive the source category
        source.is_archived = True
        self.session.add(source)
        self.session.add(target)
        self.session.commit()
        self.session.refresh(target)
        return target


__all__ = ["CategoryService"]
