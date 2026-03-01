"""Remove budgets and subscriptions domain.

Revision ID: remove_budget_subscription_20260301
Revises: import_file_storage_20251220
Create Date: 2026-03-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "remove_budget_subscription_20260301"
down_revision = "import_file_storage_20251220"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column("transactions", "subscription_id")
    op.drop_column("goals", "subscription_id")
    op.drop_column("import_rules", "subscription_id")
    op.drop_column("import_rows", "suggested_subscription_id")
    op.drop_column("import_rows", "suggested_subscription_name")
    op.drop_column("import_rows", "suggested_subscription_confidence")
    op.drop_column("import_rows", "suggested_subscription_reason")

    op.drop_table("subscriptions")
    op.drop_table("budgets")

    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.execute("DROP TYPE IF EXISTS budgetperiod")


def downgrade() -> None:
    bind = op.get_bind()
    budget_period_type: postgresql.ENUM | sa.Enum
    if bind.dialect.name == "postgresql":
        budget_period_type = postgresql.ENUM(
            "MONTHLY",
            "QUARTERLY",
            "YEARLY",
            name="budgetperiod",
            create_type=True,
        )
        budget_period_type.create(bind, checkfirst=True)
    else:
        budget_period_type = sa.Enum("MONTHLY", "QUARTERLY", "YEARLY", name="budgetperiod")

    op.create_table(
        "subscriptions",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("matcher_text", sa.String(length=255), nullable=False),
        sa.Column("matcher_amount_tolerance", sa.Numeric(18, 2), nullable=True),
        sa.Column("matcher_day_of_month", sa.Integer(), nullable=True),
        sa.Column("category_id", sa.Uuid(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"], unique=False)

    op.create_table(
        "budgets",
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=False),
        sa.Column("period", budget_period_type, nullable=False),
        sa.Column("amount", sa.Numeric(18, 2), nullable=False),
        sa.Column("note", sa.String(length=255), nullable=True),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("category_id", "period", name="uq_budget_category_period"),
    )
    op.create_index("ix_budgets_user_id", "budgets", ["user_id"], unique=False)

    op.add_column(
        "transactions",
        sa.Column(
            "subscription_id",
            sa.Uuid(),
            sa.ForeignKey("subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "goals",
        sa.Column(
            "subscription_id",
            sa.Uuid(),
            sa.ForeignKey("subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "import_rules",
        sa.Column(
            "subscription_id",
            sa.Uuid(),
            sa.ForeignKey("subscriptions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.add_column(
        "import_rows",
        sa.Column("suggested_subscription_id", sa.Uuid(), nullable=True),
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
