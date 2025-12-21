"""Add import file storage metadata and transaction link.

Revision ID: import_file_storage_20251220
Revises: expand_alembic_version_20251218
Create Date: 2025-12-20
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "import_file_storage_20251220"
down_revision = "expand_alembic_version_20251218"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("import_files", sa.Column("object_key", sa.String(length=512), nullable=True))
    op.add_column("import_files", sa.Column("content_type", sa.String(length=160), nullable=True))
    op.add_column("import_files", sa.Column("size_bytes", sa.Integer(), nullable=True))
    op.alter_column("import_files", "account_id", existing_nullable=True)
    op.create_foreign_key(
        "fk_import_files_account_id_accounts",
        "import_files",
        "accounts",
        ["account_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "transactions",
        sa.Column(
            "import_file_id",
            sa.dialects.postgresql.UUID(as_uuid=True),
            sa.ForeignKey("import_files.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_constraint("fk_import_files_account_id_accounts", "import_files", type_="foreignkey")
    op.drop_column("transactions", "import_file_id")
    op.drop_column("import_files", "size_bytes")
    op.drop_column("import_files", "content_type")
    op.drop_column("import_files", "object_key")
