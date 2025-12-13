"""Pydantic schemas for reporting API endpoints."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, List, Optional, Sequence
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from ..shared import AccountType


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


class NetWorthChangeWindow(BaseModel):
    days_30: Decimal
    days_90: Decimal
    days_365: Decimal
    since_start: Decimal


class RunRateSummary(BaseModel):
    avg_monthly_income: Decimal
    avg_monthly_expense: Decimal
    avg_monthly_net: Decimal
    savings_rate_pct: Optional[Decimal] = None


class CashRunwaySummary(BaseModel):
    cash_balance: Decimal
    avg_monthly_expense_6m: Decimal
    runway_months: Optional[Decimal] = None


class CategoryTotalEntry(BaseModel):
    category_id: Optional[str] = None
    name: str
    total: Decimal
    icon: Optional[str] = None
    color_hex: Optional[str] = None
    transaction_count: int


class TotalInvestmentsSummary(BaseModel):
    as_of: str
    current_value: Decimal
    value_12m_ago: Decimal
    change_12m: Decimal
    change_pct_12m: Optional[Decimal] = None
    contributions_lifetime: Decimal
    withdrawals_lifetime: Decimal
    net_contributions_lifetime: Decimal
    contributions_12m: Decimal
    withdrawals_12m: Decimal
    net_contributions_12m: Decimal
    monthly_values_12m: List[Decimal]
    accounts: List["InvestmentAccountSummaryEntry"]


class TotalDebtSummary(BaseModel):
    total: Decimal
    value_12m_ago: Decimal
    change_12m: Decimal
    debt_to_income_12m: Optional[Decimal] = None
    accounts: List["DebtOverviewEntry"]


class TotalOverviewResponse(BaseModel):
    as_of: str
    net_worth: Decimal
    net_worth_change: NetWorthChangeWindow
    lifetime: "SavingsIndicator"
    last_12m: "SavingsIndicator"
    run_rate_6m: RunRateSummary
    run_rate_12m: RunRateSummary
    cash_runway: CashRunwaySummary
    investments: TotalInvestmentsSummary
    debt: TotalDebtSummary
    account_flows: List["AccountFlowEntry"]
    income_sources: List["SourceSummaryEntry"]
    expense_sources: List["SourceSummaryEntry"]
    top_categories_12m: List["YearlyCategoryBreakdownEntry"]
    top_categories_lifetime: List[CategoryTotalEntry]
    category_changes_12m: List["CategoryChangeEntry"]
    monthly_income_12m: List[Decimal]
    monthly_expense_12m: List[Decimal]
    monthly_income_prev_12m: List[Decimal]
    monthly_expense_prev_12m: List[Decimal]
    insights: List[str]


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


class YearlyOverviewMonthEntry(BaseModel):
    date: str
    month: int
    income: Decimal
    expense: Decimal
    net: Decimal


class NetWorthSeriesPoint(BaseModel):
    date: str
    net_worth: Decimal


class DebtSeriesPoint(BaseModel):
    date: str
    debt: Decimal


class SavingsIndicator(BaseModel):
    income: Decimal
    expense: Decimal
    saved: Decimal
    savings_rate_pct: Optional[Decimal] = None


class BiggestMonthEntry(BaseModel):
    month: int
    amount: Decimal


class YearlyOverviewStats(BaseModel):
    total_income: Decimal
    total_expense: Decimal
    net_savings: Decimal
    savings_rate_pct: Optional[Decimal] = None
    avg_monthly_spend: Decimal
    biggest_income_month: BiggestMonthEntry
    biggest_expense_month: BiggestMonthEntry


class YearlyCategoryBreakdownEntry(BaseModel):
    category_id: Optional[str] = None
    name: str
    total: Decimal
    monthly: List[Decimal]
    icon: Optional[str] = None
    color_hex: Optional[str] = None
    transaction_count: int


class MerchantSummaryEntry(BaseModel):
    merchant: str
    amount: Decimal
    transaction_count: int


class LargestTransactionEntry(BaseModel):
    id: str
    occurred_at: str
    merchant: str
    amount: Decimal
    category_id: Optional[str] = None
    category_name: str
    notes: Optional[str] = None


class CategoryChangeEntry(BaseModel):
    category_id: Optional[str] = None
    name: str
    amount: Decimal
    prev_amount: Decimal
    delta: Decimal
    delta_pct: Optional[Decimal] = None


class InvestmentAccountSummaryEntry(BaseModel):
    account_name: str
    start_value: Decimal
    end_value: Decimal
    change: Decimal


class InvestmentsSummary(BaseModel):
    as_of: str
    start_value: Decimal
    end_value: Decimal
    change: Decimal
    change_pct: Optional[Decimal] = None
    contributions: Decimal
    withdrawals: Decimal
    net_contributions: Decimal
    monthly_values: List[Decimal]
    accounts: List[InvestmentAccountSummaryEntry]


class DebtOverviewEntry(BaseModel):
    account_id: str
    name: str
    start_debt: Decimal
    end_debt: Decimal
    delta: Decimal
    monthly_debt: List[Decimal]


class AccountFlowEntry(BaseModel):
    account_id: str
    name: str
    account_type: AccountType
    start_balance: Decimal
    end_balance: Decimal
    change: Decimal
    income: Decimal
    expense: Decimal
    transfers_in: Decimal
    transfers_out: Decimal
    net_operating: Decimal
    net_transfers: Decimal
    monthly_income: List[Decimal]
    monthly_expense: List[Decimal]
    monthly_transfers_in: List[Decimal]
    monthly_transfers_out: List[Decimal]
    monthly_change: List[Decimal]


class SourceSummaryEntry(BaseModel):
    source: str
    total: Decimal
    monthly: List[Decimal]
    transaction_count: int


class YearlyOverviewResponse(BaseModel):
    year: int
    monthly: List[YearlyOverviewMonthEntry]
    net_worth: List[NetWorthSeriesPoint]
    debt: List[DebtSeriesPoint]
    savings: SavingsIndicator
    stats: YearlyOverviewStats
    category_breakdown: List[YearlyCategoryBreakdownEntry]
    income_category_breakdown: List[YearlyCategoryBreakdownEntry]
    top_merchants: List[MerchantSummaryEntry]
    largest_transactions: List[LargestTransactionEntry]
    category_changes: List[CategoryChangeEntry]
    investments_summary: InvestmentsSummary
    debt_overview: List[DebtOverviewEntry]
    account_flows: List[AccountFlowEntry]
    income_sources: List[SourceSummaryEntry]
    expense_sources: List[SourceSummaryEntry]
    insights: List[str]


class YearlyCategoryMonthlyEntry(BaseModel):
    date: str
    month: int
    amount: Decimal


class YearlyCategoryDetailResponse(BaseModel):
    year: int
    category_id: str
    category_name: str
    monthly: List[YearlyCategoryMonthlyEntry]
    top_merchants: List[MerchantSummaryEntry]


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
    "CashflowForecastQuery",
    "CashflowForecastResponse",
    "NetWorthProjectionQuery",
    "NetWorthProjectionResponse",
    "YearlyOverviewQuery",
    "YearlyOverviewResponse",
    "YearlyCategoryDetailQuery",
    "YearlyCategoryDetailResponse",
    "ExportReportRequest",
    "ExportReportResponse",
]
