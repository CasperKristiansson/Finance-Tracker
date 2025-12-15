"""Repository for user settings."""

from __future__ import annotations

from typing import Optional

from sqlmodel import Session, select

from ..models import UserSettings


class SettingsRepository:
    """Encapsulates persistence for user settings."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_for_user(self, user_id: str) -> Optional[UserSettings]:
        statement = select(UserSettings).where(UserSettings.user_id == user_id).limit(1)
        return self.session.exec(statement).first()

    def create(self, settings: UserSettings) -> UserSettings:
        self.session.add(settings)
        self.session.commit()
        self.session.refresh(settings)
        return settings

    def update_profile(
        self,
        settings: UserSettings,
        *,
        first_name: str | None,
        last_name: str | None,
    ) -> UserSettings:
        settings.first_name = first_name
        settings.last_name = last_name
        self.session.add(settings)
        self.session.commit()
        self.session.refresh(settings)
        return settings


__all__ = ["SettingsRepository"]
