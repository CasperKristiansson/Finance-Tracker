"""Add subscription suggestion columns to import rows."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "202503201130"
down_revision = "202503201100"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "import_rows",
        sa.Column("suggested_subscription_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "import_rows",
        sa.Column("suggested_subscription_name", sa.String(length=160), nullable=True),
    )
    op.add_column(
        "import_rows",
        sa.Column("suggested_subscription_confidence", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "import_rows",
        sa.Column("suggested_subscription_reason", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("import_rows", "suggested_subscription_reason")
    op.drop_column("import_rows", "suggested_subscription_confidence")
    op.drop_column("import_rows", "suggested_subscription_name")
    op.drop_column("import_rows", "suggested_subscription_id")
