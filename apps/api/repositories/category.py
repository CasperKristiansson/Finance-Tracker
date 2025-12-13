# pyright: reportGeneralTypeIssues=false
"""Persistence helpers for category entities."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, cast
from uuid import UUID

from sqlalchemy import Table, case, func
from sqlmodel import Session, select

from ..models import Account, Category, Transaction, TransactionLeg
from ..shared import CategoryType, coerce_decimal


@dataclass(frozen=True)
class CategoryUsage:
    """Aggregated transaction usage for a category."""

    transaction_count: int
    last_used_at: datetime | None
    income_total: Decimal
    expense_total: Decimal


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

    def usage_by_category_ids(self, category_ids: List[UUID]) -> Dict[UUID, CategoryUsage]:
        if not category_ids:
            return {}

        transaction_table = cast(Table, getattr(Transaction, "__table__"))
        leg_table = cast(Table, getattr(TransactionLeg, "__table__"))

        excluded_ids = list(
            self.session.exec(
                select(Account.id).where(Account.name.in_(["Offset", "Unassigned"]))
            ).all()
        )

        statement = (
            select(
                cast(Any, transaction_table.c.category_id).label("category_id"),
                func.count(func.distinct(transaction_table.c.id)).label("transaction_count"),
                func.max(cast(Any, transaction_table.c.occurred_at)).label("last_used_at"),
                func.coalesce(
                    func.sum(case((leg_table.c.amount > 0, leg_table.c.amount), else_=0)),
                    0,
                ).label("income_total"),
                func.coalesce(
                    func.sum(case((leg_table.c.amount < 0, -leg_table.c.amount), else_=0)),
                    0,
                ).label("expense_total"),
            )
            .join_from(
                leg_table, transaction_table, leg_table.c.transaction_id == transaction_table.c.id
            )
            .where(transaction_table.c.category_id.in_(category_ids))
            .group_by(transaction_table.c.category_id)
        )
        if excluded_ids:
            statement = statement.where(~leg_table.c.account_id.in_(excluded_ids))

        rows = self.session.exec(statement).all()
        results: Dict[UUID, CategoryUsage] = {}
        for category_id, count, last_used_at, income_total, expense_total in rows:
            if category_id is None:
                continue
            results[category_id] = CategoryUsage(
                transaction_count=int(count or 0),
                last_used_at=last_used_at,
                income_total=coerce_decimal(income_total),
                expense_total=coerce_decimal(expense_total),
            )
        return results


__all__ = ["CategoryRepository", "CategoryUsage"]
