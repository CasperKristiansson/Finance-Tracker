"""Repository for investment transactions."""

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlmodel import Session, select

from ..models import InvestmentTransaction


class InvestmentTransactionRepository:
    """Persist and fetch investment transactions."""

    def __init__(self, session: Session):
        self.session = session

    def bulk_insert(self, transactions: List[InvestmentTransaction]) -> None:
        if not transactions:
            return
        self.session.add_all(transactions)
        self.session.commit()

    def list_transactions(
        self,
        *,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None,
        holding: Optional[str] = None,
        tx_type: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[InvestmentTransaction]:
        statement = select(InvestmentTransaction).order_by(InvestmentTransaction.occurred_at.desc())
        if start:
            statement = statement.where(InvestmentTransaction.occurred_at >= start)
        if end:
            statement = statement.where(InvestmentTransaction.occurred_at <= end)
        if holding:
            statement = statement.where(InvestmentTransaction.holding_name == holding)
        if tx_type:
            statement = statement.where(InvestmentTransaction.transaction_type == tx_type)
        if limit:
            statement = statement.limit(limit)
        result = self.session.exec(statement)
        return list(result.all())


__all__ = ["InvestmentTransactionRepository"]
