# pyright: reportGeneralTypeIssues=false
"""Database engine and session helpers."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator, Optional

from sqlmodel import Session, SQLModel, create_engine

_engine = None

from .settings import DatabaseSettings


def configure_engine(database_url: str, **engine_kwargs) -> None:
    """Configure the global SQLModel engine.

    Should be called once during application startup with the resolved
    connection string. Additional keyword arguments are forwarded to
    ``create_engine`` (e.g., pool sizing, echo flags).
    """

    global _engine
    _engine = create_engine(database_url, **engine_kwargs)


def configure_engine_from_env(**engine_kwargs) -> DatabaseSettings:
    """Load settings from environment variables and configure the engine."""

    settings = DatabaseSettings.from_env()
    configure_engine(settings.sqlalchemy_url, **engine_kwargs)
    return settings


def get_engine():
    """Return the configured engine, raising if missing."""

    if _engine is None:
        raise RuntimeError("Database engine is not configured")
    return _engine


def get_session() -> Session:
    """Create a new SQLModel session bound to the configured engine."""

    engine = get_engine()
    return Session(engine)


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    """Provide a transactional scope around a series of operations."""

    session = get_session()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db(metadata: Optional[SQLModel] = None) -> None:
    """Create database tables for the provided metadata.

    Intended for local development and testing. Production deployments
    should rely on Alembic migrations instead of direct table creation.
    """

    engine = get_engine()
    (metadata or SQLModel.metadata).create_all(engine)


__all__ = [
    "configure_engine",
    "configure_engine_from_env",
    "get_engine",
    "get_session",
    "session_scope",
    "init_db",
]
