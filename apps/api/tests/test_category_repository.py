from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlmodel import Session

from apps.api.models import Account, Category, Transaction, TransactionLeg
from apps.api.repositories.category import CategoryRepository
from apps.api.services.category import CategoryService
from apps.api.shared import AccountType, CategoryType, TransactionType

# pylint: disable=redefined-outer-name,unused-argument


@pytest.fixture()
def repo(session: Session) -> CategoryRepository:
    return CategoryRepository(session)


def test_create_and_list_categories(repo: CategoryRepository, session: Session):
    category = Category(name="Groceries", category_type=CategoryType.EXPENSE)
    created = repo.create(category)

    assert created.id is not None
    assert created.name == "Groceries"

    categories = repo.list()
    assert len(categories) == 1
    assert categories[0].name == "Groceries"

    special = repo.create(Category(name="Loan", category_type=CategoryType.LOAN))
    assert special.id is not None
    with_special = repo.list(include_special=True)
    assert any(item.category_type == CategoryType.LOAN for item in with_special)


def test_prevent_duplicate_names(repo: CategoryRepository):
    repo.create(Category(name="Salary", category_type=CategoryType.INCOME))

    with pytest.raises(ValueError):
        repo.create(Category(name="Salary", category_type=CategoryType.INCOME))


def test_update_and_archive(repo: CategoryRepository):
    category = repo.create(Category(name="Investing", category_type=CategoryType.INCOME))

    updated = repo.update(category, name="Investments")
    assert updated.name == "Investments"

    archived = repo.archive(updated)
    assert archived.is_archived is True

    another = repo.create(Category(name="Savings", category_type=CategoryType.INCOME))
    with pytest.raises(ValueError):
        repo.update(another, name="Investments")


def test_category_service_flow(session: Session):
    service = CategoryService(session)

    created = service.create_category(
        Category(name="Utilities", category_type=CategoryType.EXPENSE)
    )
    fetched = service.get_category(created.id)
    assert fetched.name == "Utilities"

    service.update_category(created.id, name="Bills")
    updated = service.get_category(created.id)
    assert updated.name == "Bills"

    service.archive_category(created.id)
    archived = service.get_category(created.id)
    assert archived.is_archived is True

    active_categories = service.list_categories()
    assert not active_categories

    all_categories = service.list_categories(include_archived=True)
    assert len(all_categories) == 1


def test_category_repository_usage_and_monthly_totals(repo: CategoryRepository, session: Session):
    category = repo.create(Category(name="Food", category_type=CategoryType.EXPENSE))
    normal = Account(name="Wallet", account_type=AccountType.NORMAL)
    offset = Account(name="Offset", account_type=AccountType.NORMAL)
    session.add_all([normal, offset])
    session.flush()

    tx = Transaction(
        transaction_type=TransactionType.EXPENSE,
        category_id=category.id,
        occurred_at=datetime(2024, 1, 15, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 15, tzinfo=timezone.utc),
    )
    session.add(tx)
    session.flush()
    session.add_all(
        [
            TransactionLeg(transaction_id=tx.id, account_id=normal.id, amount=Decimal("-25")),
            TransactionLeg(transaction_id=tx.id, account_id=offset.id, amount=Decimal("25")),
        ]
    )
    session.commit()

    usage = repo.usage_by_category_ids([category.id])
    assert usage[category.id].transaction_count == 1
    assert usage[category.id].expense_total == Decimal("25")

    monthly = repo.monthly_totals_by_category_ids(
        [category.id],
        start=datetime(2024, 1, 1, tzinfo=timezone.utc),
        end=datetime(2024, 2, 1, tzinfo=timezone.utc),
    )
    assert monthly[category.id]
    assert (
        repo.monthly_totals_by_category_ids(
            [],
            start=datetime(2024, 1, 1, tzinfo=timezone.utc),
            end=datetime(2024, 2, 1, tzinfo=timezone.utc),
        )
        == {}
    )


def test_category_repository_non_sqlite_period_branch(monkeypatch, repo: CategoryRepository):
    category_id = repo.create(Category(name="Alt", category_type=CategoryType.EXPENSE)).id

    class _Rows:
        def all(self):
            return [(category_id, "2024-01-01", Decimal("0"), Decimal("10"))]

    class _IdRows:
        def all(self):
            return []

    bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))
    monkeypatch.setattr(repo.session, "get_bind", lambda: bind)

    def _exec(stmt):
        text = str(stmt)
        if "FROM accounts" in text:
            return _IdRows()
        return _Rows()

    monkeypatch.setattr(repo.session, "exec", _exec)
    out = repo.monthly_totals_by_category_ids(
        [category_id],
        start=datetime(2024, 1, 1, tzinfo=timezone.utc),
        end=datetime(2024, 2, 1, tzinfo=timezone.utc),
    )
    assert out[category_id]


def test_category_repository_usage_and_period_conversion_edges(
    monkeypatch, repo: CategoryRepository
):
    category_id = uuid4()

    class _UsageRows:
        def all(self):
            return [
                (None, 2, None, Decimal("1"), Decimal("2")),
                (category_id, 3, None, Decimal("4"), Decimal("5")),
            ]

    class _MonthlyRows:
        def all(self):
            return [
                (None, datetime(2024, 1, 1, tzinfo=timezone.utc), Decimal("0"), Decimal("0")),
                (
                    category_id,
                    datetime(2024, 1, 1, tzinfo=timezone.utc),
                    Decimal("1"),
                    Decimal("2"),
                ),
                (
                    category_id,
                    datetime(2024, 2, 1, tzinfo=timezone.utc).date(),
                    Decimal("3"),
                    Decimal("4"),
                ),
            ]

    class _NoExcluded:
        def all(self):
            return []

    bind = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))
    monkeypatch.setattr(repo.session, "get_bind", lambda: bind)

    calls = {"count": 0}

    def _exec(_stmt):
        calls["count"] += 1
        if calls["count"] == 1:
            return _NoExcluded()
        if calls["count"] == 2:
            return _UsageRows()
        if calls["count"] == 3:
            return _NoExcluded()
        return _MonthlyRows()

    monkeypatch.setattr(repo.session, "exec", _exec)

    usage = repo.usage_by_category_ids([category_id])
    assert usage[category_id].transaction_count == 3

    monthly = repo.monthly_totals_by_category_ids(
        [category_id],
        start=datetime(2024, 1, 1, tzinfo=timezone.utc),
        end=datetime(2024, 3, 1, tzinfo=timezone.utc),
    )
    assert category_id in monthly
    assert len(monthly[category_id]) == 2


def test_category_service_merge_and_recent_month_guards(session: Session):
    service = CategoryService(session)
    src = service.create_category(Category(name="Old Rent", category_type=CategoryType.EXPENSE))
    dst = service.create_category(Category(name="Rent", category_type=CategoryType.EXPENSE))
    service.create_category(Category(name="Existing", category_type=CategoryType.EXPENSE))
    income = service.create_category(Category(name="Salary", category_type=CategoryType.INCOME))

    with pytest.raises(ValueError, match="same type"):
        service.merge_categories(src.id, income.id)

    with pytest.raises(ValueError, match="already exists"):
        service.merge_categories(src.id, dst.id, rename_target_to="Existing")

    merged = service.merge_categories(src.id, dst.id, rename_target_to=dst.name)
    assert merged.name == "Rent"

    assert service.get_recent_category_months([dst.id], months=0) == {}
