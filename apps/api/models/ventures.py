"""Venture company, valuation, ownership, note, and document models."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Optional
from uuid import UUID

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlmodel import Field, SQLModel

from ..shared import TimestampMixin, UserOwnedMixin, UUIDPrimaryKeyMixin


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class VentureCompany(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Company tracked inside the Ventures feature."""

    __tablename__ = "venture_companies"

    name: str = Field(sa_column=Column(String(180), nullable=False))
    legal_name: Optional[str] = Field(default=None, sa_column=Column(String(240)))
    description: Optional[str] = Field(default=None, sa_column=Column(Text()))
    company_type: str = Field(
        default="startup",
        sa_column=Column(String(40), nullable=False, server_default="startup"),
    )
    status: str = Field(
        default="idea",
        sa_column=Column(String(32), nullable=False, server_default="idea"),
    )
    role: str = Field(
        default="founder",
        sa_column=Column(String(40), nullable=False, server_default="founder"),
    )
    valuation_mode: str = Field(
        default="manual",
        sa_column=Column(String(40), nullable=False, server_default="manual"),
    )
    industry: Optional[str] = Field(default=None, sa_column=Column(String(120)))
    stage: Optional[str] = Field(default=None, sa_column=Column(String(80)))
    country: Optional[str] = Field(default=None, sa_column=Column(String(80)))
    founded_on: Optional[date] = Field(default=None, sa_column=Column(Date()))
    joined_on: Optional[date] = Field(default=None, sa_column=Column(Date()))
    exited_on: Optional[date] = Field(default=None, sa_column=Column(Date()))
    closed_on: Optional[date] = Field(default=None, sa_column=Column(Date()))
    logo_storage_key: Optional[str] = Field(default=None, sa_column=Column(String(512)))
    logo_file_name: Optional[str] = Field(default=None, sa_column=Column(String(255)))
    logo_content_type: Optional[str] = Field(default=None, sa_column=Column(String(120)))
    node_color: Optional[str] = Field(default=None, sa_column=Column(String(32)))
    display_order: int = Field(
        default=0,
        sa_column=Column(Integer, nullable=False, server_default="0"),
    )
    deleted_at: Optional[datetime] = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )


class VentureValuationEvent(
    UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True
):
    """Point-in-time venture valuation or realized proceeds event."""

    __tablename__ = "venture_valuation_events"

    company_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_companies.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    event_date: date = Field(sa_column=Column(Date(), nullable=False))
    label: str = Field(sa_column=Column(String(160), nullable=False))
    event_type: str = Field(
        default="valuation",
        sa_column=Column(String(40), nullable=False, server_default="valuation"),
    )
    paper_value_sek: Decimal = Field(sa_column=Column(Numeric(18, 2), nullable=False))
    haircut_percentage: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric(5, 2), nullable=False, server_default="0"),
    )
    realized_value_sek: Decimal = Field(
        default=Decimal("0"),
        sa_column=Column(Numeric(18, 2), nullable=False, server_default="0"),
    )
    valuation_source: str = Field(sa_column=Column(String(48), nullable=False))
    liquidity_level: str = Field(
        default="none",
        sa_column=Column(String(40), nullable=False, server_default="none"),
    )
    confidence_score: Optional[int] = Field(default=None, sa_column=Column(Integer))
    include_in_venture_totals: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default="true"),
    )
    note: Optional[str] = Field(default=None, sa_column=Column(Text()))
    linked_document_ids: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
    )


class VentureOwnershipEvent(
    UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True
):
    """Point-in-time ownership edge for a company."""

    __tablename__ = "venture_ownership_events"

    company_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_companies.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    owner_type: str = Field(sa_column=Column(String(24), nullable=False))
    owner_company_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_companies.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    effective_date: date = Field(sa_column=Column(Date(), nullable=False))
    reason: Optional[str] = Field(default=None, sa_column=Column(String(160)))
    direct_ownership_pct: Decimal = Field(sa_column=Column(Numeric(7, 4), nullable=False))
    fully_diluted_ownership_pct: Optional[Decimal] = Field(
        default=None,
        sa_column=Column(Numeric(7, 4)),
    )
    shares_owned: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(20, 4)))
    total_shares: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(20, 4)))
    share_class: Optional[str] = Field(default=None, sa_column=Column(String(80)))
    voting_rights_pct: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(7, 4)))
    option_or_warrant_notes: Optional[str] = Field(default=None, sa_column=Column(Text()))
    invested_capital_sek: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(18, 2)))
    note: Optional[str] = Field(default=None, sa_column=Column(Text()))
    linked_document_ids: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
    )


class VentureTimelineEvent(
    UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True
):
    """Timeline feed entry for a venture company."""

    __tablename__ = "venture_timeline_events"

    company_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_companies.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    event_date: date = Field(sa_column=Column(Date(), nullable=False))
    event_type: str = Field(sa_column=Column(String(48), nullable=False))
    title: str = Field(sa_column=Column(String(180), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text()))
    valuation_event_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_valuation_events.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    ownership_event_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_ownership_events.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    note_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PGUUID(as_uuid=True), ForeignKey("venture_notes.id", ondelete="SET NULL")),
    )
    document_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PGUUID(as_uuid=True)),
    )


