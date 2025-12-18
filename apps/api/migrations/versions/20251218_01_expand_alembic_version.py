"""Expand alembic_version.version_num length.

Revision ID: expand_alembic_version_20251218
Revises: drop_transaction_status_20251214
Create Date: 2025-12-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "expand_alembic_version_20251218"
down_revision = "drop_transaction_status_20251214"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(length=32),
        type_=sa.String(length=128),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(length=128),
        type_=sa.String(length=32),
        existing_nullable=False,
    )
