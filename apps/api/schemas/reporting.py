"""Pydantic schemas for reporting API endpoints."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


class _CsvUUIDMixin(BaseModel):
    """Utility mixin to split comma-separated UUID query params."""

    @classmethod
    def _parse_uuid_list(cls, raw: Any) -> Optional[List[UUID]]:
        if raw in (None, ""):
            return None
        if isinstance(raw, list):
            return [UUID(str(item)) for item in raw]
        if isinstance(raw, str):
            parts = [part.strip() for part in raw.split(",") if part.strip()]
            return [UUID(part) for part in parts]
        raise ValidationError(
            [
                {
                    "loc": ("value",),
                    "msg": "Invalid UUID list",
                    "type": "value_error",
                }
            ],
            cls,
        )


class MonthlyReportQuery(_CsvUUIDMixin):
    """Query parameters for monthly report endpoint."""

    year: Optional[int] = Field(default=None, ge=1900, le=3000)
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")
    category_ids: Optional[List[UUID]] = Field(default=None, alias="category_ids")

    @model_validator(mode="before")
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict):
            if "account_ids" in values:
                values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
            if "category_ids" in values:
                values["category_ids"] = cls._parse_uuid_list(values.get("category_ids"))
        return values


class YearlyReportQuery(_CsvUUIDMixin):
    """Query parameters for yearly report endpoint."""

    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")
    category_ids: Optional[List[UUID]] = Field(default=None, alias="category_ids")

    @model_validator(mode="before")
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict):
            if "account_ids" in values:
                values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
            if "category_ids" in values:
                values["category_ids"] = cls._parse_uuid_list(values.get("category_ids"))
        return values


class TotalReportQuery(YearlyReportQuery):
    """Query parameters for total summary endpoint."""


class MonthlyReportEntry(BaseModel):
    """Single month aggregation."""

    model_config = ConfigDict(from_attributes=True)

    period: date
    income: Decimal
    expense: Decimal
    net: Decimal


class MonthlyReportResponse(BaseModel):
    """Monthly aggregation payload."""

    results: List[MonthlyReportEntry]


class YearlyReportEntry(BaseModel):
    """Single year aggregation."""

    model_config = ConfigDict(from_attributes=True)

    year: int
    income: Decimal
    expense: Decimal
    net: Decimal


class YearlyReportResponse(BaseModel):
    """Yearly aggregation payload."""

    results: List[YearlyReportEntry]


class TotalReportRead(BaseModel):
    """Lifetime totals payload."""

    model_config = ConfigDict(from_attributes=True)

    income: Decimal
    expense: Decimal
    net: Decimal


__all__ = [
    "MonthlyReportQuery",
    "YearlyReportQuery",
    "TotalReportQuery",
    "MonthlyReportEntry",
    "MonthlyReportResponse",
    "YearlyReportEntry",
    "YearlyReportResponse",
    "TotalReportRead",
]
