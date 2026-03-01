"""Pydantic schemas for operational utility endpoints."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class BackupTableRead(BaseModel):
    """Summary for a single table included in a backup run."""

    table: str
    row_count: int
    s3_key: str


class BackupRunResponse(BaseModel):
    """Response payload for a completed database backup run."""

    bucket: str
    manifest_key: str
    tables: list[BackupTableRead]


class WarmupResponse(BaseModel):
    """Status payload returned by the warmup endpoint."""

    status: Literal["ready", "starting", "error"]
    message: Optional[str] = None


__all__ = [
    "BackupTableRead",
    "BackupRunResponse",
    "WarmupResponse",
]
