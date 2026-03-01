from __future__ import annotations

import json
from decimal import Decimal
from typing import Iterator
from uuid import uuid4

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from apps.api.handlers.goals import create_goal, delete_goal, list_goals, update_goal
from apps.api.handlers.utils import reset_engine_state
from apps.api.shared import configure_engine, get_engine


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_engine_state()
    configure_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    try:
        yield
    finally:
        SQLModel.metadata.drop_all(engine)
        reset_engine_state()


def _json_body(response: dict) -> dict:
    return json.loads(response["body"])


def _event_with_user(*, body: dict | None = None) -> dict:
    event: dict = {"requestContext": {"authorizer": {"jwt": {"claims": {"sub": "goal-user"}}}}}
    if body is not None:
        event["body"] = json.dumps(body)
        event["isBase64Encoded"] = False
    return event


def test_create_and_list_goals() -> None:
    create_response = create_goal(
        _event_with_user(body={"name": "Emergency fund", "target_amount": "1000.00"}),
        None,
    )
    assert create_response["statusCode"] == 201
    created = _json_body(create_response)
    assert created["name"] == "Emergency fund"
    assert Decimal(created["target_amount"]) == Decimal("1000.00")
    assert Decimal(created["current_amount"]) == Decimal("0")
    assert created["progress_pct"] == 0.0

    list_response = list_goals(_event_with_user(), None)
    assert list_response["statusCode"] == 200
    goals = _json_body(list_response)["goals"]
    assert len(goals) == 1
    assert goals[0]["id"] == created["id"]


def test_create_goal_validation_error() -> None:
    response = create_goal(
        _event_with_user(body={"name": "", "target_amount": "-10"}),
        None,
    )
    assert response["statusCode"] == 400
    assert "error" in _json_body(response)


def test_update_goal_validation_and_not_found() -> None:
    invalid = update_goal(
        {
            **_event_with_user(body={"target_amount": "-1"}),
            "pathParameters": {"goal_id": str(uuid4())},
        },
        None,
    )
    assert invalid["statusCode"] == 400

    missing = update_goal(
        {
            **_event_with_user(body={"name": "Updated"}),
            "pathParameters": {"goal_id": str(uuid4())},
        },
        None,
    )
    assert missing["statusCode"] == 404


def test_update_goal_missing_path_id() -> None:
    response = update_goal(_event_with_user(body={"name": "Updated"}), None)
    assert response["statusCode"] == 400
    assert _json_body(response)["error"] == "Goal ID missing from path"


def test_update_goal_success() -> None:
    created = _json_body(
        create_goal(_event_with_user(body={"name": "Trip", "target_amount": "500.00"}), None)
    )
    response = update_goal(
        {
            **_event_with_user(body={"target_amount": "900.00", "note": "Updated"}),
            "pathParameters": {"goal_id": created["id"]},
        },
        None,
    )
    assert response["statusCode"] == 200
    updated = _json_body(response)
    assert Decimal(updated["target_amount"]) == Decimal("900.00")
    assert updated["note"] == "Updated"


def test_delete_goal_missing_not_found_and_success() -> None:
    missing_id = delete_goal(_event_with_user(), None)
    assert missing_id["statusCode"] == 400

    not_found = delete_goal(
        {**_event_with_user(), "pathParameters": {"goal_id": str(uuid4())}},
        None,
    )
    assert not_found["statusCode"] == 404

    created = _json_body(
        create_goal(_event_with_user(body={"name": "Laptop", "target_amount": "1200.00"}), None)
    )
    deleted = delete_goal(
        {**_event_with_user(), "pathParameters": {"goal_id": created["id"]}},
        None,
    )
    assert deleted["statusCode"] == 204
