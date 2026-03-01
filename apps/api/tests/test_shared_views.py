from __future__ import annotations

from types import SimpleNamespace
from typing import Literal, cast

import pytest
from sqlalchemy.engine import Engine

from apps.api.shared.views import create_or_replace_materialized_views


class _FakeConnection:
    def __init__(self) -> None:
        self.statements: list[str] = []

    def execute(self, statement) -> None:
        self.statements.append(str(statement))


class _BeginContext:
    def __init__(self, connection: _FakeConnection) -> None:
        self.connection = connection

    def __enter__(self) -> _FakeConnection:
        return self.connection

    def __exit__(self, exc_type, exc, tb) -> Literal[False]:
        return False


class _FakeEngine:
    def __init__(self, dialect_name: str) -> None:
        self.dialect = SimpleNamespace(name=dialect_name)
        self.connection = _FakeConnection()

    def begin(self) -> _BeginContext:
        return _BeginContext(self.connection)


def test_create_or_replace_materialized_views_raises_for_unknown_view() -> None:
    engine = _FakeEngine("sqlite")
    with pytest.raises(ValueError, match="Unknown view name"):
        create_or_replace_materialized_views(
            engine=cast(Engine, engine),
            view_names=["does_not_exist"],
        )


def test_create_or_replace_materialized_views_for_postgres() -> None:
    engine = _FakeEngine("postgresql")
    create_or_replace_materialized_views(
        engine=cast(Engine, engine),
        replace=True,
        view_names=["vw_net_worth"],
    )
    sql = "\n".join(engine.connection.statements)
    assert "DROP MATERIALIZED VIEW IF EXISTS vw_net_worth CASCADE" in sql
    assert "CREATE MATERIALIZED VIEW IF NOT EXISTS vw_net_worth" in sql


def test_create_or_replace_materialized_views_for_postgres_without_replace() -> None:
    engine = _FakeEngine("postgresql")
    create_or_replace_materialized_views(
        engine=cast(Engine, engine),
        replace=False,
        view_names=["vw_net_worth"],
    )
    sql = "\n".join(engine.connection.statements)
    assert "DROP MATERIALIZED VIEW IF EXISTS" not in sql
    assert "CREATE MATERIALIZED VIEW IF NOT EXISTS vw_net_worth" in sql


def test_create_or_replace_materialized_views_for_sqlite_without_replace() -> None:
    engine = _FakeEngine("sqlite")
    create_or_replace_materialized_views(
        engine=cast(Engine, engine),
        replace=False,
        view_names=["vw_net_worth"],
    )
    sql = "\n".join(engine.connection.statements)
    assert "DROP VIEW IF EXISTS" not in sql
    assert "CREATE VIEW IF NOT EXISTS vw_net_worth" in sql
