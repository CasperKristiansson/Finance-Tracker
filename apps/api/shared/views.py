"""Utility helpers for creating reporting materialized views."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from sqlalchemy import text
from sqlalchemy.engine import Engine


@dataclass(frozen=True)
class MaterializedViewDefinition:
    """SQL definitions for a materialized view across dialects."""

    name: str
    postgres_sql: str
    sqlite_sql: str


_VIEW_DEFINITIONS = (
    MaterializedViewDefinition(
        name="vw_monthly_account_totals",
        postgres_sql="""
        CREATE MATERIALIZED VIEW IF NOT EXISTS vw_monthly_account_totals AS
        SELECT
            date_trunc('month', t.occurred_at) AS period,
            l.account_id,
            SUM(CASE WHEN l.amount > 0 THEN l.amount ELSE 0 END) AS income_total,
            SUM(CASE WHEN l.amount < 0 THEN -l.amount ELSE 0 END) AS expense_total,
            SUM(l.amount) AS net_total
        FROM transaction_legs AS l
        JOIN transactions AS t ON t.id = l.transaction_id
        GROUP BY period, l.account_id
        WITH DATA;
        """.strip(),
        sqlite_sql="""
        CREATE VIEW IF NOT EXISTS vw_monthly_account_totals AS
        SELECT
            date(t.occurred_at, 'start of month') AS period,
            l.account_id,
            SUM(CASE WHEN l.amount > 0 THEN l.amount ELSE 0 END) AS income_total,
            SUM(CASE WHEN l.amount < 0 THEN -l.amount ELSE 0 END) AS expense_total,
            SUM(l.amount) AS net_total
        FROM transaction_legs AS l
        JOIN transactions AS t ON t.id = l.transaction_id
        GROUP BY period, l.account_id;
        """.strip(),
    ),
    MaterializedViewDefinition(
        name="vw_category_yearly_totals",
        postgres_sql="""
        CREATE MATERIALIZED VIEW IF NOT EXISTS vw_category_yearly_totals AS
        SELECT
            date_part('year', t.occurred_at)::int AS year,
            t.category_id,
            SUM(CASE WHEN l.amount > 0 THEN l.amount ELSE 0 END) AS income_total,
            SUM(CASE WHEN l.amount < 0 THEN -l.amount ELSE 0 END) AS expense_total,
            SUM(l.amount) AS net_total
        FROM transaction_legs AS l
        JOIN transactions AS t ON t.id = l.transaction_id
        WHERE t.category_id IS NOT NULL
        GROUP BY year, t.category_id
        WITH DATA;
        """.strip(),
        sqlite_sql="""
        CREATE VIEW IF NOT EXISTS vw_category_yearly_totals AS
        SELECT
            CAST(strftime('%Y', t.occurred_at) AS INTEGER) AS year,
            t.category_id,
            SUM(CASE WHEN l.amount > 0 THEN l.amount ELSE 0 END) AS income_total,
            SUM(CASE WHEN l.amount < 0 THEN -l.amount ELSE 0 END) AS expense_total,
            SUM(l.amount) AS net_total
        FROM transaction_legs AS l
        JOIN transactions AS t ON t.id = l.transaction_id
        WHERE t.category_id IS NOT NULL
        GROUP BY year, t.category_id;
        """.strip(),
    ),
    MaterializedViewDefinition(
        name="vw_net_worth",
        postgres_sql="""
        CREATE MATERIALIZED VIEW IF NOT EXISTS vw_net_worth AS
        WITH account_balances AS (
            SELECT account_id, SUM(amount) AS balance
            FROM transaction_legs
            GROUP BY account_id
        )
        SELECT
            CURRENT_TIMESTAMP::date AS as_of,
            COALESCE(SUM(CASE WHEN lower(a.account_type) <> 'debt' THEN COALESCE(b.balance, 0) ELSE 0 END), 0) AS total_assets,
            COALESCE(SUM(CASE WHEN lower(a.account_type) = 'debt' THEN -COALESCE(b.balance, 0) ELSE 0 END), 0) AS total_liabilities,
            COALESCE(SUM(COALESCE(b.balance, 0)), 0) AS net_worth
        FROM accounts AS a
        LEFT JOIN account_balances AS b ON b.account_id = a.id
        WITH DATA;
        """.strip(),
        sqlite_sql="""
        CREATE VIEW IF NOT EXISTS vw_net_worth AS
        WITH account_balances AS (
            SELECT account_id, SUM(amount) AS balance
            FROM transaction_legs
            GROUP BY account_id
        )
        SELECT
            DATE('now') AS as_of,
            COALESCE(SUM(CASE WHEN lower(a.account_type) <> 'debt' THEN IFNULL(b.balance, 0) ELSE 0 END), 0) AS total_assets,
            COALESCE(SUM(CASE WHEN lower(a.account_type) = 'debt' THEN -IFNULL(b.balance, 0) ELSE 0 END), 0) AS total_liabilities,
            COALESCE(SUM(IFNULL(b.balance, 0)), 0) AS net_worth
        FROM accounts AS a
        LEFT JOIN account_balances AS b ON b.account_id = a.id;
        """.strip(),
    ),
)


def create_or_replace_materialized_views(
    engine: Engine,
    *,
    replace: bool = False,
    view_names: Iterable[str] | None = None,
) -> None:
    """Create materialized (or normal) views for supported dialects.

    In Postgres we emit ``CREATE MATERIALIZED VIEW`` statements. For other
    dialects (notably SQLite used in tests) we fall back to standard views so the
    definitions remain queryable.
    """

    dialect = engine.dialect.name
    definitions = {definition.name: definition for definition in _VIEW_DEFINITIONS}

    selected_names = list(view_names or definitions.keys())

    with engine.begin() as connection:
        for name in selected_names:
            definition = definitions.get(name)
            if definition is None:
                raise ValueError(f"Unknown view name: {name}")

            if dialect == "postgresql":
                if replace:
                    connection.execute(text(f"DROP MATERIALIZED VIEW IF EXISTS {name} CASCADE"))
                connection.execute(text(definition.postgres_sql))
            else:
                if replace:
                    connection.execute(text(f"DROP VIEW IF EXISTS {name}"))
                connection.execute(text(definition.sqlite_sql))


__all__ = ["create_or_replace_materialized_views"]
