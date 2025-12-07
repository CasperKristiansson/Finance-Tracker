"""add user scoping columns and constraints

Revision ID: 0f5ae1cf7a3f
Revises: 43c0c42e7b0d
Create Date: 2025-03-05 00:00:00.000000
"""

from __future__ import annotations

import os

import sqlalchemy as sa
from alembic import op

revision = "0f5ae1cf7a3f"
down_revision = "c75e94af3ebf"
branch_labels = None
depends_on = None


_INTEGRATION_USER_ID = os.getenv("INTEGRATION_USER_ID", "integration-user")


def _add_user_column(table: str) -> None:
    op.add_column(
        table,
        sa.Column(
            "user_id", sa.String(length=64), nullable=False, server_default=_INTEGRATION_USER_ID
        ),
    )
    op.create_index(f"ix_{table}_user_id", table, ["user_id"], unique=False)
    op.alter_column(table, "user_id", server_default=None)


def upgrade() -> None:
    # Add user columns
    for table in (
        "accounts",
        "balance_snapshots",
        "loans",
        "loan_rate_changes",
        "categories",
        "transaction_import_batches",
        "import_files",
        "import_errors",
        "import_rows",
        "import_rules",
        "budgets",
        "subscriptions",
        "goals",
        "transactions",
        "transaction_legs",
        "loan_events",
        "investment_snapshots",
        "investment_holdings",
        "investment_transactions",
    ):
        _add_user_column(table)

    # Categories: scope name uniqueness to user
    op.drop_constraint("categories_name_key", "categories", type_="unique")
    op.create_unique_constraint(
        "uq_category_user_name",
        "categories",
        ["user_id", "name"],
    )

    # Transactions: scope unique identifiers to user
    op.drop_constraint("uq_transaction_identity", "transactions", type_="unique")
    op.drop_constraint("transactions_external_id_key", "transactions", type_="unique")
    op.create_unique_constraint(
        "uq_transaction_external_id",
        "transactions",
        ["user_id", "external_id"],
    )
    op.create_unique_constraint(
        "uq_transaction_identity",
        "transactions",
        ["user_id", "occurred_at", "description", "external_id"],
    )

    # Import rules: scope matcher_text uniqueness
    op.drop_index("ix_import_rules_matcher_text", table_name="import_rules")
    op.create_unique_constraint(
        "uq_import_rule_user_matcher_text",
        "import_rules",
        ["user_id", "matcher_text"],
    )

    # Investment transactions: scope uniqueness
    op.drop_constraint("uq_investment_tx_identity", "investment_transactions", type_="unique")
    op.create_unique_constraint(
        "uq_investment_tx_identity",
        "investment_transactions",
        ["user_id", "occurred_at", "transaction_type", "description", "amount_sek", "quantity"],
    )


def downgrade() -> None:
    # Revert uniqueness changes
    op.drop_constraint("uq_investment_tx_identity", "investment_transactions", type_="unique")
    op.create_unique_constraint(
        "uq_investment_tx_identity",
        "investment_transactions",
        ["occurred_at", "transaction_type", "description", "amount_sek", "quantity"],
    )

    op.drop_constraint("uq_import_rule_user_matcher_text", "import_rules", type_="unique")
    op.create_index(
        "ix_import_rules_matcher_text",
        "import_rules",
        ["matcher_text"],
        unique=True,
    )

    op.drop_constraint("uq_transaction_identity", "transactions", type_="unique")
    op.drop_constraint("uq_transaction_external_id", "transactions", type_="unique")
    op.create_unique_constraint(
        "transactions_external_id_key",
        "transactions",
        ["external_id"],
    )
    op.create_unique_constraint(
        "uq_transaction_identity",
        "transactions",
        ["occurred_at", "description", "external_id"],
    )

    op.drop_constraint("uq_category_user_name", "categories", type_="unique")
    op.create_unique_constraint("categories_name_key", "categories", ["name"])

    # Drop user columns and indexes
    for table in (
        "investment_transactions",
        "investment_holdings",
        "investment_snapshots",
        "loan_events",
        "transaction_legs",
        "transactions",
        "goals",
        "subscriptions",
        "budgets",
        "import_rules",
        "import_rows",
        "import_errors",
        "import_files",
        "transaction_import_batches",
        "categories",
        "loan_rate_changes",
        "loans",
        "balance_snapshots",
        "accounts",
    ):
        op.drop_index(f"ix_{table}_user_id", table_name=table)
        op.drop_column(table, "user_id")
