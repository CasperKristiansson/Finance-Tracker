"""Service layer for category operations."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, Dict, List, cast
from uuid import UUID

from sqlalchemy import update
from sqlmodel import Session, select

from ..models import Budget, Category, Transaction
from ..repositories.category import CategoryRepository, CategoryUsage


class CategoryService:
    """Coordinates business logic around categories."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = CategoryRepository(session)

    def list_categories(
        self,
        include_archived: bool = False,
        include_special: bool = False,
    ) -> List[Category]:
        return self.repository.list(
            include_archived=include_archived,
            include_special=include_special,
        )

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
        if source.category_type != target.category_type:
            raise ValueError("Categories must have the same type to merge")

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

    def get_category_usage(self, category_ids: List[UUID]) -> Dict[UUID, CategoryUsage]:
        return self.repository.usage_by_category_ids(category_ids)

    def get_recent_category_months(
        self,
        category_ids: List[UUID],
        *,
        months: int = 6,
        as_of: date | None = None,
    ) -> Dict[UUID, Dict[date, tuple[Decimal, Decimal]]]:
        """Fetch month buckets for a category sparkline."""

        if months <= 0:
            return {}

        today = as_of or date.today()
        end_month = date(today.year, today.month, 1)
        start_month = end_month
        for _ in range(months - 1):
            year = start_month.year
            month = start_month.month - 1
            if month == 0:
                year -= 1
                month = 12
            start_month = date(year, month, 1)

        start_dt = datetime.combine(start_month, datetime.min.time(), tzinfo=timezone.utc)
        end_dt = datetime.combine(end_month, datetime.min.time(), tzinfo=timezone.utc) + timedelta(
            days=32
        )
        end_dt = datetime(end_dt.year, end_dt.month, 1, tzinfo=timezone.utc)
        return self.repository.monthly_totals_by_category_ids(
            category_ids,
            start=start_dt,
            end=end_dt,
        )


__all__ = ["CategoryService"]
