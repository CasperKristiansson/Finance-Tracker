"""Replace import template_id with bank_type enum values."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "202603011200"
down_revision = "202511281029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "import_files",
        sa.Column("bank_type", sa.String(length=64), nullable=True),
    )
    op.execute("UPDATE import_files SET bank_type = COALESCE(template_id, 'circle_k_mastercard')")
    op.alter_column("import_files", "bank_type", nullable=False)
    op.drop_column("import_files", "template_id")


def downgrade() -> None:
    op.add_column(
        "import_files",
        sa.Column("template_id", sa.String(length=120), nullable=True),
    )
    op.execute("UPDATE import_files SET template_id = bank_type")
    op.drop_column("import_files", "bank_type")
