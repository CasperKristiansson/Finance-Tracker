"""Authentication helpers shared across the backend."""

from __future__ import annotations

import os

INTEGRATION_USER_ID_ENV = "INTEGRATION_USER_ID"
_DEFAULT_INTEGRATION_USER_ID = "integration-user"


def get_default_user_id() -> str:
    """Return the integration user id used for non-authenticated contexts."""

    return os.getenv(INTEGRATION_USER_ID_ENV, _DEFAULT_INTEGRATION_USER_ID)


__all__ = [
    "get_default_user_id",
    "INTEGRATION_USER_ID_ENV",
]
