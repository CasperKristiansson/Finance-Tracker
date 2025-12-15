"""Service layer for user settings."""

from __future__ import annotations

from sqlmodel import Session

from ..models import UserSettings
from ..repositories.settings import SettingsRepository
from ..shared import ThemePreference


class SettingsService:
    """Coordinate persistence and defaults for user settings."""

    def __init__(self, session: Session) -> None:
        self.repository = SettingsRepository(session)

    def get_settings(self, user_id: str) -> UserSettings:
        settings = self.repository.get_for_user(user_id)
        if settings is None:
            settings = UserSettings(user_id=user_id, theme=ThemePreference.SYSTEM)
            return self.repository.create(settings)
        return settings

    def update_profile(
        self,
        *,
        user_id: str,
        first_name: str | None,
        last_name: str | None,
    ) -> UserSettings:
        settings = self.repository.get_for_user(user_id)
        if settings is None:
            settings = UserSettings(
                user_id=user_id,
                theme=ThemePreference.SYSTEM,
                first_name=first_name,
                last_name=last_name,
            )
            return self.repository.create(settings)
        return self.repository.update_profile(
            settings,
            first_name=first_name,
            last_name=last_name,
        )


__all__ = ["SettingsService"]
