"""Add account.icon and backfill known banks.

Revision ID: account_icon
Revises: merge_20241201
Create Date: 2024-12-02
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "account_icon"
down_revision = "merge_20241201"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("icon", sa.String(length=255), nullable=True))
    conn = op.get_bind()
    mapping = {
        "Swedbank": "banks/swedbank.png",
        "Swedbank Savings": "banks/swedbank.png",
        "Nordnet Private": "banks/nordnet.jpg",
        "Nordnet Company": "banks/nordnet.jpg",
        "SEB Company": "banks/seb.png",
        "Danske Bank": "banks/danskebank.png",
        "Circle K Mastercard": "banks/circlek.png",
    }
    for name, icon in mapping.items():
        conn.execute(
            sa.text("UPDATE accounts SET icon = :icon WHERE name = :name AND icon IS NULL"),
            {"icon": icon, "name": name},
        )


def downgrade() -> None:
    op.drop_column("accounts", "icon")
