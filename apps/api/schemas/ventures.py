"""Pydantic schemas for Ventures API contracts."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator

VentureCompanyStatus = Literal["idea", "ongoing", "stale", "exited", "failed"]
VentureCompanyType = Literal["startup", "private_company", "consulting", "holding", "other"]
VentureRole = Literal[
    "founder", "co-founder", "owner", "advisor", "investor", "board observer", "other"
]
VentureValuationMode = Literal["manual", "account_balance_sync"]
VentureValuationSource = Literal[
    "founder_estimate",
    "financing_round",
    "offer",
    "annual_accounts",
    "model",
    "external_valuation",
    "account_balance_sync",
]
VentureLiquidityLevel = Literal["none", "restricted", "possible_secondary", "liquid"]
VentureOwnerType = Literal["person", "company"]
VentureDocumentStatus = Literal["verified", "linked", "draft", "pending_review", "missing"]
VentureUploadPurpose = Literal["logo", "document"]
VenturePresignOperation = Literal["upload", "download"]


def _reject_explicit_nulls(data: Any, field_names: set[str]) -> Any:
    """Reject explicit nulls for patch fields that are nullable only when omitted."""

    if not isinstance(data, dict):
        return data
    null_fields = sorted(field for field in field_names if field in data and data[field] is None)
    if null_fields:
        raise ValueError(f"Fields cannot be null: {', '.join(null_fields)}")
    return data


class VentureAccountLinkRequest(BaseModel):
    """Account link used by account-balance-synced company valuations."""

    account_id: UUID
    include_in_synced_value: bool = True
    weight: Decimal = Field(default=Decimal("1"), ge=Decimal("0"))


class VentureAccountLinkRead(VentureAccountLinkRequest):
    """Persisted account link."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID


class VentureValuationCreateRequest(BaseModel):
    """Create a valuation event."""

    event_date: date
    label: str = Field(min_length=1, max_length=160)
    event_type: str = Field(default="valuation", max_length=40)
    paper_value_sek: Decimal = Field(ge=Decimal("0"))
    haircut_percentage: Decimal = Field(default=Decimal("0"), ge=Decimal("0"), le=Decimal("100"))
    realized_value_sek: Decimal = Field(default=Decimal("0"), ge=Decimal("0"))
    valuation_source: VentureValuationSource
    liquidity_level: VentureLiquidityLevel = "none"
    confidence_score: Optional[int] = Field(default=None, ge=1, le=5)
    include_in_venture_totals: bool = True
    note: Optional[str] = None
    linked_document_ids: list[UUID] = Field(default_factory=list)


class VentureValuationRead(VentureValuationCreateRequest):
    """Read model for a valuation event."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    risk_adjusted_value_sek: Decimal
    created_at: datetime
    updated_at: datetime


class VentureOwnershipCreateRequest(BaseModel):
    """Create an ownership event."""

    owner_type: VentureOwnerType = "person"
    owner_company_id: Optional[UUID] = None
    effective_date: date
    reason: Optional[str] = Field(default=None, max_length=160)
    direct_ownership_pct: Decimal = Field(ge=Decimal("0"), le=Decimal("100"))
    fully_diluted_ownership_pct: Optional[Decimal] = Field(
        default=None, ge=Decimal("0"), le=Decimal("100")
    )
    shares_owned: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    total_shares: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    share_class: Optional[str] = Field(default=None, max_length=80)
    voting_rights_pct: Optional[Decimal] = Field(default=None, ge=Decimal("0"), le=Decimal("100"))
    option_or_warrant_notes: Optional[str] = None
    invested_capital_sek: Optional[Decimal] = Field(default=None, ge=Decimal("0"))
    note: Optional[str] = None
    linked_document_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_company_owner(self) -> "VentureOwnershipCreateRequest":
        if self.owner_type == "company" and self.owner_company_id is None:
            raise ValueError("owner_company_id is required when owner_type is company")
        if self.owner_type == "person" and self.owner_company_id is not None:
            raise ValueError("owner_company_id is only valid for company owners")
        return self


class VentureOwnershipRead(VentureOwnershipCreateRequest):
    """Read model for an ownership event."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    created_at: datetime
    updated_at: datetime


