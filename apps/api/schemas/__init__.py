"""Pydantic schemas for API payloads."""

from .account import (
    AccountCreate,
    AccountRead,
    AccountUpdate,
    AccountWithBalance,
    ListAccountsQuery,
    ListAccountsResponse,
    LoanCreate,
    LoanRead,
    UpdateAccountPath,
)
from .category import (
    CategoryCreate,
    CategoryListResponse,
    CategoryPathParams,
    CategoryRead,
    CategoryUpdate,
    ListCategoriesQuery,
)
from .transaction import (
    TransactionCreate,
    TransactionLegCreate,
    TransactionLegRead,
    TransactionListQuery,
    TransactionListResponse,
    TransactionRead,
)
from .loan import (
    LoanCreateRequest,
    LoanEventListQuery,
    LoanEventRead,
    LoanScheduleQuery,
    LoanScheduleRead,
    LoanUpdate,
)

__all__ = [
    "AccountCreate",
    "AccountRead",
    "AccountUpdate",
    "AccountWithBalance",
    "ListAccountsQuery",
    "ListAccountsResponse",
    "LoanCreate",
    "LoanRead",
    "UpdateAccountPath",
    "CategoryCreate",
    "CategoryUpdate",
    "CategoryRead",
    "ListCategoriesQuery",
    "CategoryPathParams",
    "CategoryListResponse",
    "TransactionCreate",
    "TransactionRead",
    "TransactionLegCreate",
    "TransactionLegRead",
    "TransactionListQuery",
    "TransactionListResponse",
    "LoanCreateRequest",
    "LoanUpdate",
    "LoanScheduleQuery",
    "LoanScheduleRead",
    "LoanEventRead",
    "LoanEventListQuery",
]
