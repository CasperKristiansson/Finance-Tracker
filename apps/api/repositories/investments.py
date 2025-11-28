"""Repository for investment snapshots."""

from __future__ import annotations

from typing import List, Optional

from sqlmodel import Session, select

from ..models import InvestmentSnapshot


class InvestmentSnapshotRepository:
    """Persist and retrieve investment snapshots (e.g., Nordnet exports)."""

    def __init__(self, session: Session):
        self.session = session

    def create(self, snapshot: InvestmentSnapshot) -> InvestmentSnapshot:
        self.session.add(snapshot)
        self.session.commit()
        self.session.refresh(snapshot)
        return snapshot

    def list(self, limit: Optional[int] = None) -> List[InvestmentSnapshot]:
        statement = (
            select(InvestmentSnapshot)
            .order_by(InvestmentSnapshot.snapshot_date.desc(), InvestmentSnapshot.created_at.desc())
            .execution_options(populate_existing=True)
        )
        if limit:
            statement = statement.limit(limit)
        result = self.session.exec(statement)
        return list(result.all())


__all__ = ["InvestmentSnapshotRepository"]
