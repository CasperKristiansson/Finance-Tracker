"""Service layer for category operations."""

from __future__ import annotations

from typing import List
from uuid import UUID

from sqlmodel import Session

from ..models import Category
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


__all__ = ["CategoryService"]