class VentureNote(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Markdown note with tags for a venture company."""

    __tablename__ = "venture_notes"

    company_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_companies.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    title: str = Field(sa_column=Column(String(180), nullable=False))
    body_markdown: str = Field(sa_column=Column(Text(), nullable=False))
    tags: list[str] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False, default=list)
    )
    pinned: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )
    note_date: date = Field(sa_column=Column(Date(), nullable=False))
    timeline_event_id: Optional[UUID] = Field(default=None, sa_column=Column(PGUUID(as_uuid=True)))
    document_ids: list[str] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
    )
    deleted_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))


class VentureDocument(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """S3-backed document metadata for a venture company."""

    __tablename__ = "venture_documents"

    company_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_companies.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    title: str = Field(sa_column=Column(String(180), nullable=False))
    document_type: str = Field(sa_column=Column(String(80), nullable=False))
    category: str = Field(sa_column=Column(String(80), nullable=False))
    status: str = Field(
        default="pending_review",
        sa_column=Column(String(40), nullable=False, server_default="pending_review"),
    )
    storage_key: Optional[str] = Field(default=None, sa_column=Column(String(512)))
    external_url: Optional[str] = Field(default=None, sa_column=Column(String(1024)))
    file_name: Optional[str] = Field(default=None, sa_column=Column(String(255)))
    mime_type: Optional[str] = Field(default=None, sa_column=Column(String(160)))
    file_size_bytes: Optional[int] = Field(default=None, sa_column=Column(Integer))
    document_date: Optional[date] = Field(default=None, sa_column=Column(Date()))
    uploaded_at: datetime = Field(
        default_factory=_utc_now, sa_column=Column(DateTime(timezone=True))
    )
    valuation_event_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_valuation_events.id", ondelete="SET NULL"),
        ),
    )
    ownership_event_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_ownership_events.id", ondelete="SET NULL"),
        ),
    )
    timeline_event_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_timeline_events.id", ondelete="SET NULL"),
        ),
    )
    deleted_at: Optional[datetime] = Field(default=None, sa_column=Column(DateTime(timezone=True)))


class VentureCompanyAccountLink(
    UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True
):
    """Selected Finance Tracker account included in account-synced venture value."""

    __tablename__ = "venture_company_account_links"

    company_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_companies.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    account_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("accounts.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    include_in_synced_value: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default="true"),
    )
    weight: Decimal = Field(
        default=Decimal("1"),
        sa_column=Column(Numeric(8, 4), nullable=False, server_default="1"),
    )

    __table_args__ = (UniqueConstraint("company_id", "account_id", name="uq_venture_account_link"),)


class VentureDocumentRequirement(
    UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True
):
    """Optional persisted document checklist requirement."""

    __tablename__ = "venture_document_requirements"

    company_type: Optional[str] = Field(default=None, sa_column=Column(String(40)))
    status: Optional[str] = Field(default=None, sa_column=Column(String(32)))
    category: str = Field(sa_column=Column(String(80), nullable=False))
    title: str = Field(sa_column=Column(String(180), nullable=False))
    description: Optional[str] = Field(default=None, sa_column=Column(Text()))
    is_required: bool = Field(
        default=True,
        sa_column=Column(Boolean, nullable=False, server_default="true"),
    )


class VentureGraphLayout(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Persisted graph node position and shared viewport payload."""

    __tablename__ = "venture_graph_layouts"

    layout_key: str = Field(
        default="default",
        sa_column=Column(String(80), nullable=False, server_default="default"),
    )
    company_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("venture_companies.id", ondelete="CASCADE"),
            nullable=True,
        ),
    )
    x: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(12, 4)))
    y: Optional[Decimal] = Field(default=None, sa_column=Column(Numeric(12, 4)))
    pinned: bool = Field(
        default=False,
        sa_column=Column(Boolean, nullable=False, server_default="false"),
    )
    viewport: Optional[dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    __table_args__ = (
        UniqueConstraint("user_id", "layout_key", "company_id", name="uq_venture_graph_layout"),
    )


__all__ = [
    "VentureCompany",
    "VentureValuationEvent",
    "VentureOwnershipEvent",
    "VentureTimelineEvent",
    "VentureNote",
    "VentureDocument",
    "VentureCompanyAccountLink",
    "VentureDocumentRequirement",
    "VentureGraphLayout",
]


VentureCompany.model_rebuild()
VentureValuationEvent.model_rebuild()
VentureOwnershipEvent.model_rebuild()
VentureTimelineEvent.model_rebuild()
VentureNote.model_rebuild()
VentureDocument.model_rebuild()
VentureCompanyAccountLink.model_rebuild()
VentureDocumentRequirement.model_rebuild()
VentureGraphLayout.model_rebuild()
