"""Add investment transactions table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "202503161345"
down_revision = "202503161300"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investment_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("snapshot_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("transaction_type", sa.String(length=32), nullable=False),
        sa.Column("description", sa.String(length=240), nullable=True),
        sa.Column("holding_name", sa.String(length=240), nullable=True),
        sa.Column("isin", sa.String(length=48), nullable=True),
        sa.Column("account_name", sa.String(length=160), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 4), nullable=True),
        sa.Column("amount_sek", sa.Numeric(18, 2), nullable=False),
        sa.Column("currency", sa.String(length=8), nullable=True),
        sa.Column("fee_sek", sa.Numeric(18, 2), nullable=True),
        sa.Column("notes", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(["snapshot_id"], ["investment_snapshots.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "occurred_at",
            "transaction_type",
            "description",
            "amount_sek",
            "quantity",
            name="uq_investment_tx_identity",
        ),
    )
    op.create_index(
        "ix_investment_transactions_occurred_at",
        "investment_transactions",
        ["occurred_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_investment_transactions_occurred_at",
        table_name="investment_transactions",
    )
    op.drop_table("investment_transactions")
