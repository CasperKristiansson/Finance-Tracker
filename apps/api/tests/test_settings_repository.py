from __future__ import annotations

from sqlmodel import Session

from apps.api.models import UserSettings
from apps.api.repositories.settings import SettingsRepository
from apps.api.shared import ThemePreference, get_default_user_id


def test_settings_repository_create_get_and_update(session: Session) -> None:
    repository = SettingsRepository(session)
    user_id = get_default_user_id()
    assert repository.get_for_user(user_id) is None

    created = repository.create(
        UserSettings(user_id=user_id, theme=ThemePreference.SYSTEM, first_name="Ada")
    )
    assert created.id is not None

    fetched = repository.get_for_user(user_id)
    assert fetched is not None
    assert fetched.first_name == "Ada"

    updated = repository.update_profile(
        fetched,
        first_name="Grace",
        last_name="Hopper",
    )
    assert updated.first_name == "Grace"
    assert updated.last_name == "Hopper"
