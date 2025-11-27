"""Shared utilities for the Finance Tracker backend."""

from .enums import (
    AccountType,
    CategoryType,
    CreatedSource,
    InterestCompound,
    LoanEventType,
    BudgetPeriod,
    SystemAccountCode,
    TransactionStatus,
    TransactionType,
)
from .finance import (
    BASE_CURRENCY,
    DECIMAL_PLACES,
    SignConventionError,
    coerce_decimal,
    validate_category_amount,
)
from .mixins import AuditSourceMixin, TimestampMixin, UUIDPrimaryKeyMixin
from .session import (
    configure_engine,
    configure_engine_from_env,
    get_engine,
    get_session,
    init_db,
    session_scope,
)
from .settings import (
    DB_ENDPOINT_ENV,
    DB_NAME_ENV,
    DB_PASSWORD_ENV,
    DB_PORT_ENV,
    DB_USER_ENV,
    DatabaseSettings,
)
from .validation import ensure_balanced_legs
from .views import create_or_replace_materialized_views

__all__ = [
    "AccountType",
    "CategoryType",
    "AuditSourceMixin",
    "CreatedSource",
    "InterestCompound",
    "LoanEventType",
    "BudgetPeriod",
    "TransactionStatus",
    "SystemAccountCode",
    "TransactionType",
    "TimestampMixin",
    "UUIDPrimaryKeyMixin",
    "BASE_CURRENCY",
    "DECIMAL_PLACES",
    "SignConventionError",
    "configure_engine",
    "configure_engine_from_env",
    "get_engine",
    "get_session",
    "session_scope",
    "init_db",
    "ensure_balanced_legs",
    "coerce_decimal",
    "validate_category_amount",
    "DatabaseSettings",
    "DB_ENDPOINT_ENV",
    "DB_NAME_ENV",
    "DB_USER_ENV",
    "DB_PASSWORD_ENV",
    "DB_PORT_ENV",
    "create_or_replace_materialized_views",
]
