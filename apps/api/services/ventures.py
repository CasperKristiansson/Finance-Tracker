"""Service layer for the Ventures feature."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlmodel import Session

from ..models import (
    Account,
    VentureCompany,
    VentureCompanyAccountLink,
    VentureDocument,
    VentureGraphLayout,
    VentureNote,
    VentureOwnershipEvent,
    VentureTimelineEvent,
    VentureValuationEvent,
)
from ..repositories.account import AccountRepository
from ..repositories.ventures import VentureRepository
from ..schemas import (
    VentureAccountLinkRead,
    VentureCompanyCreateRequest,
    VentureCompanyDetailResponse,
    VentureCompanyRead,
    VentureCompanySummaryRead,
    VentureCompanyUpdateRequest,
    VentureDeleteResponse,
    VentureDocumentCreateRequest,
    VentureDocumentHealthResponse,
    VentureDocumentHealthWarning,
    VentureDocumentListResponse,
    VentureDocumentRead,
    VentureGraphEdgeRead,
    VentureGraphLayoutNode,
    VentureGraphLayoutRead,
    VentureGraphLayoutUpdateRequest,
    VentureGraphViewport,
    VentureNoteCreateRequest,
    VentureNoteListResponse,
    VentureNoteRead,
    VentureNoteUpdateRequest,
    VentureOverviewKpis,
    VentureOverviewResponse,
    VentureOwnershipCreateRequest,
    VentureOwnershipRead,
    VenturePresignRequest,
    VenturePresignResponse,
    VentureTimelineEventRead,
    VentureValuationCreateRequest,
    VentureValuationRead,
)
from .ventures_storage import VentureStorage

_ZERO = Decimal("0")
_HUNDRED = Decimal("100")

_BASE_REQUIRED_DOCUMENTS: dict[str, str] = {
    "company_registration": "Add company registration or articles of association.",
    "ownership": "Add ownership evidence such as shareholder agreement or share register.",
    "valuation_memo": "Add valuation evidence for the latest paper value.",
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _risk_adjusted(paper_value: Decimal, haircut_percentage: Decimal) -> Decimal:
    return (paper_value * (_HUNDRED - haircut_percentage) / _HUNDRED).quantize(Decimal("0.01"))


def _uuid_strings(values: list[UUID]) -> list[str]:
    return [str(value) for value in values]


def _uuid_list(values: list[str]) -> list[UUID]:
    return [UUID(str(value)) for value in values]


class VentureService:
    """Business logic for venture companies, graph summaries, notes, and documents."""

    def __init__(self, session: Session, *, storage: Optional[VentureStorage] = None):
        self.session = session
        self.repository = VentureRepository(session)
        self.account_repository = AccountRepository(session)
        self.storage = storage

    def overview(self) -> VentureOverviewResponse:
        companies = self.repository.list_companies()
        summaries = [self._company_summary(company) for company in companies]
        status_counts: dict[str, int] = {}
        for company in companies:
            status_counts[company.status] = status_counts.get(company.status, 0) + 1

        ownership_edges = [
            self._ownership_edge(ownership)
            for ownership in self.repository.latest_ownership_events()
        ]
        total_paper = sum((summary.paper_value_sek for summary in summaries), _ZERO)
        total_risk_adjusted = sum((summary.risk_adjusted_value_sek for summary in summaries), _ZERO)
        total_realized = sum((summary.realized_value_sek for summary in summaries), _ZERO)
        illiquid = sum(
            (
                summary.paper_value_sek
                for summary in summaries
                if summary.latest_valuation is None
                or summary.latest_valuation.liquidity_level in {"none", "restricted"}
            ),
            _ZERO,
        )

        return VentureOverviewResponse(
            kpis=VentureOverviewKpis(
                total_paper_value_sek=total_paper,
                total_risk_adjusted_value_sek=total_risk_adjusted,
                total_realized_value_sek=total_realized,
                illiquid_paper_value_sek=illiquid,
                company_count=len(companies),
                status_counts=status_counts,
            ),
            companies=summaries,
            ownership_edges=ownership_edges,
            layout=self.graph_layout(),
            recent_activity=[
                self._timeline_read(event) for event in self.repository.recent_timeline(limit=12)
            ],
        )

    def create_company(self, data: VentureCompanyCreateRequest) -> VentureCompanyDetailResponse:
        company = VentureCompany(
            **data.model_dump(exclude={"account_links", "initial_valuation", "initial_ownership"})
        )
        company = self.repository.add_company(company)
        if data.account_links:
            self._replace_account_links(company.id, data.account_links)
        if data.initial_valuation is not None:
            self.add_valuation(company.id, data.initial_valuation)
        if data.initial_ownership is not None:
            self.add_ownership(company.id, data.initial_ownership)
        return self.company_detail(company.id)

    def company_detail(self, company_id: UUID) -> VentureCompanyDetailResponse:
        company = self._require_company(company_id)
        valuations = [
            self._valuation_read(row) for row in self.repository.list_valuations(company_id)
        ]
        ownership_events = [
            self._ownership_read(row) for row in self.repository.list_ownership_events(company_id)
        ]
        timeline = [self._timeline_read(row) for row in self.repository.list_timeline(company_id)]
        notes = [self._note_read(row) for row in self.repository.list_notes(company_id)]
        documents = [self._document_read(row) for row in self.repository.list_documents(company_id)]
        return VentureCompanyDetailResponse(
            summary=self._company_summary(company),
            valuations=valuations,
            ownership_events=ownership_events,
            timeline=timeline,
            notes=notes,
            documents=documents,
            document_health=self.document_health(company_id),
        )

    def update_company(
        self, company_id: UUID, data: VentureCompanyUpdateRequest
    ) -> VentureCompanyDetailResponse:
        company = self._require_company(company_id)
        updates = data.model_dump(exclude_unset=True, exclude={"account_links"})
        if updates:
            company = self.repository.update_company(company, updates)
        if data.account_links is not None:
            self._replace_account_links(company.id, data.account_links)
        return self.company_detail(company.id)

    def delete_company(self, company_id: UUID) -> VentureDeleteResponse:
        company = self._require_company(company_id)
        self.repository.soft_delete_company(company)
        return VentureDeleteResponse(id=company_id)

    def add_valuation(
        self, company_id: UUID, data: VentureValuationCreateRequest
    ) -> VentureValuationRead:
        self._require_company(company_id)
        valuation = VentureValuationEvent(
            company_id=company_id,
            **data.model_dump(exclude={"linked_document_ids"}),
            linked_document_ids=_uuid_strings(data.linked_document_ids),
        )
        valuation = self.repository.add_valuation(valuation)
        self.repository.add_timeline_event(
            VentureTimelineEvent(
                company_id=company_id,
                event_date=data.event_date,
                event_type="valuation",
                title=data.label,
                description=data.note,
                valuation_event_id=valuation.id,
            )
        )
        return self._valuation_read(valuation)

    def add_ownership(
        self, company_id: UUID, data: VentureOwnershipCreateRequest
    ) -> VentureOwnershipRead:
        self._require_company(company_id)
        if data.owner_company_id is not None:
            if data.owner_company_id == company_id:
                raise ValueError("A company cannot own itself")
            self._require_company(data.owner_company_id)
        ownership = VentureOwnershipEvent(
            company_id=company_id,
            **data.model_dump(exclude={"linked_document_ids"}),
            linked_document_ids=_uuid_strings(data.linked_document_ids),
        )
        ownership = self.repository.add_ownership(ownership)
        self.repository.add_timeline_event(
            VentureTimelineEvent(
                company_id=company_id,
                event_date=data.effective_date,
                event_type="ownership",
                title=data.reason or "Ownership updated",
                description=data.note,
                ownership_event_id=ownership.id,
            )
        )
        return self._ownership_read(ownership)

    def list_notes(self, company_id: UUID) -> VentureNoteListResponse:
        self._require_company(company_id)
        return VentureNoteListResponse(
            notes=[self._note_read(note) for note in self.repository.list_notes(company_id)]
        )

    def create_note(self, company_id: UUID, data: VentureNoteCreateRequest) -> VentureNoteRead:
        self._require_company(company_id)
        note = VentureNote(
            company_id=company_id,
            **data.model_dump(exclude={"document_ids"}),
            document_ids=_uuid_strings(data.document_ids),
        )
        note = self.repository.add_note(note)
        self.repository.add_timeline_event(
            VentureTimelineEvent(
                company_id=company_id,
                event_date=data.note_date,
                event_type="note",
                title=data.title,
                description=None,
                note_id=note.id,
            )
        )
        return self._note_read(note)

    def update_note(
        self, company_id: UUID, note_id: UUID, data: VentureNoteUpdateRequest
    ) -> VentureNoteRead:
        self._require_company(company_id)
        note = self._require_note(company_id, note_id)
        updates = data.model_dump(exclude_unset=True)
        if "document_ids" in updates:
            updates["document_ids"] = _uuid_strings(updates["document_ids"])
        return self._note_read(self.repository.update_note(note, updates))

    def delete_note(self, company_id: UUID, note_id: UUID) -> VentureDeleteResponse:
        self._require_company(company_id)
        note = self._require_note(company_id, note_id)
        self.repository.soft_delete_note(note)
        return VentureDeleteResponse(id=note_id)

    def list_documents(self, company_id: UUID) -> VentureDocumentListResponse:
        self._require_company(company_id)
        documents = [self._document_read(row) for row in self.repository.list_documents(company_id)]
        return VentureDocumentListResponse(
            documents=documents,
            document_health=self.document_health(company_id),
        )

    def create_document(
        self, company_id: UUID, data: VentureDocumentCreateRequest
    ) -> VentureDocumentRead:
        self._require_company(company_id)
        document = VentureDocument(company_id=company_id, **data.model_dump())
        document = self.repository.add_document(document)
        self.repository.add_timeline_event(
            VentureTimelineEvent(
                company_id=company_id,
                event_date=data.document_date or date.today(),
                event_type="document",
                title=data.title,
                description=None,
                document_id=document.id,
            )
        )
        return self._document_read(document)

    def delete_document(self, company_id: UUID, document_id: UUID) -> VentureDeleteResponse:
        self._require_company(company_id)
        document = self._require_document(company_id, document_id)
        self.repository.soft_delete_document(document)
        return VentureDeleteResponse(id=document_id)

    def graph_layout(self, *, layout_key: str = "default") -> VentureGraphLayoutRead:
        layouts = self.repository.list_layouts(layout_key=layout_key)
        nodes: list[VentureGraphLayoutNode] = []
        viewport: Optional[VentureGraphViewport] = None
        for layout in layouts:
            if layout.company_id is not None and layout.x is not None and layout.y is not None:
                nodes.append(
                    VentureGraphLayoutNode(
                        company_id=layout.company_id,
                        x=layout.x,
                        y=layout.y,
                        pinned=layout.pinned,
                    )
                )
            if layout.company_id is None and layout.viewport is not None:
                viewport = VentureGraphViewport.model_validate(layout.viewport)
        return VentureGraphLayoutRead(layout_key=layout_key, nodes=nodes, viewport=viewport)

    def save_graph_layout(self, data: VentureGraphLayoutUpdateRequest) -> VentureGraphLayoutRead:
        company_ids = {company.id for company in self.repository.list_companies()}
        missing = [node.company_id for node in data.nodes if node.company_id not in company_ids]
        if missing:
            raise LookupError("Layout references an unknown company")
        layouts = [
            VentureGraphLayout(
                layout_key=data.layout_key,
                company_id=node.company_id,
                x=node.x,
                y=node.y,
                pinned=node.pinned,
            )
            for node in data.nodes
        ]
        viewport = data.viewport.model_dump(mode="json") if data.viewport is not None else None
        self.repository.replace_layouts(
            layout_key=data.layout_key,
            layouts=layouts,
            viewport=viewport,
        )
        return self.graph_layout(layout_key=data.layout_key)

    def presign(self, user_id: str, data: VenturePresignRequest) -> VenturePresignResponse:
        storage = self.storage or VentureStorage.from_env()
        if data.operation == "upload":
            if data.file_name is None or data.mime_type is None:
                raise ValueError("Upload request is incomplete")
            if data.company_id is None and data.purpose != "logo":
                raise ValueError("Upload request is incomplete")
            if data.file_size_bytes is None:
                raise ValueError("file_size_bytes is required")
            if data.company_id is not None:
                self._require_company(data.company_id)
            storage.validate_upload(
                purpose=data.purpose,
                file_name=data.file_name,
                mime_type=data.mime_type,
                size_bytes=data.file_size_bytes,
            )
            key = storage.build_object_key(
                user_id=user_id,
                company_id=data.company_id,
                purpose=data.purpose,
                file_name=data.file_name,
            )
            return VenturePresignResponse(
                url=storage.create_upload_url(key=key, mime_type=data.mime_type),
                method="PUT",
                storage_key=key,
                headers={"Content-Type": data.mime_type},
                expires_in_seconds=storage.url_expires_seconds,
            )

        download_key = data.storage_key
        if data.document_id is not None:
            document = self.repository.get_document(data.document_id)
            if document is None:
                raise LookupError("Document not found")
            download_key = document.storage_key
        elif download_key and not storage.is_user_key(user_id=user_id, key=download_key):
            raise ValueError("Storage key is outside the current user's Ventures files")
        if not download_key:
            raise ValueError("No storage key is available for download")
        return VenturePresignResponse(
            url=storage.create_download_url(key=download_key),
            method="GET",
            storage_key=download_key,
            expires_in_seconds=storage.url_expires_seconds,
        )

    def document_health(self, company_id: UUID) -> VentureDocumentHealthResponse:
        company = self._require_company(company_id)
        documents = self.repository.list_documents(company_id)
        present_categories = {
            document.category
            for document in documents
            if document.deleted_at is None and document.status != "missing"
        }
        required = dict(_BASE_REQUIRED_DOCUMENTS)
        if company.status == "exited":
            required["exit_evidence"] = (
                "Add exit evidence such as SPA, closing memo, or sale agreement."
            )
        if company.status == "failed":
            required["closure_evidence"] = "Add closure or write-off evidence."

        warnings: list[VentureDocumentHealthWarning] = []
        for category, message in required.items():
            if category not in present_categories:
                warnings.append(
                    VentureDocumentHealthWarning(
                        code="missing_document_category",
                        message=message,
                        category=category,
                    )
                )

        latest_valuation = self.repository.latest_valuation(company_id)
        if latest_valuation is not None and not latest_valuation.linked_document_ids:
            warnings.append(
                VentureDocumentHealthWarning(
                    code="valuation_missing_evidence",
                    message="Latest valuation has no linked evidence document.",
                    category="valuation_memo",
                )
            )
        latest_ownership = self.repository.latest_ownership(company_id)
        if latest_ownership is not None and not latest_ownership.linked_document_ids:
            warnings.append(
                VentureDocumentHealthWarning(
                    code="ownership_missing_evidence",
                    message="Latest ownership event has no linked evidence document.",
                    category="ownership",
                )
            )
        return VentureDocumentHealthResponse(
            warnings=warnings,
            missing_categories=[
                warning.category for warning in warnings if warning.category is not None
            ],
        )

    def _company_summary(self, company: VentureCompany) -> VentureCompanySummaryRead:
        latest_valuation = self.repository.latest_valuation(company.id)
        latest_ownership = self.repository.latest_ownership(company.id)
        paper_value = _ZERO
        risk_adjusted_value = _ZERO
        realized_value = _ZERO
        if company.valuation_mode == "account_balance_sync":
            paper_value = self._account_synced_value(company.id)
            risk_adjusted_value = paper_value
        elif latest_valuation is not None:
            paper_value = latest_valuation.paper_value_sek
            risk_adjusted_value = _risk_adjusted(
                latest_valuation.paper_value_sek,
                latest_valuation.haircut_percentage,
            )
        if latest_valuation is not None:
            realized_value = latest_valuation.realized_value_sek

        last_activity_at = max(
            [company.updated_at]
            + [
                value
                for value in (
                    latest_valuation.updated_at if latest_valuation else None,
                    latest_ownership.updated_at if latest_ownership else None,
                )
                if value is not None
            ]
        )
        return VentureCompanySummaryRead(
            company=VentureCompanyRead.model_validate(company),
            latest_valuation=self._valuation_read(latest_valuation) if latest_valuation else None,
            latest_ownership=self._ownership_read(latest_ownership) if latest_ownership else None,
            account_links=[
                self._account_link_read(link)
                for link in self.repository.list_account_links(company.id)
            ],
            paper_value_sek=paper_value,
            risk_adjusted_value_sek=risk_adjusted_value,
            realized_value_sek=realized_value,
            ownership_pct=(
                latest_ownership.direct_ownership_pct if latest_ownership is not None else None
            ),
            last_activity_at=last_activity_at,
        )

    def _account_synced_value(self, company_id: UUID) -> Decimal:
        total = _ZERO
        for link in self.repository.list_account_links(company_id):
            if not link.include_in_synced_value:
                continue
            account = self.session.get(Account, link.account_id)
            if account is None or not account.is_active:
                continue
            total += self.account_repository.calculate_balance(link.account_id) * link.weight
        return total.quantize(Decimal("0.01"))

    def _replace_account_links(self, company_id: UUID, links: list[Any]) -> None:
        new_links: list[VentureCompanyAccountLink] = []
        for link in links:
            account = self.session.get(Account, link.account_id)
            if account is None:
                raise LookupError("Linked account not found")
            new_links.append(
                VentureCompanyAccountLink(
                    company_id=company_id,
                    account_id=link.account_id,
                    include_in_synced_value=link.include_in_synced_value,
                    weight=link.weight,
                )
            )
        self.repository.replace_account_links(company_id, new_links)

    def _require_company(self, company_id: UUID) -> VentureCompany:
        company = self.repository.get_company(company_id)
        if company is None:
            raise LookupError("Company not found")
        return company

    def _require_note(self, company_id: UUID, note_id: UUID) -> VentureNote:
        note = self.repository.get_note(note_id)
        if note is None or note.company_id != company_id:
            raise LookupError("Note not found")
        return note

    def _require_document(self, company_id: UUID, document_id: UUID) -> VentureDocument:
        document = self.repository.get_document(document_id)
        if document is None or document.company_id != company_id:
            raise LookupError("Document not found")
        return document

    def _valuation_read(self, valuation: VentureValuationEvent) -> VentureValuationRead:
        payload = valuation.model_dump(mode="python")
        payload["linked_document_ids"] = _uuid_list(valuation.linked_document_ids)
        payload["risk_adjusted_value_sek"] = _risk_adjusted(
            valuation.paper_value_sek,
            valuation.haircut_percentage,
        )
        return VentureValuationRead.model_validate(payload)

    def _ownership_read(self, ownership: VentureOwnershipEvent) -> VentureOwnershipRead:
        payload = ownership.model_dump(mode="python")
        payload["linked_document_ids"] = _uuid_list(ownership.linked_document_ids)
        return VentureOwnershipRead.model_validate(payload)

    def _timeline_read(self, event: VentureTimelineEvent) -> VentureTimelineEventRead:
        return VentureTimelineEventRead.model_validate(event)

    def _note_read(self, note: VentureNote) -> VentureNoteRead:
        payload = note.model_dump(mode="python")
        payload["document_ids"] = _uuid_list(note.document_ids)
        return VentureNoteRead.model_validate(payload)

    def _document_read(self, document: VentureDocument) -> VentureDocumentRead:
        return VentureDocumentRead.model_validate(document)

    def _account_link_read(self, link: VentureCompanyAccountLink) -> VentureAccountLinkRead:
        return VentureAccountLinkRead.model_validate(link)

    def _ownership_edge(self, ownership: VentureOwnershipEvent) -> VentureGraphEdgeRead:
        return VentureGraphEdgeRead(
            company_id=ownership.company_id,
            owner_type=ownership.owner_type,
            owner_company_id=ownership.owner_company_id,
            ownership_pct=ownership.direct_ownership_pct,
            fully_diluted_ownership_pct=ownership.fully_diluted_ownership_pct,
        )


__all__ = ["VentureService"]
