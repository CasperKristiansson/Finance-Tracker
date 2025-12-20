"""Add return transaction type.

Revision ID: add_transaction_return_type_20251218
Revises: expand_alembic_version_20251218
Create Date: 2025-12-18
"""

from __future__ import annotations

from alembic import op
from sqlalchemy.dialects import postgresql

revision = "add_transaction_return_type_20251218"
down_revision = "expand_alembic_version_20251218"
branch_labels = None
depends_on = None

_old_transaction_types = (
    "income",
    "expense",
    "transfer",
    "adjustment",
    "investment_event",
)


def upgrade() -> None:
    op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'return'")


def downgrade() -> None:
    bind = op.get_bind()

    op.execute("ALTER TYPE transactiontype RENAME TO transactiontype_old")
    transactiontype = postgresql.ENUM(*_old_transaction_types, name="transactiontype")
    transactiontype.create(bind, checkfirst=False)

    op.execute(
        "UPDATE transactions SET transaction_type = 'transfer' WHERE transaction_type = 'return'"
    )
    op.execute(
        "ALTER TABLE transactions ALTER COLUMN transaction_type TYPE transactiontype "
        "USING transaction_type::text::transactiontype"
    )

    transactiontype_old = postgresql.ENUM(
        *_old_transaction_types, "return", name="transactiontype_old"
    )
    transactiontype_old.drop(bind, checkfirst=False)
