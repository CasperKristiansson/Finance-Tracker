"""Reusable SQLModel mixins shared across the backend."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Enum as SAEnum, func
from sqlmodel import Field

from .enums import CreatedSource


class TimestampMixin:
    """Adds created/updated timestamps with database defaults."""

    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            nullable=False,
        ),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        ),
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
        sa_column=Column(
            SAEnum(CreatedSource),
            nullable=False,
            server_default=CreatedSource.MANUAL.value,
        ),
    )


__all__ = [
    "TimestampMixin",
    "UUIDPrimaryKeyMixin",
    "AuditSourceMixin",
]
