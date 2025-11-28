"""User-scoped settings model."""

from __future__ import annotations

from sqlalchemy import Column, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from ..shared import ThemePreference, TimestampMixin, UserOwnedMixin, UUIDPrimaryKeyMixin


class UserSettings(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Stores per-user UI and preference settings."""

    __tablename__ = "user_settings"

    theme: ThemePreference = Field(
        default=ThemePreference.SYSTEM,
        sa_column=Column(String(16), nullable=False, server_default=ThemePreference.SYSTEM.value),
    )
    first_name: str | None = Field(
        default=None,
        sa_column=Column(String(120), nullable=True),
    )
    last_name: str | None = Field(
        default=None,
        sa_column=Column(String(120), nullable=True),
    )

    __table_args__ = (UniqueConstraint("user_id", name="uq_user_settings_user_id"),)


__all__ = ["UserSettings"]


UserSettings.model_rebuild()
