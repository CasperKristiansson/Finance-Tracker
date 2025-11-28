"""add import rules and rule metadata on rows

Revision ID: 43c0c42e7b0d
Revises: e975ac53d694
Create Date: 2025-02-15 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "43c0c42e7b0d"
down_revision = "e975ac53d694"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "import_rules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("matcher_text", sa.String(length=255), nullable=False),
        sa.Column("matcher_amount", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("amount_tolerance", sa.Numeric(precision=18, scale=2), nullable=True),
        sa.Column("matcher_day_of_month", sa.Integer(), nullable=True),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("subscription_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("hit_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_hit_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_import_rules_matcher_text", "import_rules", ["matcher_text"], unique=True
    )

    op.add_column(
        "import_rows",
        sa.Column(
            "rule_applied",
            sa.Boolean(),
            server_default="false",
            nullable=False,
        ),
    )
    op.add_column(
        "import_rows", sa.Column("rule_type", sa.String(length=40), nullable=True)
    )
    op.add_column(
        "import_rows", sa.Column("rule_summary", sa.String(length=255), nullable=True)
    )
    op.add_column(
        "import_rows",
        sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_import_rows_rule_id", "import_rows", "import_rules", ["rule_id"], ["id"], ondelete="SET NULL"
    )
    op.alter_column("import_rows", "rule_applied", server_default=None)


def downgrade() -> None:
    op.drop_constraint("fk_import_rows_rule_id", "import_rows", type_="foreignkey")
    op.drop_column("import_rows", "rule_id")
    op.drop_column("import_rows", "rule_summary")
    op.drop_column("import_rows", "rule_type")
    op.drop_column("import_rows", "rule_applied")
    op.drop_index("ix_import_rules_matcher_text", table_name="import_rules")
    op.drop_table("import_rules")
