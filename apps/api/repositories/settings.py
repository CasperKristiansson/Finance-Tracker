"""Repository for user settings."""

from __future__ import annotations

from typing import Optional

from sqlmodel import Session, select

from ..models import UserSettings
from ..shared import ThemePreference


class SettingsRepository:
    """Encapsulates persistence for user settings."""

    def __init__(self, session: Session):
        self.session = session

    def get_for_user(self, user_id: str) -> Optional[UserSettings]:
        statement = select(UserSettings).where(UserSettings.user_id == user_id).limit(1)
        return self.session.exec(statement).one_or_none()

    def create(self, settings: UserSettings) -> UserSettings:
        self.session.add(settings)
        self.session.commit()
        self.session.refresh(settings)
        return settings

    def update(
        self,
        settings: UserSettings,
        *,
        theme: ThemePreference | None = None,
        first_name: str | None = None,
        last_name: str | None = None,
    ) -> UserSettings:
        if theme is not None:
            settings.theme = theme
        settings.first_name = first_name if first_name is not None else settings.first_name
        settings.last_name = last_name if last_name is not None else settings.last_name
        self.session.add(settings)
        self.session.commit()
        self.session.refresh(settings)
        return settings


__all__ = ["SettingsRepository"]
