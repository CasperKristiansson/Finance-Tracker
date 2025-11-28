"""Add investment snapshots table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "202503161200"
down_revision = "202502281740"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investment_snapshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("provider", sa.String(length=80), nullable=False),
        sa.Column("report_type", sa.String(length=80), nullable=True),
        sa.Column("account_name", sa.String(length=160), nullable=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("portfolio_value", sa.Numeric(18, 2), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=False),
        sa.Column("parsed_payload", sa.JSON(), nullable=False),
        sa.Column("cleaned_payload", sa.JSON(), nullable=True),
        sa.Column("bedrock_metadata", sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_investment_snapshots_snapshot_date",
        "investment_snapshots",
        ["snapshot_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_investment_snapshots_snapshot_date", table_name="investment_snapshots")
    op.drop_table("investment_snapshots")
