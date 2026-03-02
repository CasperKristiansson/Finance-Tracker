"""Reporting query and request schemas."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, List, Optional, Sequence
from uuid import UUID

from pydantic import BaseModel, Field, ValidationError, model_validator


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
    @classmethod
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
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict):
            if "account_ids" in values:
                values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
            if "category_ids" in values:
                values["category_ids"] = cls._parse_uuid_list(values.get("category_ids"))
        return values


class TotalReportQuery(YearlyReportQuery):
    """Query parameters for total summary endpoint."""


class TotalOverviewQuery(_CsvUUIDMixin):
    """Query parameters for total overview report."""

    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict) and "account_ids" in values:
            values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
        return values


class QuarterlyReportQuery(MonthlyReportQuery):
    """Query parameters for quarterly report endpoint."""


class DateRangeReportQuery(_CsvUUIDMixin):
    """Query parameters for custom date-range report."""

    start_date: date
    end_date: date
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")
    category_ids: Optional[List[UUID]] = Field(default=None, alias="category_ids")
    source: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict):
            if "account_ids" in values:
                values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
            if "category_ids" in values:
                values["category_ids"] = cls._parse_uuid_list(values.get("category_ids"))
        return values


class DashboardOverviewQuery(_CsvUUIDMixin):
    """Query parameters for the dashboard overview endpoint."""

    year: Optional[int] = Field(default=None, ge=1900, le=3000)
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict) and "account_ids" in values:
            values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
        return values


class NetWorthHistoryQuery(_CsvUUIDMixin):
    """Query parameters for net worth history endpoint."""

    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict) and "account_ids" in values:
            values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
        return values


class CashflowForecastQuery(_CsvUUIDMixin):
    """Query parameters for cash flow forecast endpoint."""

    days: int = Field(default=60, ge=1, le=365)
    threshold: Decimal = Field(default=Decimal("0"))
    lookback_days: int = Field(default=180, ge=30, le=730)
    model: str = Field(default="ensemble", pattern="^(simple|seasonal|ensemble)$")
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict) and "account_ids" in values:
            values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
        return values


class NetWorthProjectionQuery(_CsvUUIDMixin):
    """Query parameters for net worth projection endpoint."""

    months: int = Field(default=36, ge=1, le=120)
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict) and "account_ids" in values:
            values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
        return values


class YearlyOverviewQuery(_CsvUUIDMixin):
    """Query parameters for yearly overview report."""

    year: int = Field(ge=1900, le=3000)
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict) and "account_ids" in values:
            values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
        return values


class YearlyOverviewRangeQuery(_CsvUUIDMixin):
    """Query parameters for loading multiple yearly overviews at once."""

    start_year: int = Field(ge=1900, le=3000, alias="start_year")
    end_year: int = Field(ge=1900, le=3000, alias="end_year")
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict) and "account_ids" in values:
            values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
        return values

    @model_validator(mode="after")
    def _validate_range(self) -> "YearlyOverviewRangeQuery":
        if self.start_year > self.end_year:
            raise ValueError("start_year must be less than or equal to end_year")
        if (self.end_year - self.start_year) > 25:
            raise ValueError("Year range must not exceed 25 years")
        return self


class YearlyCategoryDetailQuery(_CsvUUIDMixin):
    """Query parameters for category drilldown within a year."""

    year: int = Field(ge=1900, le=3000)
    category_id: UUID
    flow: str = Field(default="expense", pattern="^(expense|income)$")
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict) and "account_ids" in values:
            values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
        return values


class ExportReportRequest(BaseModel):
    """Request payload for exporting reports in CSV/XLSX."""

    granularity: str = Field(pattern="^(monthly|yearly|quarterly|total|net_worth)$")
    format: str = Field(default="csv", pattern="^(csv|xlsx)$")
    year: Optional[int] = Field(default=None, ge=1900, le=3000)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    account_ids: Optional[Sequence[UUID]] = None
    category_ids: Optional[Sequence[UUID]] = None

    @classmethod
    def from_payload(cls, payload: dict) -> "ExportReportRequest":
        def parse_ids(raw: Any) -> Optional[List[UUID]]:
            if raw in (None, "", []):
                return None
            if isinstance(raw, list):
                return [UUID(str(item)) for item in raw]
            if isinstance(raw, str):
                return [UUID(part.strip()) for part in raw.split(",") if part.strip()]
            return None

        normalized = dict(payload)
        if "account_ids" in normalized:
            normalized["account_ids"] = parse_ids(normalized.get("account_ids"))
        if "category_ids" in normalized:
            normalized["category_ids"] = parse_ids(normalized.get("category_ids"))
        return cls.model_validate(normalized)


__all__ = [
    "_CsvUUIDMixin",
    "MonthlyReportQuery",
    "YearlyReportQuery",
    "TotalReportQuery",
    "TotalOverviewQuery",
    "QuarterlyReportQuery",
    "DateRangeReportQuery",
    "DashboardOverviewQuery",
    "NetWorthHistoryQuery",
    "CashflowForecastQuery",
    "NetWorthProjectionQuery",
    "YearlyOverviewQuery",
    "YearlyOverviewRangeQuery",
    "YearlyCategoryDetailQuery",
    "ExportReportRequest",
]
