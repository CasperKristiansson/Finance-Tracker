"""Add return_parent_id link on transactions.

Revision ID: add_transaction_return_parent_20251218
Revises: add_transaction_return_type_20251218
Create Date: 2025-12-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "add_transaction_return_parent_20251218"
down_revision = "add_transaction_return_type_20251218"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "transactions",
        sa.Column("return_parent_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_transactions_return_parent",
        source_table="transactions",
        referent_table="transactions",
        local_cols=["return_parent_id"],
        remote_cols=["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_transactions_return_parent", "transactions", type_="foreignkey")
    op.drop_column("transactions", "return_parent_id")
