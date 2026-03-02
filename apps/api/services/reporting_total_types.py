"""Typed structures for total-overview report builder."""

from __future__ import annotations

from decimal import Decimal
from typing import Callable, List, Optional, Tuple, TypedDict

from ..repositories.reporting import TransactionAmountRow
from ..shared import AccountType

IncomeExpenseClassifier = Callable[[TransactionAmountRow], Tuple[Decimal, Decimal]]
MerchantKeyFn = Callable[[Optional[str]], str]


class YearTotals(TypedDict):
    income: Decimal
    expense: Decimal


class MonthTotals(TypedDict):
    income: Decimal
    expense: Decimal


class CategoryAgg(TypedDict):
    category_id: Optional[str]
    name: str
    total: Decimal
    icon: Optional[str]
    color_hex: Optional[str]
    transaction_count: int


class SourceAgg(TypedDict):
    source: str
    total: Decimal
    transaction_count: int


class DebtAccountRow(TypedDict):
    account_id: str
    name: str
    current_debt: Decimal
    prev_year_end_debt: Optional[Decimal]
    delta: Optional[Decimal]


class CategoryMixEntry(TypedDict):
    category_id: Optional[str]
    name: str
    total: Decimal
    icon: Optional[str]
    color_hex: Optional[str]
    transaction_count: int


class CategoryMixYear(TypedDict):
    year: int
    categories: List[CategoryMixEntry]


class CategoryChangeRow(TypedDict):
    category_id: Optional[str]
    name: str
    amount: Decimal
    prev_amount: Decimal
    delta: Decimal
    delta_pct: Optional[Decimal]


class SourceRow(TypedDict):
    source: str
    total: Decimal
    transaction_count: int


class SourceChangeRow(TypedDict):
    source: str
    amount: Decimal
    prev_amount: Decimal
    delta: Decimal
    delta_pct: Optional[Decimal]


class AccountOverviewRow(TypedDict):
    account_id: str
    name: str
    account_type: AccountType
    current_balance: Decimal
    operating_income: Decimal
    operating_expense: Decimal
    net_operating: Decimal
    transfers_in: Decimal
    transfers_out: Decimal
    net_transfers: Decimal
    first_transaction_date: Optional[str]


class InvestmentSeriesPoint(TypedDict):
    date: str
    value: Decimal


class InvestmentAccountValue(TypedDict):
    account_name: str
    value: Decimal


class InvestmentYearRow(TypedDict):
    year: int
    end_value: Decimal
    contributions: Decimal
    withdrawals: Decimal
    net_contributions: Decimal
    implied_return: Optional[Decimal]


__all__ = [
    "IncomeExpenseClassifier",
    "MerchantKeyFn",
    "YearTotals",
    "MonthTotals",
    "CategoryAgg",
    "SourceAgg",
    "DebtAccountRow",
    "CategoryMixEntry",
    "CategoryMixYear",
    "CategoryChangeRow",
    "SourceRow",
    "SourceChangeRow",
    "AccountOverviewRow",
    "InvestmentSeriesPoint",
    "InvestmentAccountValue",
    "InvestmentYearRow",
]
