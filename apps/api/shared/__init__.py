"""Shared utilities for the Finance Tracker backend."""

from .auth import INTEGRATION_USER_ID_ENV, get_default_user_id
from .enums import (
    AccountType,
    BankImportType,
    BudgetPeriod,
    CategoryType,
    CreatedSource,
    InterestCompound,
    LoanEventType,
    SystemAccountCode,
    TaxEventType,
    ThemePreference,
    TransactionType,
)
from .finance import (
    BASE_CURRENCY,
    DECIMAL_PLACES,
    SignConventionError,
    coerce_decimal,
    validate_category_amount,
)
from .mixins import AuditSourceMixin, TimestampMixin, UserOwnedMixin, UUIDPrimaryKeyMixin
from .session import (
    configure_engine,
    configure_engine_from_env,
    get_engine,
    get_session,
    init_db,
    scope_session_to_user,
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
from .validation import ensure_balanced_legs, validate_transaction_legs
from .views import create_or_replace_materialized_views

__all__ = [
    "AccountType",
    "BankImportType",
    "CategoryType",
    "AuditSourceMixin",
    "CreatedSource",
    "UserOwnedMixin",
    "InterestCompound",
    "LoanEventType",
    "TaxEventType",
    "BudgetPeriod",
    "SystemAccountCode",
    "TransactionType",
    "ThemePreference",
    "TimestampMixin",
    "UUIDPrimaryKeyMixin",
    "BASE_CURRENCY",
    "DECIMAL_PLACES",
    "SignConventionError",
    "configure_engine",
    "configure_engine_from_env",
    "get_engine",
    "get_session",
    "scope_session_to_user",
    "session_scope",
    "init_db",
    "ensure_balanced_legs",
    "validate_transaction_legs",
    "coerce_decimal",
    "validate_category_amount",
    "DatabaseSettings",
    "DB_ENDPOINT_ENV",
    "DB_NAME_ENV",
    "DB_USER_ENV",
    "DB_PASSWORD_ENV",
    "DB_PORT_ENV",
    "create_or_replace_materialized_views",
    "get_default_user_id",
    "INTEGRATION_USER_ID_ENV",
]
