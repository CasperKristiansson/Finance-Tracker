"""Service layer for user settings."""

from __future__ import annotations

from sqlmodel import Session

from ..models import UserSettings
from ..repositories.settings import SettingsRepository
from ..shared import ThemePreference


class SettingsService:
    """Coordinate persistence and defaults for user settings."""

    def __init__(self, session: Session):
        self.session = session
        self.repository = SettingsRepository(session)

    def get_settings(self, user_id: str) -> UserSettings:
        settings = self.repository.get_for_user(user_id)
        if settings is None:
            settings = UserSettings(user_id=user_id, theme=ThemePreference.SYSTEM)
            return self.repository.create(settings)
        return settings

    def update_settings(
        self,
        user_id: str,
        *,
        theme: ThemePreference | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
    ) -> UserSettings:
        settings = self.repository.get_for_user(user_id)
        if settings is None:
            settings = UserSettings(
                user_id=user_id,
                theme=theme or ThemePreference.SYSTEM,
                first_name=first_name,
                last_name=last_name,
            )
            return self.repository.create(settings)
        return self.repository.update(
            settings,
            theme=theme,
            first_name=first_name,
            last_name=last_name,
        )


__all__ = ["SettingsService"]