class VentureCompanyCreateRequest(BaseModel):
    """Create a venture company with optional initial state."""

    name: str = Field(min_length=1, max_length=180)
    legal_name: Optional[str] = Field(default=None, max_length=240)
    description: Optional[str] = None
    company_type: VentureCompanyType = "startup"
    status: VentureCompanyStatus = "idea"
    role: VentureRole = "founder"
    valuation_mode: VentureValuationMode = "manual"
    industry: Optional[str] = Field(default=None, max_length=120)
    stage: Optional[str] = Field(default=None, max_length=80)
    country: Optional[str] = Field(default=None, max_length=80)
    founded_on: Optional[date] = None
    joined_on: Optional[date] = None
    exited_on: Optional[date] = None
    closed_on: Optional[date] = None
    logo_storage_key: Optional[str] = Field(default=None, max_length=512)
    logo_file_name: Optional[str] = Field(default=None, max_length=255)
    logo_content_type: Optional[str] = Field(default=None, max_length=120)
    node_color: Optional[str] = Field(default=None, max_length=32)
    display_order: int = 0
    account_links: list[VentureAccountLinkRequest] = Field(default_factory=list)
    initial_valuation: Optional[VentureValuationCreateRequest] = None
    initial_ownership: Optional[VentureOwnershipCreateRequest] = None


class VentureCompanyUpdateRequest(BaseModel):
    """Patch a venture company."""

    name: Optional[str] = Field(default=None, min_length=1, max_length=180)
    legal_name: Optional[str] = Field(default=None, max_length=240)
    description: Optional[str] = None
    company_type: Optional[VentureCompanyType] = None
    status: Optional[VentureCompanyStatus] = None
    role: Optional[VentureRole] = None
    valuation_mode: Optional[VentureValuationMode] = None
    industry: Optional[str] = Field(default=None, max_length=120)
    stage: Optional[str] = Field(default=None, max_length=80)
    country: Optional[str] = Field(default=None, max_length=80)
    founded_on: Optional[date] = None
    joined_on: Optional[date] = None
    exited_on: Optional[date] = None
    closed_on: Optional[date] = None
    logo_storage_key: Optional[str] = Field(default=None, max_length=512)
    logo_file_name: Optional[str] = Field(default=None, max_length=255)
    logo_content_type: Optional[str] = Field(default=None, max_length=120)
    node_color: Optional[str] = Field(default=None, max_length=32)
    display_order: Optional[int] = None
    account_links: Optional[list[VentureAccountLinkRequest]] = None

    @model_validator(mode="before")
    @classmethod
    def validate_non_nullable_updates(cls, data: Any) -> Any:
        return _reject_explicit_nulls(
            data,
            {
                "account_links",
                "company_type",
                "display_order",
                "name",
                "role",
                "status",
                "valuation_mode",
            },
        )


class VentureCompanyRead(BaseModel):
    """Company metadata."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    legal_name: Optional[str] = None
    description: Optional[str] = None
    company_type: str
    status: str
    role: str
    valuation_mode: str
    industry: Optional[str] = None
    stage: Optional[str] = None
    country: Optional[str] = None
    founded_on: Optional[date] = None
    joined_on: Optional[date] = None
    exited_on: Optional[date] = None
    closed_on: Optional[date] = None
    logo_storage_key: Optional[str] = None
    logo_file_name: Optional[str] = None
    logo_content_type: Optional[str] = None
    node_color: Optional[str] = None
    display_order: int = 0
    created_at: datetime
    updated_at: datetime


class VentureTimelineEventRead(BaseModel):
    """Timeline feed entry."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    event_date: date
    event_type: str
    title: str
    description: Optional[str] = None
    valuation_event_id: Optional[UUID] = None
    ownership_event_id: Optional[UUID] = None
    note_id: Optional[UUID] = None
    document_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class VentureNoteCreateRequest(BaseModel):
    """Create a Markdown note."""

    title: str = Field(min_length=1, max_length=180)
    body_markdown: str = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)
    pinned: bool = False
    note_date: date
    timeline_event_id: Optional[UUID] = None
    document_ids: list[UUID] = Field(default_factory=list)


