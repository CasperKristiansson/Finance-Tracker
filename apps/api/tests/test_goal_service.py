from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, cast
from uuid import UUID, uuid4

import pytest
from sqlmodel import Session

from apps.api.models import Account, Category, Goal, Transaction, TransactionLeg
from apps.api.repositories.reporting import NetWorthPoint
from apps.api.services.goal import GoalService
from apps.api.shared import AccountType, CategoryType, TransactionType

# pylint: disable=protected-access


def _goal(**overrides) -> Goal:
    payload = {
        "name": "Goal",
        "target_amount": Decimal("100.00"),
        "target_date": date(2026, 12, 31),
    }
    payload.update(overrides)
    return Goal(**payload)


def _seed_single_leg_transaction(
    session: Session,
    *,
    account_id: UUID,
    amount: Decimal,
    category_id: UUID | None = None,
) -> None:
    tx = Transaction(
        transaction_type=TransactionType.EXPENSE,
        occurred_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        posted_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
        category_id=category_id,
    )
    session.add(tx)
    session.flush()
    session.add(TransactionLeg(transaction_id=tx.id, account_id=account_id, amount=amount))
    session.commit()


def test_list_create_update_delete_flow(session: Session) -> None:
    service = GoalService(session)

    created = service.create({"name": "Create", "target_amount": Decimal("250.00")})
    listed = service.list()
    assert any(goal.id == created.id for goal in listed)

    updated = service.update(created.id, {"name": "Updated", "note": None})
    assert updated.name == "Updated"

    service.delete(created.id)
    assert session.get(Goal, created.id) is None


def test_update_and_delete_raise_for_missing_goal(session: Session) -> None:
    service = GoalService(session)
    goal_id = uuid4()

    with pytest.raises(LookupError):
        service.update(goal_id, {"name": "x"})

    with pytest.raises(LookupError):
        service.delete(goal_id)


def test_progress_uses_account_balance(session: Session) -> None:
    account = Account(name="Main", account_type=AccountType.NORMAL, is_active=True)
    session.add(account)
    session.commit()
    _seed_single_leg_transaction(session, account_id=account.id, amount=Decimal("30.00"))

    service = GoalService(session)
    current, pct, achieved_at, achieved_delta_days = service.progress(
        _goal(account_id=account.id, target_amount=Decimal("120.00"))
    )

    assert current == Decimal("30.00")
    assert pct == 25.0
    assert achieved_at is None
    assert achieved_delta_days is None


def test_progress_uses_category_sum(session: Session) -> None:
    account = Account(name="Main", account_type=AccountType.NORMAL, is_active=True)
    category = Category(name="Food", category_type=CategoryType.EXPENSE)
    session.add(account)
    session.add(category)
    session.commit()
    _seed_single_leg_transaction(
        session,
        account_id=account.id,
        amount=Decimal("40.00"),
        category_id=category.id,
    )

    service = GoalService(session)
    current, pct, achieved_at, achieved_delta_days = service.progress(
        _goal(category_id=category.id, target_amount=Decimal("80.00"))
    )

    assert current == Decimal("40.00")
    assert pct == 50.0
    assert achieved_at is None
    assert achieved_delta_days is None


def test_progress_uses_net_worth_history_and_achieved_delta(session: Session) -> None:
    service = GoalService(session)
    history = [
        NetWorthPoint(period=date(2026, 1, 1), net_worth=Decimal("10.00")),
        NetWorthPoint(period=date(2026, 2, 1), net_worth=Decimal("200.00")),
    ]
    cast(Any, service).reporting_repository = type(
        "_Repo",
        (),
        {"get_net_worth_history": lambda _self: history},
    )()

    goal = _goal(target_amount=Decimal("150.00"), target_date=date(2026, 3, 1))
    current, pct, achieved_at, achieved_delta_days = service.progress(goal)

    assert current == Decimal("200.00")
    assert pct == pytest.approx((200.0 / 150.0) * 100.0)
    assert achieved_at == date(2026, 2, 1)
    assert achieved_delta_days == -28


def test_progress_handles_zero_target_amount(session: Session) -> None:
    account = Account(name="Main", account_type=AccountType.NORMAL, is_active=True)
    session.add(account)
    session.commit()

    service = GoalService(session)
    current, pct, _, _ = service.progress(_goal(account_id=account.id, target_amount=Decimal("0")))

    assert current == Decimal("0")
    assert pct == 0.0


def test_sum_for_category_uses_scalar_result(session: Session) -> None:
    account = Account(name="Main", account_type=AccountType.NORMAL, is_active=True)
    category = Category(name="Salary", category_type=CategoryType.INCOME)
    session.add(account)
    session.add(category)
    session.commit()
    _seed_single_leg_transaction(
        session,
        account_id=account.id,
        amount=Decimal("12.50"),
        category_id=category.id,
    )

    service = GoalService(session)
    result = service._sum_for_category(category.id)
    assert result == Decimal("12.50")


def test_net_worth_history_is_cached(session: Session) -> None:
    service = GoalService(session)
    calls = {"count": 0}
    expected = [NetWorthPoint(period=date(2026, 1, 1), net_worth=Decimal("1"))]

    class _Repo:
        def get_net_worth_history(self):
            calls["count"] += 1
            return expected

    cast(Any, service).reporting_repository = _Repo()
    assert service._get_net_worth_history() == expected
    assert service._get_net_worth_history() == expected
    assert calls["count"] == 1


def test_find_achieved_at_returns_none_when_unreached() -> None:
    history = [NetWorthPoint(period=date(2026, 1, 1), net_worth=Decimal("10"))]
    assert GoalService._find_achieved_at(history, Decimal("100")) is None
