"""Add category icon column and budgets table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "202502281740"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("categories", sa.Column("icon", sa.String(length=16), nullable=True))

    budget_period_enum = sa.Enum(
        "monthly",
        "quarterly",
        "yearly",
        name="budgetperiod",
    )
    budget_period_enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "budgets",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("period", budget_period_enum, nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_id", "period", name="uq_budget_category_period"),
    )


def downgrade() -> None:
    op.drop_table("budgets")

    budget_period_enum = sa.Enum(
        "monthly",
        "quarterly",
        "yearly",
        name="budgetperiod",
    )
    budget_period_enum.drop(op.get_bind(), checkfirst=True)

    op.drop_column("categories", "icon")
