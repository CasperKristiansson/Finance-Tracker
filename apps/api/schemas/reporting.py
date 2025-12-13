"""Pydantic schemas for reporting API endpoints."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, List, Optional, Sequence
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
    subscription_ids: Optional[List[UUID]] = Field(default=None, alias="subscription_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict):
            if "account_ids" in values:
                values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
            if "category_ids" in values:
                values["category_ids"] = cls._parse_uuid_list(values.get("category_ids"))
            if "subscription_ids" in values:
                values["subscription_ids"] = cls._parse_uuid_list(values.get("subscription_ids"))
        return values


class YearlyReportQuery(_CsvUUIDMixin):
    """Query parameters for yearly report endpoint."""

    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")
    category_ids: Optional[List[UUID]] = Field(default=None, alias="category_ids")
    subscription_ids: Optional[List[UUID]] = Field(default=None, alias="subscription_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict):
            if "account_ids" in values:
                values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
            if "category_ids" in values:
                values["category_ids"] = cls._parse_uuid_list(values.get("category_ids"))
            if "subscription_ids" in values:
                values["subscription_ids"] = cls._parse_uuid_list(values.get("subscription_ids"))
        return values


class TotalReportQuery(YearlyReportQuery):
    """Query parameters for total summary endpoint."""


class QuarterlyReportQuery(MonthlyReportQuery):
    """Query parameters for quarterly report endpoint."""


class DateRangeReportQuery(_CsvUUIDMixin):
    """Query parameters for custom date-range report."""

    start_date: date
    end_date: date
    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")
    category_ids: Optional[List[UUID]] = Field(default=None, alias="category_ids")
    subscription_ids: Optional[List[UUID]] = Field(default=None, alias="subscription_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict):
            if "account_ids" in values:
                values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
            if "category_ids" in values:
                values["category_ids"] = cls._parse_uuid_list(values.get("category_ids"))
            if "subscription_ids" in values:
                values["subscription_ids"] = cls._parse_uuid_list(values.get("subscription_ids"))
        return values


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


class QuarterlyReportEntry(BaseModel):
    """Single quarter aggregation."""

    model_config = ConfigDict(from_attributes=True)

    year: int
    quarter: int
    income: Decimal
    expense: Decimal
    net: Decimal


class QuarterlyReportResponse(BaseModel):
    """Quarterly aggregation payload."""

    results: List[QuarterlyReportEntry]


class DateRangeReportResponse(BaseModel):
    """Date range aggregation payload (month buckets)."""

    results: List[MonthlyReportEntry]


class TotalReportRead(BaseModel):
    """Lifetime totals payload."""

    model_config = ConfigDict(from_attributes=True)

    income: Decimal
    expense: Decimal
    net: Decimal


class NetWorthHistoryQuery(_CsvUUIDMixin):
    """Query parameters for net worth history endpoint."""

    account_ids: Optional[List[UUID]] = Field(default=None, alias="account_ids")

    @model_validator(mode="before")
    @classmethod
    def _split_lists(cls, values: Any) -> Any:
        if isinstance(values, dict) and "account_ids" in values:
            values["account_ids"] = cls._parse_uuid_list(values.get("account_ids"))
        return values


class NetWorthPoint(BaseModel):
    """Net worth value for a given date."""

    model_config = ConfigDict(from_attributes=True)

    period: date
    net_worth: Decimal


class NetWorthHistoryResponse(BaseModel):
    """Response payload for net worth history."""

    points: List[NetWorthPoint]


class CashflowForecastPoint(BaseModel):
    """Forecast point for cash flow."""

    date: str
    balance: Decimal


class CashflowForecastResponse(BaseModel):
    """Forecast payload for cash flow."""

    starting_balance: Decimal
    average_daily: Decimal
    threshold: Decimal
    alert_below_threshold_at: Optional[str] = None
    points: List[CashflowForecastPoint]


class CashflowForecastQuery(_CsvUUIDMixin):
    """Query parameters for cash flow forecast endpoint."""

    days: int = Field(default=60, ge=1, le=365)
    threshold: Decimal = Field(default=Decimal("0"))
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


class NetWorthProjectionPoint(BaseModel):
    """Projected net worth over time."""

    date: str
    net_worth: Decimal


class NetWorthProjectionResponse(BaseModel):
    """Projection payload up to N months."""

    current: Decimal
    cagr: Optional[Decimal] = None
    points: List[NetWorthProjectionPoint]


class ExportReportRequest(BaseModel):
    """Request payload for exporting reports in CSV/XLSX."""

    granularity: str = Field(pattern="^(monthly|yearly|quarterly|total|net_worth)$")
    format: str = Field(default="csv", pattern="^(csv|xlsx)$")
    year: Optional[int] = Field(default=None, ge=1900, le=3000)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    account_ids: Optional[Sequence[UUID]] = None
    category_ids: Optional[Sequence[UUID]] = None
    subscription_ids: Optional[Sequence[UUID]] = None

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
        if "subscription_ids" in normalized:
            normalized["subscription_ids"] = parse_ids(normalized.get("subscription_ids"))
        return cls.model_validate(normalized)


class ExportReportResponse(BaseModel):
    """Response payload for exported report content."""

    filename: str
    content_type: str
    data_base64: str


__all__ = [
    "MonthlyReportQuery",
    "YearlyReportQuery",
    "TotalReportQuery",
    "QuarterlyReportQuery",
    "DateRangeReportQuery",
    "MonthlyReportEntry",
    "MonthlyReportResponse",
    "YearlyReportEntry",
    "YearlyReportResponse",
    "QuarterlyReportEntry",
    "QuarterlyReportResponse",
    "DateRangeReportResponse",
    "TotalReportRead",
    "NetWorthHistoryQuery",
    "NetWorthPoint",
    "NetWorthHistoryResponse",
    "ExportReportRequest",
    "ExportReportResponse",
]
