from __future__ import annotations

import pytest
from sqlmodel import Session

from apps.api.models import Category
from apps.api.repositories.category import CategoryRepository
from apps.api.services.category import CategoryService
from apps.api.shared import CategoryType

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
