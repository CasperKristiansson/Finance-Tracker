"""Add tax_events table.

Revision ID: tax_events_20251213
Revises: account_icon
Create Date: 2025-12-13
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "tax_events_20251213"
down_revision = "account_icon"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tax_events",
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("transaction_id", sa.UUID(), nullable=False),
        sa.Column(
            "event_type",
            sa.Enum("PAYMENT", "REFUND", name="taxeventtype"),
            nullable=False,
        ),
        sa.Column("authority", sa.String(length=120), nullable=True),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "transaction_id", name="uq_tax_event_user_transaction"),
    )
    op.create_index("ix_tax_events_user_id", "tax_events", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_tax_events_user_id", table_name="tax_events")
    op.drop_table("tax_events")
    sa.Enum(name="taxeventtype").drop(op.get_bind(), checkfirst=True)

