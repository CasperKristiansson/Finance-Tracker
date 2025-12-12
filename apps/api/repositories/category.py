# pyright: reportGeneralTypeIssues=false
"""Persistence helpers for category entities."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from sqlmodel import Session, select

from ..models import Category
from ..shared import CategoryType


class CategoryRepository:
    """Encapsulates CRUD operations for categories."""

    def __init__(self, session: Session):
        self.session = session

    def get(self, category_id: UUID) -> Optional[Category]:
        return self.session.get(Category, category_id)

    def list(
        self,
        include_archived: bool = False,
        include_special: bool = False,
    ) -> List[Category]:
        statement = select(Category)
        if not include_special:
            statement = statement.where(
                Category.category_type.in_([CategoryType.INCOME, CategoryType.EXPENSE])
            )
        if not include_archived:
            statement = statement.where(Category.is_archived.is_(False))
        statement = statement.order_by(Category.name)
        return list(self.session.exec(statement))

    def find_by_name(self, name: str) -> Optional[Category]:
        statement = select(Category).where(Category.name == name)
        return self.session.exec(statement).one_or_none()

    def create(self, category: Category) -> Category:
        if self.find_by_name(category.name):
            raise ValueError("Category with this name already exists")

        self.session.add(category)
        self.session.commit()
        self.session.refresh(category)
        return category

    def update(self, category: Category, **updates) -> Category:
        new_name = updates.get("name")
        if new_name and new_name != category.name and self.find_by_name(new_name):
            raise ValueError("Category with this name already exists")

        for field, value in updates.items():
            setattr(category, field, value)

        self.session.add(category)
        self.session.commit()
        self.session.refresh(category)
        return category

    def archive(self, category: Category) -> Category:
        category.is_archived = True
        return self.update(category)


__all__ = ["CategoryRepository"]
