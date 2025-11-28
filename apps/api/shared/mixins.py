"""Reusable SQLModel mixins shared across the backend."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field

from .enums import CreatedSource


class TimestampMixin:
    """Adds created/updated timestamps with database defaults."""

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )


class UUIDPrimaryKeyMixin:
    """Provides a UUID primary key field."""

    id: UUID = Field(
        default_factory=uuid4,
        primary_key=True,
        nullable=False,
        index=False,
    )


class AuditSourceMixin:
    """Captures how a record was created for auditing."""

    created_source: CreatedSource = Field(
        default=CreatedSource.MANUAL,
        nullable=False,
    )


class UserOwnedMixin:
    """Adds a Cognito user identifier for multi-tenant scoping."""

    user_id: str = Field(
        default="",
        max_length=64,
        nullable=False,
        index=True,
        description="Cognito subject identifier for the record owner",
    )


__all__ = [
    "TimestampMixin",
    "UUIDPrimaryKeyMixin",
    "AuditSourceMixin",
    "UserOwnedMixin",
]
