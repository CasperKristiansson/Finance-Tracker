"""Repository for budgets."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from typing import Any, List, Optional, cast
from uuid import UUID

from sqlalchemy import func
from sqlmodel import Session, select

from ..models import Budget, Category, Transaction, TransactionLeg
from ..shared import BudgetPeriod, CategoryType, coerce_decimal


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

    def list_with_spend(self, *, as_of: datetime) -> List[tuple[Budget, Decimal]]:
        budgets = self.list()
        if not budgets:
            return []

        categories = dict(self.session.exec(select(Category.id, Category.category_type)).all())

        results: List[tuple[Budget, Decimal]] = []
        for budget in budgets:
            category_type = categories.get(budget.category_id)
            if category_type is None:
                continue

            start, end = _period_bounds(budget.period, as_of)
            stmt = (
                select(func.sum(TransactionLeg.amount))
                .join(
                    Transaction,
                    cast(Any, TransactionLeg.transaction_id == Transaction.id),
                )
                .where(cast(Any, Transaction.category_id == budget.category_id))
                .where(Transaction.occurred_at >= start)
                .where(Transaction.occurred_at < end)
            )

            if category_type == CategoryType.INCOME:
                stmt = stmt.where(TransactionLeg.amount > 0)
            else:
                stmt = stmt.where(TransactionLeg.amount < 0)

            aggregated = self.session.exec(stmt).one_or_none()
            spend_raw = aggregated or 0
            spend = coerce_decimal(spend_raw or 0)
            if category_type != CategoryType.INCOME:
                spend = -spend
            results.append((budget, spend))
        return results


def _period_bounds(period: BudgetPeriod, as_of: datetime) -> tuple[datetime, datetime]:
    as_of_date = as_of.date()
    if period == BudgetPeriod.MONTHLY:
        start_date = as_of_date.replace(day=1)
        end_date = (start_date.replace(day=28) + timedelta(days=4)).replace(day=1)
    elif period == BudgetPeriod.QUARTERLY:
        quarter = (as_of_date.month - 1) // 3
        start_month = quarter * 3 + 1
        start_date = date(as_of_date.year, start_month, 1)
        end_month = start_month + 3
        if end_month > 12:
            end_date = date(as_of_date.year + 1, 1, 1)
        else:
            end_date = date(as_of_date.year, end_month, 1)
    else:
        start_date = date(as_of_date.year, 1, 1)
        end_date = date(as_of_date.year + 1, 1, 1)

    start_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(end_date, datetime.min.time(), tzinfo=timezone.utc)
    return start_dt, end_dt


__all__ = ["BudgetRepository"]
