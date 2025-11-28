from __future__ import annotations

import sys
from pathlib import Path
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from apps.api.shared import get_default_user_id, scope_session_to_user

# pylint: disable=redefined-outer-name


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))


@pytest.fixture()
def session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        yield session

    SQLModel.metadata.drop_all(engine)
    engine.dispose()


def pytest_collection_modifyitems(config: pytest.Config, items: list[pytest.Item]) -> None:
    """Skip integration tests unless they are explicitly targeted."""
    integration_dir = Path(__file__).parent / "integration"
    explicit_targets = {Path(arg).resolve() for arg in config.invocation_params.args}
    run_integration = any(
        target == integration_dir or integration_dir in target.parents
        for target in explicit_targets
    )
    if run_integration:
        return

    skip_integration = pytest.mark.skip(
        reason="Integration tests run only when explicitly targeted."
    )
    for item in items:
        if integration_dir in Path(item.fspath).parents:
            item.add_marker(skip_integration)
