"""Schemas for user settings endpoints."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SettingsPayload(BaseModel):
    """User-configurable settings payload.

    Only profile details are persisted.
    """

    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    last_name: str | None = Field(default=None, min_length=1, max_length=120)


class SettingsRequest(BaseModel):
    """Expected shape for settings mutation requests."""

    settings: SettingsPayload


class SettingsResponse(BaseModel):
    """Response wrapper for settings endpoints."""

    settings: SettingsPayload


__all__ = [
    "SettingsPayload",
    "SettingsRequest",
    "SettingsResponse",
]
