from __future__ import annotations

from types import SimpleNamespace
from typing import Iterator

import pytest
from sqlmodel import Session, create_engine

import apps.api.shared.session as session_module

# pylint: disable=protected-access


@pytest.fixture(autouse=True)
def reset_session_globals() -> Iterator[None]:
    session_module._engine = None
    session_module._USER_SCOPED_MODELS = None
    yield
    session_module._engine = None
    session_module._USER_SCOPED_MODELS = None


def test_get_engine_raises_when_unconfigured() -> None:
    with pytest.raises(RuntimeError, match="not configured"):
        session_module.get_engine()


def test_configure_engine_from_env(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = SimpleNamespace(sqlalchemy_url="sqlite://")
    captured: dict[str, object] = {}
    monkeypatch.setattr(
        session_module.DatabaseSettings,
        "from_env",
        classmethod(lambda cls: settings),
    )

    def fake_configure_engine(url: str, **kwargs) -> None:
        captured["url"] = url
        captured["kwargs"] = kwargs

    monkeypatch.setattr(session_module, "configure_engine", fake_configure_engine)
    returned = session_module.configure_engine_from_env(pool_pre_ping=True)

    assert returned is settings
    assert captured == {"url": "sqlite://", "kwargs": {"pool_pre_ping": True}}


def test_user_scoped_models_filters_and_caches(monkeypatch: pytest.MonkeyPatch) -> None:
    class NoUser:
        __tablename__ = "no_user"

    class NoTable:
        user_id = "yes"
        __tablename__ = None

    class BadInspect:
        user_id = "yes"
        __tablename__ = "bad"

    class Good:
        user_id = "yes"
        __tablename__ = "good"

    calls = {"iter": 0}

    def fake_iter():
        calls["iter"] += 1
        return [NoUser, NoTable, BadInspect, Good]

    def fake_inspect(model):
        if model is BadInspect:
            raise session_module.SQLAlchemyError("bad")
        return object()

    monkeypatch.setattr(session_module, "_iter_sqlmodel_models", fake_iter)
    monkeypatch.setattr(session_module, "sa_inspect", fake_inspect)

    assert session_module._user_scoped_models() == [Good]
    assert session_module._user_scoped_models() == [Good]
    assert calls["iter"] == 1


def test_scope_session_to_user_early_return_and_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = create_engine("sqlite://")
    with Session(engine) as session:
        session.info["user_id"] = "already"
        monkeypatch.setattr(
            session_module,
            "_user_scoped_models",
            lambda: (_ for _ in ()).throw(AssertionError("should not run")),
        )
        session_module.scope_session_to_user(session, "already")

    with Session(engine) as session:
        monkeypatch.setattr(session_module, "get_default_user_id", lambda: "fallback")
        monkeypatch.setattr(session_module, "_user_scoped_models", lambda: [])
        session_module.scope_session_to_user(session, None)
        assert session.info["user_id"] == "fallback"


def test_session_scope_commit_and_rollback(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeSession:
        def __init__(self) -> None:
            self.info: dict[str, object] = {}
            self.commits = 0
            self.rollbacks = 0
            self.closed = False

        def commit(self) -> None:
            self.commits += 1

        def rollback(self) -> None:
            self.rollbacks += 1

        def close(self) -> None:
            self.closed = True

    committed = FakeSession()
    monkeypatch.setattr(session_module, "get_session", lambda: committed)
    monkeypatch.setattr(session_module, "scope_session_to_user", lambda session, user_id: None)
    with session_module.session_scope(user_id="u") as yielded:
        assert yielded is committed
    assert committed.commits == 1
    assert committed.rollbacks == 0
    assert committed.closed is True

    rolled_back = FakeSession()
    monkeypatch.setattr(session_module, "get_session", lambda: rolled_back)
    with pytest.raises(ValueError, match="boom"):
        with session_module.session_scope(user_id="u"):
            raise ValueError("boom")
    assert rolled_back.commits == 0
    assert rolled_back.rollbacks == 1
    assert rolled_back.closed is True


def test_init_db_uses_provided_metadata(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeMetadata:
        def __init__(self) -> None:
            self.called_with = None

        def create_all(self, engine) -> None:
            self.called_with = engine

    fake_engine = object()
    metadata = FakeMetadata()
    monkeypatch.setattr(session_module, "get_engine", lambda: fake_engine)

    session_module.init_db(metadata=metadata)  # type: ignore[arg-type]

    assert metadata.called_with is fake_engine


def test_iter_sqlmodel_models_deduplicates_seen_classes(monkeypatch: pytest.MonkeyPatch) -> None:
    class Dummy(session_module.SQLModel):
        pass

    monkeypatch.setattr(session_module.SQLModel, "__subclasses__", lambda: [Dummy, Dummy])
    models = list(session_module._iter_sqlmodel_models())
    assert models.count(Dummy) == 1
