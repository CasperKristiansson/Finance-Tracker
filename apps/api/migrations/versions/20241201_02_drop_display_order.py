"""Drop account.display_order column.

Revision ID: drop_display_order
Revises: add_account_name
Create Date: 2024-12-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "drop_display_order"
down_revision = "add_account_name"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.drop_column("display_order")


def downgrade() -> None:
    with op.batch_alter_table("accounts") as batch_op:
        batch_op.add_column(sa.Column("display_order", sa.Integer(), nullable=True))
