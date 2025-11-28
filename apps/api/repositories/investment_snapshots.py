"""Repository for investment snapshots and holdings."""

from __future__ import annotations

from typing import Iterable, List, Optional
from uuid import UUID

from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..models import InvestmentHolding, InvestmentSnapshot


class InvestmentSnapshotRepository:
    """Persist and retrieve investment snapshots."""

    def __init__(self, session: Session):
        self.session = session

    def create_with_holdings(
        self,
        snapshot: InvestmentSnapshot,
        holdings: Iterable[InvestmentHolding],
    ) -> InvestmentSnapshot:
        self.session.add(snapshot)
        self.session.flush()
        holding_list = list(holdings)
        for holding in holding_list:
            holding.snapshot_id = snapshot.id
        if holding_list:
            self.session.add_all(holding_list)
        self.session.commit()
        self.session.refresh(snapshot)
        return snapshot

    def list_snapshots(self, limit: Optional[int] = None) -> List[InvestmentSnapshot]:
        statement = (
            select(InvestmentSnapshot)
            .options(selectinload(InvestmentSnapshot.holdings))
            .order_by(InvestmentSnapshot.snapshot_date.desc(), InvestmentSnapshot.created_at.desc())
        )
        if limit:
            statement = statement.limit(limit)
        result = self.session.exec(statement)
        return list(result.all())

    def get_snapshot(self, snapshot_id: UUID) -> Optional[InvestmentSnapshot]:
        statement = (
            select(InvestmentSnapshot)
            .where(InvestmentSnapshot.id == snapshot_id)
            .options(selectinload(InvestmentSnapshot.holdings))
        )
        return self.session.exec(statement).one_or_none()

    def latest_snapshot(self) -> Optional[InvestmentSnapshot]:
        statement = (
            select(InvestmentSnapshot)
            .order_by(InvestmentSnapshot.snapshot_date.desc(), InvestmentSnapshot.created_at.desc())
            .options(selectinload(InvestmentSnapshot.holdings))
            .limit(1)
        )
        return self.session.exec(statement).one_or_none()


__all__ = ["InvestmentSnapshotRepository"]
