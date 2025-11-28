"""Import-related models."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, List, Optional
from uuid import UUID

from sqlalchemy import JSON, Column, ForeignKey, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship
from sqlmodel import Field, Relationship, SQLModel

from ..shared import TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:  # pragma: no cover
    from .transaction import Transaction


class ImportFile(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """Stores metadata about files included in an import batch."""

    __tablename__ = "import_files"

    batch_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("transaction_import_batches.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    filename: str = Field(sa_column=Column(String(160), nullable=False))
    account_id: Optional[UUID] = Field(default=None, sa_column=Column(PGUUID(as_uuid=True)))
    row_count: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    error_count: int = Field(default=0, sa_column=Column(Integer, nullable=False))
    status: str = Field(default="received", sa_column=Column(String(32), nullable=False))
    bank_type: str = Field(sa_column=Column(String(64), nullable=False))
    errors: List["ImportErrorRecord"] = Relationship(
        sa_relationship=relationship(
            "ImportErrorRecord",
            primaryjoin="ImportFile.id==ImportErrorRecord.file_id",
            cascade="all, delete-orphan",
        )
    )
    rows: List["ImportRow"] = Relationship(
        sa_relationship=relationship(
            "ImportRow",
            primaryjoin="ImportFile.id==ImportRow.file_id",
            cascade="all, delete-orphan",
        )
    )


class ImportErrorRecord(UUIDPrimaryKeyMixin, SQLModel, table=True):
    """Per-row error details for an import file."""

    __tablename__ = "import_errors"

    file_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("import_files.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    row_number: int = Field(sa_column=Column(Integer, nullable=False))
    message: str = Field(sa_column=Column(String(500), nullable=False))


class ImportRow(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """Parsed row stored for staged import review."""

    __tablename__ = "import_rows"

    file_id: UUID = Field(
        sa_column=Column(
            PGUUID(as_uuid=True),
            ForeignKey("import_files.id", ondelete="CASCADE"),
            nullable=False,
        )
    )
    row_index: int = Field(sa_column=Column(Integer, nullable=False))
    data: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    suggested_category: Optional[str] = Field(default=None, sa_column=Column(String(160)))
    suggested_confidence: Optional[float] = Field(
        default=None,
        sa_column=Column(Numeric(5, 2), nullable=True),
    )
    suggested_reason: Optional[str] = Field(default=None, sa_column=Column(String(500)))
    suggested_subscription_id: Optional[UUID] = Field(
        default=None,
        sa_column=Column(PGUUID(as_uuid=True), nullable=True),
    )
    suggested_subscription_name: Optional[str] = Field(
        default=None,
        sa_column=Column(String(160), nullable=True),
    )
    suggested_subscription_confidence: Optional[float] = Field(
        default=None,
        sa_column=Column(Numeric(5, 2), nullable=True),
    )
    suggested_subscription_reason: Optional[str] = Field(
        default=None,
        sa_column=Column(String(500), nullable=True),
    )
    transfer_match: Optional[dict[str, Any]] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
    )


class TransactionImportBatch(UUIDPrimaryKeyMixin, TimestampMixin, SQLModel, table=True):
    """Groups transactions imported together for auditing."""

    __tablename__ = "transaction_import_batches"

    source_name: Optional[str] = Field(
        default=None,
        sa_column=Column(String(160), nullable=True),
    )
    note: Optional[str] = Field(
        default=None,
        sa_column=Column(String(255), nullable=True),
    )

    if TYPE_CHECKING:  # pragma: no cover
        transactions: List["Transaction"]
        files: List["ImportFile"]

    files: List["ImportFile"] = Relationship(
        sa_relationship=relationship(
            "ImportFile",
            primaryjoin="TransactionImportBatch.id==ImportFile.batch_id",
            cascade="all, delete-orphan",
        )
    )


__all__ = ["TransactionImportBatch", "ImportFile", "ImportErrorRecord", "ImportRow"]
