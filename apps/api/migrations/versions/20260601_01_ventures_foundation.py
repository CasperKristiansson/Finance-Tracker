"""Add Ventures foundation tables.

Revision ID: ventures_foundation_20260601
Revises: remove_budget_subscription_20260301, account_bank_import_type_20251217
Create Date: 2026-06-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "ventures_foundation_20260601"
down_revision = ("remove_budget_subscription_20260301", "account_bank_import_type_20251217")
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    ]


def _owned_pk() -> list[sa.Column]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
    ]


def upgrade() -> None:
    op.create_table(
        "venture_companies",
        *_owned_pk(),
        *_timestamps(),
        sa.Column("name", sa.String(length=180), nullable=False),
        sa.Column("legal_name", sa.String(length=240), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("company_type", sa.String(length=40), server_default="startup", nullable=False),
        sa.Column("status", sa.String(length=32), server_default="idea", nullable=False),
        sa.Column("role", sa.String(length=40), server_default="founder", nullable=False),
        sa.Column("valuation_mode", sa.String(length=40), server_default="manual", nullable=False),
        sa.Column("industry", sa.String(length=120), nullable=True),
        sa.Column("stage", sa.String(length=80), nullable=True),
        sa.Column("country", sa.String(length=80), nullable=True),
        sa.Column("founded_on", sa.Date(), nullable=True),
        sa.Column("joined_on", sa.Date(), nullable=True),
        sa.Column("exited_on", sa.Date(), nullable=True),
        sa.Column("closed_on", sa.Date(), nullable=True),
        sa.Column("logo_storage_key", sa.String(length=512), nullable=True),
        sa.Column("logo_file_name", sa.String(length=255), nullable=True),
        sa.Column("logo_content_type", sa.String(length=120), nullable=True),
        sa.Column("node_color", sa.String(length=32), nullable=True),
        sa.Column("display_order", sa.Integer(), server_default="0", nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_venture_companies_user_id", "venture_companies", ["user_id"])

    op.create_table(
        "venture_valuation_events",
        *_owned_pk(),
        *_timestamps(),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("label", sa.String(length=160), nullable=False),
        sa.Column("event_type", sa.String(length=40), server_default="valuation", nullable=False),
        sa.Column("paper_value_sek", sa.Numeric(18, 2), nullable=False),
        sa.Column("haircut_percentage", sa.Numeric(5, 2), server_default="0", nullable=False),
        sa.Column("realized_value_sek", sa.Numeric(18, 2), server_default="0", nullable=False),
        sa.Column("valuation_source", sa.String(length=48), nullable=False),
        sa.Column("liquidity_level", sa.String(length=40), server_default="none", nullable=False),
        sa.Column("confidence_score", sa.Integer(), nullable=True),
        sa.Column("include_in_venture_totals", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "linked_document_ids",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["company_id"], ["venture_companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_venture_valuation_events_company_date",
        "venture_valuation_events",
        ["company_id", "event_date"],
    )
    op.create_index("ix_venture_valuation_events_user_id", "venture_valuation_events", ["user_id"])

    op.create_table(
        "venture_ownership_events",
        *_owned_pk(),
        *_timestamps(),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_type", sa.String(length=24), nullable=False),
        sa.Column("owner_company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("effective_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.String(length=160), nullable=True),
        sa.Column("direct_ownership_pct", sa.Numeric(7, 4), nullable=False),
        sa.Column("fully_diluted_ownership_pct", sa.Numeric(7, 4), nullable=True),
        sa.Column("shares_owned", sa.Numeric(20, 4), nullable=True),
        sa.Column("total_shares", sa.Numeric(20, 4), nullable=True),
        sa.Column("share_class", sa.String(length=80), nullable=True),
        sa.Column("voting_rights_pct", sa.Numeric(7, 4), nullable=True),
        sa.Column("option_or_warrant_notes", sa.Text(), nullable=True),
        sa.Column("invested_capital_sek", sa.Numeric(18, 2), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "linked_document_ids",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["company_id"], ["venture_companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["owner_company_id"], ["venture_companies.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_venture_ownership_events_company_date",
        "venture_ownership_events",
        ["company_id", "effective_date"],
    )
    op.create_index("ix_venture_ownership_events_user_id", "venture_ownership_events", ["user_id"])

    op.create_table(
        "venture_notes",
        *_owned_pk(),
        *_timestamps(),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("body_markdown", sa.Text(), nullable=False),
        sa.Column("tags", sa.JSON(), server_default=sa.text("'[]'::json"), nullable=False),
        sa.Column("pinned", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("note_date", sa.Date(), nullable=False),
        sa.Column("timeline_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("document_ids", sa.JSON(), server_default=sa.text("'[]'::json"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["venture_companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_venture_notes_company_date", "venture_notes", ["company_id", "note_date"])
    op.create_index("ix_venture_notes_user_id", "venture_notes", ["user_id"])

    op.create_table(
        "venture_timeline_events",
        *_owned_pk(),
        *_timestamps(),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("event_type", sa.String(length=48), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("valuation_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ownership_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("note_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["venture_companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["valuation_event_id"], ["venture_valuation_events.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["ownership_event_id"], ["venture_ownership_events.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(["note_id"], ["venture_notes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_venture_timeline_events_company_date",
        "venture_timeline_events",
        ["company_id", "event_date"],
    )
    op.create_index("ix_venture_timeline_events_user_id", "venture_timeline_events", ["user_id"])

    op.create_table(
        "venture_documents",
        *_owned_pk(),
        *_timestamps(),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("document_type", sa.String(length=80), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("status", sa.String(length=40), server_default="pending_review", nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=True),
        sa.Column("external_url", sa.String(length=1024), nullable=True),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("mime_type", sa.String(length=160), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("document_date", sa.Date(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valuation_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("ownership_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("timeline_event_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["venture_companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["valuation_event_id"], ["venture_valuation_events.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["ownership_event_id"], ["venture_ownership_events.id"], ondelete="SET NULL"
        ),
        sa.ForeignKeyConstraint(
            ["timeline_event_id"], ["venture_timeline_events.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_venture_documents_company_date",
        "venture_documents",
        ["company_id", "document_date"],
    )
    op.create_index("ix_venture_documents_user_id", "venture_documents", ["user_id"])
    op.create_table(
        "venture_company_account_links",
        *_owned_pk(),
        *_timestamps(),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("include_in_synced_value", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("weight", sa.Numeric(8, 4), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["venture_companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id", "account_id", name="uq_venture_account_link"),
    )
    op.create_index(
        "ix_venture_company_account_links_user_id",
        "venture_company_account_links",
        ["user_id"],
    )

    op.create_table(
        "venture_document_requirements",
        *_owned_pk(),
        *_timestamps(),
        sa.Column("company_type", sa.String(length=40), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=True),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_required", sa.Boolean(), server_default="true", nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_venture_document_requirements_user_id",
        "venture_document_requirements",
        ["user_id"],
    )

    op.create_table(
        "venture_graph_layouts",
        *_owned_pk(),
        *_timestamps(),
        sa.Column("layout_key", sa.String(length=80), server_default="default", nullable=False),
        sa.Column("company_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("x", sa.Numeric(12, 4), nullable=True),
        sa.Column("y", sa.Numeric(12, 4), nullable=True),
        sa.Column("pinned", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("viewport", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["venture_companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "layout_key", "company_id", name="uq_venture_graph_layout"),
    )
    op.create_index("ix_venture_graph_layouts_user_id", "venture_graph_layouts", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_venture_graph_layouts_user_id", table_name="venture_graph_layouts")
    op.drop_table("venture_graph_layouts")
    op.drop_index(
        "ix_venture_document_requirements_user_id",
        table_name="venture_document_requirements",
    )
    op.drop_table("venture_document_requirements")
    op.drop_index(
        "ix_venture_company_account_links_user_id",
        table_name="venture_company_account_links",
    )
    op.drop_table("venture_company_account_links")
    op.drop_index("ix_venture_documents_user_id", table_name="venture_documents")
    op.drop_index("ix_venture_documents_company_date", table_name="venture_documents")
    op.drop_table("venture_documents")
    op.drop_index("ix_venture_timeline_events_user_id", table_name="venture_timeline_events")
    op.drop_index("ix_venture_timeline_events_company_date", table_name="venture_timeline_events")
    op.drop_table("venture_timeline_events")
    op.drop_index("ix_venture_notes_user_id", table_name="venture_notes")
    op.drop_index("ix_venture_notes_company_date", table_name="venture_notes")
    op.drop_table("venture_notes")
    op.drop_index("ix_venture_ownership_events_user_id", table_name="venture_ownership_events")
    op.drop_index(
        "ix_venture_ownership_events_company_date",
        table_name="venture_ownership_events",
    )
    op.drop_table("venture_ownership_events")
    op.drop_index("ix_venture_valuation_events_user_id", table_name="venture_valuation_events")
    op.drop_index(
        "ix_venture_valuation_events_company_date",
        table_name="venture_valuation_events",
    )
    op.drop_table("venture_valuation_events")
    op.drop_index("ix_venture_companies_user_id", table_name="venture_companies")
    op.drop_table("venture_companies")
