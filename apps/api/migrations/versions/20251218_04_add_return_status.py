"""Add return_status to transactions.

Revision ID: add_return_status_20251218
Revises: add_transaction_return_parent_20251218
Create Date: 2025-12-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "add_return_status_20251218"
down_revision = "add_transaction_return_parent_20251218"
branch_labels = None
depends_on = None


def upgrade() -> None:
    return_status = sa.Enum("pending", "processed", name="returnstatus")
    return_status.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "transactions",
        sa.Column(
            "return_status",
            return_status,
            nullable=True,
        ),
    )
    op.execute(
        "UPDATE transactions "
        "SET return_status = 'pending' "
        "WHERE return_parent_id IS NOT NULL AND transaction_type = 'return'"
    )


def downgrade() -> None:
    op.drop_column("transactions", "return_status")
    sa.Enum(name="returnstatus").drop(op.get_bind(), checkfirst=True)
