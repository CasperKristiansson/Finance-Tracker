"""Add account.name column and backfill known accounts.

Revision ID: add_account_name
Revises: 43c0c42e7b0d
Create Date: 2024-12-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "add_account_name"
down_revision = "43c0c42e7b0d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("name", sa.String(length=120), nullable=False, server_default=""),
    )

    # Backfill names based on display_order used in imports/seed data.
    conn = op.get_bind()
    updates = [
        (10, "Swedbank"),
        (20, "Nordnet Private"),
        (30, "Nordnet Company"),
        (40, "SEB Company"),
        (50, "Danske Bank"),
        (60, "Circle K Mastercard"),
        (70, "Cash"),
        (800, "CSN Loan"),
        (900, "Swedbank Savings"),
        (910, "Paypal"),
        (920, "Gift Card"),
        (9999, "Offset"),
    ]
    for display_order, name in updates:
        conn.execute(
            sa.text(
                "UPDATE accounts SET name = :name WHERE display_order = :display_order AND (name = '' OR name IS NULL)"
            ),
            {"name": name, "display_order": display_order},
        )


def downgrade() -> None:
    op.drop_column("accounts", "name")
