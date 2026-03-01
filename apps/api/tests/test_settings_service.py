from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import Mock

from apps.api.services.settings import SettingsService


def test_settings_service_creates_defaults_and_updates_existing() -> None:
    session = Mock()
    service = SettingsService(session)
    created = SimpleNamespace(first_name=None, last_name=None)
    existing = SimpleNamespace(first_name="Ada", last_name="Lovelace")
    updated = SimpleNamespace(first_name="Grace", last_name="Hopper")

    service.repository = Mock()
    service.repository.get_for_user.side_effect = [None, existing]
    service.repository.create.return_value = created
    service.repository.update_profile.return_value = updated

    assert service.get_settings("user-1") is created
    result = service.update_profile(user_id="user-1", first_name="Grace", last_name="Hopper")
    assert result is updated


def test_settings_service_update_profile_creates_when_missing() -> None:
    service = SettingsService(Mock())
    created = SimpleNamespace(first_name="Ada", last_name=None)
    service.repository = Mock()
    service.repository.get_for_user.return_value = None
    service.repository.create.return_value = created

    result = service.update_profile(user_id="user-1", first_name="Ada", last_name=None)
    assert result is created
