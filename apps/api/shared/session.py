# pyright: reportGeneralTypeIssues=false
"""Database engine and session helpers."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Generator, Iterable, Optional, Set

from sqlalchemy import event, inspect as sa_inspect
from sqlalchemy.engine import Engine
from sqlalchemy.orm import with_loader_criteria
from sqlmodel import Session, SQLModel, create_engine

from .auth import get_default_user_id
from .settings import DatabaseSettings

_engine: Optional[Engine] = None
_USER_SCOPED_MODELS: list[type[SQLModel]] | None = None


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


def _iter_sqlmodel_models() -> Iterable[type[SQLModel]]:
    """Yield all SQLModel subclasses discovered at runtime."""

    seen: Set[type[SQLModel]] = set()
    stack: list[type[SQLModel]] = list(SQLModel.__subclasses__())
    while stack:
        cls = stack.pop()
        if cls in seen:
            continue
        seen.add(cls)
        stack.extend(cls.__subclasses__())
        yield cls


def _user_scoped_models() -> list[type[SQLModel]]:
    """Return mapped models that carry a user_id field."""

    global _USER_SCOPED_MODELS
    if _USER_SCOPED_MODELS:
        return _USER_SCOPED_MODELS

    models: list[type[SQLModel]] = []
    for model in _iter_sqlmodel_models():
        if not hasattr(model, "user_id"):
            continue
        if not getattr(model, "__tablename__", None):
            continue
        try:
            sa_inspect(model)
        except Exception:
            continue
        models.append(model)

    _USER_SCOPED_MODELS = models or None
    return models


def scope_session_to_user(session: Session, user_id: Optional[str]) -> None:
    """Attach user-level filtering and defaults to the given session."""

    resolved_user = user_id or get_default_user_id()
    if session.info.get("user_id") == resolved_user:
        return

    models = _user_scoped_models()
    if models:
        options = [
            with_loader_criteria(model, lambda cls: cls.user_id == resolved_user, include_aliases=True)
            for model in models
        ]

        @event.listens_for(session, "do_orm_execute")
        def _add_user_filters(execute_state):  # type: ignore[unused-variable]
            if execute_state.is_select and not execute_state.execution_options.get(
                "include_all_users"
            ):
                execute_state.statement = execute_state.statement.options(*options)

        @event.listens_for(session, "before_flush")
        def _inject_user_id(sess, _flush_context, _instances):  # type: ignore[unused-variable]
            for obj in sess.new:
                if hasattr(obj, "user_id") and not getattr(obj, "user_id", None):
                    setattr(obj, "user_id", resolved_user)

    session.info["user_id"] = resolved_user


@contextmanager
def session_scope(*, user_id: Optional[str] = None) -> Generator[Session, None, None]:
    """Provide a transactional scope around a series of operations."""

    session = get_session()
    scope_session_to_user(session, user_id)
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
    "scope_session_to_user",
    "session_scope",
    "init_db",
]
