"""Environment-driven configuration helpers."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional
from urllib.parse import quote_plus


DB_ENDPOINT_ENV = "DB_ENDPOINT"
DB_NAME_ENV = "DB_NAME"
DB_USER_ENV = "DB_USER"
DB_PASSWORD_ENV = "DB_PASSWORD"
DB_PORT_ENV = "DB_PORT"


@dataclass(slots=True)
class DatabaseSettings:
    """Database connection settings derived from environment variables."""

    endpoint: str
    name: str
    user: str
    password: str
    port: int = 5432
    driver: str = "postgresql+psycopg2"
    options: Optional[str] = None

    @classmethod
    def from_env(cls) -> "DatabaseSettings":
        missing = [
            key
            for key in (DB_ENDPOINT_ENV, DB_NAME_ENV, DB_USER_ENV, DB_PASSWORD_ENV)
            if not os.getenv(key)
        ]
        if missing:
            raise RuntimeError(
                "Missing required database environment variables: "
                + ", ".join(missing)
            )

        port = int(os.getenv(DB_PORT_ENV, "5432"))
        return cls(
            endpoint=os.environ[DB_ENDPOINT_ENV],
            name=os.environ[DB_NAME_ENV],
            user=os.environ[DB_USER_ENV],
            password=os.environ[DB_PASSWORD_ENV],
            port=port,
        )

    @property
    def sqlalchemy_url(self) -> str:
        password = quote_plus(self.password)
        url = (
            f"{self.driver}://{self.user}:{password}"
            f"@{self.endpoint}:{self.port}/{self.name}"
        )
        if self.options:
            return f"{url}?{self.options}"
        return url


__all__ = [
    "DatabaseSettings",
    "DB_ENDPOINT_ENV",
    "DB_NAME_ENV",
    "DB_USER_ENV",
    "DB_PASSWORD_ENV",
    "DB_PORT_ENV",
]
