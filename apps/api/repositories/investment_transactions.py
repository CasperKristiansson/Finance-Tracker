"""Repository for investment transactions."""

from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional, cast
from uuid import UUID

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
        statement = select(InvestmentTransaction).order_by(
            cast(Any, InvestmentTransaction.occurred_at).desc()
        )
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

    def list_unsynced(self, limit: int = 200) -> List[InvestmentTransaction]:
        statement = (
            select(InvestmentTransaction)
            .where(cast(Any, InvestmentTransaction.ledger_transaction_id).is_(None))
            .order_by(cast(Any, InvestmentTransaction.occurred_at).asc())
            .limit(limit)
        )
        return list(self.session.exec(statement))

    def mark_linked(self, investment_tx_id: str, ledger_transaction_id: str) -> None:
        statement = select(InvestmentTransaction).where(
            InvestmentTransaction.id == investment_tx_id
        )
        model = self.session.exec(statement).one_or_none()
        if model is None:  # pragma: no cover - defensive
            return
        model.ledger_transaction_id = UUID(str(ledger_transaction_id))
        self.session.add(model)
        self.session.commit()


__all__ = ["InvestmentTransactionRepository"]
