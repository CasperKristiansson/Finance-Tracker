"""Repository for Ventures entities."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional, cast
from uuid import UUID

from sqlalchemy import desc
from sqlmodel import Session, select

from ..models import (
    VentureCompany,
    VentureCompanyAccountLink,
    VentureDocument,
    VentureGraphLayout,
    VentureNote,
    VentureOwnershipEvent,
    VentureTimelineEvent,
    VentureValuationEvent,
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class VentureRepository:
    """Data access layer for venture companies and related rows."""

    def __init__(self, session: Session):
        self.session = session

    def list_companies(self) -> list[VentureCompany]:
        statement = (
            select(VentureCompany)
            .where(cast(Any, VentureCompany.deleted_at).is_(None))
            .order_by(cast(Any, VentureCompany.display_order), cast(Any, VentureCompany.name))
        )
        return list(self.session.exec(statement).all())

    def get_company(self, company_id: UUID) -> Optional[VentureCompany]:
        company = self.session.get(VentureCompany, company_id)
        if company is None or company.deleted_at is not None:
            return None
        return company

    def add_company(self, company: VentureCompany) -> VentureCompany:
        self.session.add(company)
        self.session.flush()
        self.session.refresh(company)
        return company

    def update_company(self, company: VentureCompany, updates: dict[str, Any]) -> VentureCompany:
        for key, value in updates.items():
            setattr(company, key, value)
        company.updated_at = _now()
        self.session.add(company)
        self.session.flush()
        self.session.refresh(company)
        return company

    def soft_delete_company(self, company: VentureCompany) -> VentureCompany:
        company.deleted_at = _now()
        company.updated_at = company.deleted_at
        self.session.add(company)
        self.session.flush()
        return company

    def add_valuation(self, valuation: VentureValuationEvent) -> VentureValuationEvent:
        self.session.add(valuation)
        self.session.flush()
        self.session.refresh(valuation)
        return valuation

    def list_valuations(self, company_id: UUID) -> list[VentureValuationEvent]:
        statement = (
            select(VentureValuationEvent)
            .where(cast(Any, VentureValuationEvent.company_id) == company_id)
            .order_by(
                desc(cast(Any, VentureValuationEvent.event_date)),
                desc(cast(Any, VentureValuationEvent.created_at)),
            )
        )
        return list(self.session.exec(statement).all())

    def latest_valuation(self, company_id: UUID) -> Optional[VentureValuationEvent]:
        statement = (
            select(VentureValuationEvent)
            .where(cast(Any, VentureValuationEvent.company_id) == company_id)
            .where(cast(Any, VentureValuationEvent.include_in_venture_totals).is_(True))
            .order_by(
                desc(cast(Any, VentureValuationEvent.event_date)),
                desc(cast(Any, VentureValuationEvent.created_at)),
            )
            .limit(1)
        )
        return self.session.exec(statement).one_or_none()

    def add_ownership(self, ownership: VentureOwnershipEvent) -> VentureOwnershipEvent:
        self.session.add(ownership)
        self.session.flush()
        self.session.refresh(ownership)
        return ownership

    def list_ownership_events(self, company_id: UUID) -> list[VentureOwnershipEvent]:
        statement = (
            select(VentureOwnershipEvent)
            .where(cast(Any, VentureOwnershipEvent.company_id) == company_id)
            .order_by(
                desc(cast(Any, VentureOwnershipEvent.effective_date)),
                desc(cast(Any, VentureOwnershipEvent.created_at)),
            )
        )
        return list(self.session.exec(statement).all())

    def latest_ownership(self, company_id: UUID) -> Optional[VentureOwnershipEvent]:
        statement = (
            select(VentureOwnershipEvent)
            .where(cast(Any, VentureOwnershipEvent.company_id) == company_id)
            .order_by(
                desc(cast(Any, VentureOwnershipEvent.effective_date)),
                desc(cast(Any, VentureOwnershipEvent.created_at)),
            )
            .limit(1)
        )
        return self.session.exec(statement).one_or_none()

    def latest_ownership_events(self) -> list[VentureOwnershipEvent]:
        companies = self.list_companies()
        return [
            ownership
            for company in companies
            if (ownership := self.latest_ownership(company.id)) is not None
        ]

    def add_timeline_event(self, event: VentureTimelineEvent) -> VentureTimelineEvent:
        self.session.add(event)
        self.session.flush()
        self.session.refresh(event)
        return event

    def list_timeline(
        self, company_id: UUID, *, limit: Optional[int] = None
    ) -> list[VentureTimelineEvent]:
        statement = (
            select(VentureTimelineEvent)
            .where(cast(Any, VentureTimelineEvent.company_id) == company_id)
            .order_by(
                desc(cast(Any, VentureTimelineEvent.event_date)),
                desc(cast(Any, VentureTimelineEvent.created_at)),
            )
        )
        if limit is not None:
            statement = statement.limit(limit)
        return list(self.session.exec(statement).all())

    def recent_timeline(self, *, limit: int = 12) -> list[VentureTimelineEvent]:
        company_ids = [company.id for company in self.list_companies()]
        if not company_ids:
            return []
        statement = (
            select(VentureTimelineEvent)
            .where(cast(Any, VentureTimelineEvent.company_id).in_(company_ids))
            .order_by(
                desc(cast(Any, VentureTimelineEvent.event_date)),
                desc(cast(Any, VentureTimelineEvent.created_at)),
            )
            .limit(limit)
        )
        return list(self.session.exec(statement).all())

    def list_account_links(self, company_id: UUID) -> list[VentureCompanyAccountLink]:
        statement = (
            select(VentureCompanyAccountLink)
            .where(cast(Any, VentureCompanyAccountLink.company_id) == company_id)
            .order_by(cast(Any, VentureCompanyAccountLink.created_at))
        )
        return list(self.session.exec(statement).all())

    def replace_account_links(
        self, company_id: UUID, links: list[VentureCompanyAccountLink]
    ) -> list[VentureCompanyAccountLink]:
        existing = self.list_account_links(company_id)
        for link in existing:
            self.session.delete(link)
        self.session.flush()
        for link in links:
            self.session.add(link)
        self.session.flush()
        for link in links:
            self.session.refresh(link)
        return links

    def add_note(self, note: VentureNote) -> VentureNote:
        self.session.add(note)
        self.session.flush()
        self.session.refresh(note)
        return note

    def get_note(self, note_id: UUID) -> Optional[VentureNote]:
        note = self.session.get(VentureNote, note_id)
        if note is None or note.deleted_at is not None:
            return None
        return note

    def list_notes(self, company_id: UUID) -> list[VentureNote]:
        statement = (
            select(VentureNote)
            .where(cast(Any, VentureNote.company_id) == company_id)
            .where(cast(Any, VentureNote.deleted_at).is_(None))
            .order_by(
                desc(cast(Any, VentureNote.pinned)),
                desc(cast(Any, VentureNote.note_date)),
                desc(cast(Any, VentureNote.created_at)),
            )
        )
        return list(self.session.exec(statement).all())

    def update_note(self, note: VentureNote, updates: dict[str, Any]) -> VentureNote:
        for key, value in updates.items():
            setattr(note, key, value)
        note.updated_at = _now()
        self.session.add(note)
        self.session.flush()
        self.session.refresh(note)
        return note

    def soft_delete_note(self, note: VentureNote) -> VentureNote:
        note.deleted_at = _now()
        note.updated_at = note.deleted_at
        self.session.add(note)
        self.session.flush()
        return note

    def add_document(self, document: VentureDocument) -> VentureDocument:
        self.session.add(document)
        self.session.flush()
        self.session.refresh(document)
        return document

    def get_document(self, document_id: UUID) -> Optional[VentureDocument]:
        document = self.session.get(VentureDocument, document_id)
        if document is None or document.deleted_at is not None:
            return None
        return document

    def list_documents(self, company_id: UUID) -> list[VentureDocument]:
        statement = (
            select(VentureDocument)
            .where(cast(Any, VentureDocument.company_id) == company_id)
            .where(cast(Any, VentureDocument.deleted_at).is_(None))
            .order_by(
                desc(cast(Any, VentureDocument.document_date)),
                desc(cast(Any, VentureDocument.uploaded_at)),
            )
        )
        return list(self.session.exec(statement).all())

    def soft_delete_document(self, document: VentureDocument) -> VentureDocument:
        document.deleted_at = _now()
        document.updated_at = document.deleted_at
        self.session.add(document)
        self.session.flush()
        return document

    def list_layouts(self, *, layout_key: str = "default") -> list[VentureGraphLayout]:
        statement = select(VentureGraphLayout).where(
            cast(Any, VentureGraphLayout.layout_key) == layout_key
        )
        return list(self.session.exec(statement).all())

    def replace_layouts(
        self,
        *,
        layout_key: str,
        layouts: list[VentureGraphLayout],
        viewport: Optional[dict[str, Any]],
    ) -> list[VentureGraphLayout]:
        existing = self.list_layouts(layout_key=layout_key)
        for layout in existing:
            self.session.delete(layout)
        self.session.flush()
        if viewport is not None:
            self.session.add(VentureGraphLayout(layout_key=layout_key, viewport=viewport))
        for layout in layouts:
            self.session.add(layout)
        self.session.flush()
        for layout in layouts:
            self.session.refresh(layout)
        return layouts


__all__ = ["VentureRepository"]
