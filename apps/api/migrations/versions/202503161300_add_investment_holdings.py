"""Add investment holdings table and index."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "202503161300"
down_revision = "202503161200"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investment_holdings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("account_name", sa.String(length=160), nullable=True),
        sa.Column("name", sa.String(length=240), nullable=False),
        sa.Column("isin", sa.String(length=48), nullable=True),
        sa.Column("holding_type", sa.String(length=32), nullable=True),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=True),
        sa.Column("price", sa.Numeric(18, 4), nullable=True),
        sa.Column("value_sek", sa.Numeric(18, 2), nullable=True),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["snapshot_id"], ["investment_snapshots.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "snapshot_id",
            "name",
            "currency",
            name="uq_investment_holding_snapshot_name_currency",
        ),
    )
    op.create_index(
        "ix_investment_holdings_snapshot_date",
        "investment_holdings",
        ["snapshot_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_investment_holdings_snapshot_date", table_name="investment_holdings")
    op.drop_table("investment_holdings")