class VentureNoteUpdateRequest(BaseModel):
    """Patch a Markdown note."""

    title: Optional[str] = Field(default=None, min_length=1, max_length=180)
    body_markdown: Optional[str] = Field(default=None, min_length=1)
    tags: Optional[list[str]] = None
    pinned: Optional[bool] = None
    note_date: Optional[date] = None
    timeline_event_id: Optional[UUID] = None
    document_ids: Optional[list[UUID]] = None

    @model_validator(mode="before")
    @classmethod
    def validate_non_nullable_updates(cls, data: Any) -> Any:
        return _reject_explicit_nulls(
            data,
            {"body_markdown", "document_ids", "note_date", "pinned", "tags", "title"},
        )


class VentureNoteRead(BaseModel):
    """Read model for a Markdown note."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    title: str
    body_markdown: str
    tags: list[str]
    pinned: bool
    note_date: date
    timeline_event_id: Optional[UUID] = None
    document_ids: list[UUID]
    created_at: datetime
    updated_at: datetime


class VentureDocumentCreateRequest(BaseModel):
    """Create S3-backed document metadata."""

    title: str = Field(min_length=1, max_length=180)
    document_type: str = Field(min_length=1, max_length=80)
    category: str = Field(min_length=1, max_length=80)
    status: VentureDocumentStatus = "pending_review"
    storage_key: Optional[str] = Field(default=None, max_length=512)
    external_url: Optional[str] = Field(default=None, max_length=1024)
    file_name: Optional[str] = Field(default=None, max_length=255)
    mime_type: Optional[str] = Field(default=None, max_length=160)
    file_size_bytes: Optional[int] = Field(default=None, ge=0)
    document_date: Optional[date] = None
    valuation_event_id: Optional[UUID] = None
    ownership_event_id: Optional[UUID] = None
    timeline_event_id: Optional[UUID] = None


class VentureDocumentRead(VentureDocumentCreateRequest):
    """Read model for document metadata."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    company_id: UUID
    uploaded_at: datetime
    created_at: datetime
    updated_at: datetime


class VentureDocumentHealthWarning(BaseModel):
    """Non-blocking document or evidence warning."""

    code: str
    message: str
    severity: Literal["info", "warning"] = "warning"
    category: Optional[str] = None


class VentureDocumentHealthResponse(BaseModel):
    """Document health summary."""

    warnings: list[VentureDocumentHealthWarning] = Field(default_factory=list)
    missing_categories: list[str] = Field(default_factory=list)


class VentureGraphLayoutNode(BaseModel):
    """Persisted node position."""

    company_id: UUID
    x: Decimal
    y: Decimal
    pinned: bool = False


class VentureGraphViewport(BaseModel):
    """XY Flow viewport state."""

    x: Decimal
    y: Decimal
    zoom: Decimal


class VentureGraphLayoutUpdateRequest(BaseModel):
    """Patch graph layout positions and viewport."""

    layout_key: str = "default"
    nodes: list[VentureGraphLayoutNode] = Field(default_factory=list)
    viewport: Optional[VentureGraphViewport] = None


class VentureGraphLayoutRead(BaseModel):
    """Graph layout response."""

    layout_key: str = "default"
    nodes: list[VentureGraphLayoutNode] = Field(default_factory=list)
    viewport: Optional[VentureGraphViewport] = None


class VentureCompanySummaryRead(BaseModel):
    """Company summary for graph/detail payloads."""

    company: VentureCompanyRead
    latest_valuation: Optional[VentureValuationRead] = None
    latest_ownership: Optional[VentureOwnershipRead] = None
    account_links: list[VentureAccountLinkRead] = Field(default_factory=list)
    paper_value_sek: Decimal = Decimal("0")
    risk_adjusted_value_sek: Decimal = Decimal("0")
    realized_value_sek: Decimal = Decimal("0")
    ownership_pct: Optional[Decimal] = None
    last_activity_at: Optional[datetime] = None


