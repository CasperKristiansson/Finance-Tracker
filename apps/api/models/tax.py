# pyright: reportGeneralTypeIssues=false
"""Tax-related models (income tax payments/refunds)."""

from __future__ import annotations

from typing import TYPE_CHECKING, Optional
from uuid import UUID

from sqlalchemy import Column, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlalchemy.types import Enum as SAEnum
from sqlmodel import Field, Relationship, SQLModel

from ..shared import TaxEventType, TimestampMixin, UserOwnedMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:  # pragma: no cover
    from .transaction import Transaction


class TaxEvent(UUIDPrimaryKeyMixin, TimestampMixin, UserOwnedMixin, SQLModel, table=True):
    """Income tax payment/refund linked to a ledger transaction."""

    __tablename__ = "tax_events"

    transaction_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("transactions.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    event_type: TaxEventType = Field(sa_column=Column(SAEnum(TaxEventType), nullable=False))
    authority: Optional[str] = Field(
        default="Skatteverket",
        sa_column=Column(String(120), nullable=True),
    )
    note: Optional[str] = Field(default=None, sa_column=Column(String(500), nullable=True))

    if TYPE_CHECKING:  # pragma: no cover
        transaction: "Transaction"

    __table_args__ = (
        UniqueConstraint("user_id", "transaction_id", name="uq_tax_event_user_transaction"),
    )

    transaction: "Transaction" = Relationship(
        sa_relationship=relationship("Transaction", back_populates="tax_event", uselist=False),
    )


__all__ = ["TaxEvent"]


TaxEvent.model_rebuild()

