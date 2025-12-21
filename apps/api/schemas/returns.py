"""Schemas for return transaction workflows."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from ..shared import ReturnStatus


class ReturnSummary(BaseModel):
    """Overview of a return and its originating transaction."""

    return_id: UUID
    return_status: ReturnStatus = ReturnStatus.PENDING
    return_occurred_at: datetime
    return_amount: str
    parent_id: UUID
    parent_description: Optional[str] = None
    parent_occurred_at: datetime
    parent_amount: str
    accounts: list[str] = Field(default_factory=list)


class ReturnListResponse(BaseModel):
    """Payload for listing returns."""

    returns: list[ReturnSummary]


class ReturnActionRequest(BaseModel):
    """Action to perform on an existing return transaction."""

    transaction_id: UUID
    action: Literal["mark_processed", "detach"]


__all__ = ["ReturnSummary", "ReturnListResponse", "ReturnActionRequest"]