class VentureGraphEdgeRead(BaseModel):
    """Ownership edge for the graph."""

    company_id: UUID
    owner_type: str
    owner_company_id: Optional[UUID] = None
    ownership_pct: Decimal
    fully_diluted_ownership_pct: Optional[Decimal] = None


class VentureOverviewKpis(BaseModel):
    """Top-level Ventures KPIs."""

    total_paper_value_sek: Decimal
    total_risk_adjusted_value_sek: Decimal
    total_realized_value_sek: Decimal
    illiquid_paper_value_sek: Decimal
    company_count: int
    status_counts: dict[str, int]


class VentureOverviewResponse(BaseModel):
    """Graph overview payload for /ventures."""

    kpis: VentureOverviewKpis
    companies: list[VentureCompanySummaryRead]
    ownership_edges: list[VentureGraphEdgeRead]
    layout: VentureGraphLayoutRead
    recent_activity: list[VentureTimelineEventRead] = Field(default_factory=list)


class VentureCompanyDetailResponse(BaseModel):
    """Company workspace payload."""

    summary: VentureCompanySummaryRead
    valuations: list[VentureValuationRead]
    ownership_events: list[VentureOwnershipRead]
    timeline: list[VentureTimelineEventRead]
    notes: list[VentureNoteRead]
    documents: list[VentureDocumentRead]
    document_health: VentureDocumentHealthResponse


class VentureNoteListResponse(BaseModel):
    """List notes response."""

    notes: list[VentureNoteRead]


class VentureDocumentListResponse(BaseModel):
    """List documents response."""

    documents: list[VentureDocumentRead]
    document_health: VentureDocumentHealthResponse


class VentureDeleteResponse(BaseModel):
    """Soft-delete response."""

    id: UUID
    deleted: bool = True


class VenturePresignRequest(BaseModel):
    """Request a presigned S3 upload or download URL."""

    operation: VenturePresignOperation
    purpose: VentureUploadPurpose = "document"
    company_id: Optional[UUID] = None
    document_id: Optional[UUID] = None
    storage_key: Optional[str] = None
    file_name: Optional[str] = None
    mime_type: Optional[str] = None
    file_size_bytes: Optional[int] = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_operation_fields(self) -> "VenturePresignRequest":
        if self.operation == "upload":
            missing = [
                name
                for name, value in (
                    ("file_name", self.file_name),
                    ("mime_type", self.mime_type),
                    ("file_size_bytes", self.file_size_bytes),
                )
                if value is None
            ]
            if self.purpose != "logo" and self.company_id is None:
                missing.append("company_id")
            if missing:
                raise ValueError(f"Missing upload fields: {', '.join(missing)}")
        if self.operation == "download" and self.document_id is None and self.storage_key is None:
            raise ValueError("document_id or storage_key is required for downloads")
        return self


class VenturePresignResponse(BaseModel):
    """Presigned URL response."""

    url: str
    method: Literal["PUT", "GET"]
    storage_key: str
    headers: dict[str, str] = Field(default_factory=dict)
    expires_in_seconds: int


__all__ = [
    "VentureAccountLinkRequest",
    "VentureAccountLinkRead",
    "VentureValuationCreateRequest",
    "VentureValuationRead",
    "VentureOwnershipCreateRequest",
    "VentureOwnershipRead",
    "VentureCompanyCreateRequest",
    "VentureCompanyUpdateRequest",
    "VentureCompanyRead",
    "VentureTimelineEventRead",
    "VentureNoteCreateRequest",
    "VentureNoteUpdateRequest",
    "VentureNoteRead",
    "VentureDocumentCreateRequest",
    "VentureDocumentRead",
    "VentureDocumentHealthWarning",
    "VentureDocumentHealthResponse",
    "VentureGraphLayoutNode",
    "VentureGraphViewport",
    "VentureGraphLayoutUpdateRequest",
    "VentureGraphLayoutRead",
    "VentureCompanySummaryRead",
    "VentureGraphEdgeRead",
    "VentureOverviewKpis",
    "VentureOverviewResponse",
    "VentureCompanyDetailResponse",
    "VentureNoteListResponse",
    "VentureDocumentListResponse",
    "VentureDeleteResponse",
    "VenturePresignRequest",
    "VenturePresignResponse",
]
