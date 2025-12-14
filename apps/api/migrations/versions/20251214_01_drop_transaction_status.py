"""Drop transactions.status and transactionstatus enum.

Revision ID: drop_transaction_status_20251214
Revises: tax_events_20251213
Create Date: 2025-12-14
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "drop_transaction_status_20251214"
down_revision = "tax_events_20251213"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.drop_column("status")

    sa.Enum(name="transactionstatus").drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    op.execute(
        "CREATE TYPE transactionstatus AS ENUM ('RECORDED', 'IMPORTED', 'REVIEWED', 'FLAGGED')"
    )
    with op.batch_alter_table("transactions") as batch_op:
        batch_op.add_column(
            sa.Column(
                "status",
                sa.Enum(
                    "RECORDED",
                    "IMPORTED",
                    "REVIEWED",
                    "FLAGGED",
                    name="transactionstatus",
                ),
                nullable=False,
                server_default="RECORDED",
            )
        )
