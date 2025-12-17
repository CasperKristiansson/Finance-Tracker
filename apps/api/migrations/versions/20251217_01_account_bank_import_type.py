"""Add accounts.bank_import_type.

Revision ID: account_bank_import_type_20251217
Revises: drop_transaction_status_20251214
Create Date: 2025-12-17
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "account_bank_import_type_20251217"
down_revision = "drop_transaction_status_20251214"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("bank_import_type", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("accounts", "bank_import_type")
