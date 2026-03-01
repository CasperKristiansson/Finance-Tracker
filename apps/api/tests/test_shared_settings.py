from __future__ import annotations

import pytest

from apps.api.shared.settings import (
    DB_ENDPOINT_ENV,
    DB_NAME_ENV,
    DB_PASSWORD_ENV,
    DB_PORT_ENV,
    DB_USER_ENV,
    DatabaseSettings,
)


def test_database_settings_from_env_requires_mandatory_vars(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    for key in (DB_ENDPOINT_ENV, DB_NAME_ENV, DB_USER_ENV, DB_PASSWORD_ENV, DB_PORT_ENV):
        monkeypatch.delenv(key, raising=False)

    with pytest.raises(RuntimeError, match="Missing required database environment variables"):
        DatabaseSettings.from_env()


def test_database_settings_from_env_uses_default_port(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(DB_ENDPOINT_ENV, "localhost")
    monkeypatch.setenv(DB_NAME_ENV, "finance")
    monkeypatch.setenv(DB_USER_ENV, "user")
    monkeypatch.setenv(DB_PASSWORD_ENV, "pass")
    monkeypatch.delenv(DB_PORT_ENV, raising=False)

    settings = DatabaseSettings.from_env()

    assert settings.port == 5432


def test_database_settings_from_env_reads_custom_port(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(DB_ENDPOINT_ENV, "localhost")
    monkeypatch.setenv(DB_NAME_ENV, "finance")
    monkeypatch.setenv(DB_USER_ENV, "user")
    monkeypatch.setenv(DB_PASSWORD_ENV, "pass")
    monkeypatch.setenv(DB_PORT_ENV, "5544")

    settings = DatabaseSettings.from_env()

    assert settings.port == 5544


def test_sqlalchemy_url_encodes_password_and_options() -> None:
    settings = DatabaseSettings(
        endpoint="db.example.com",
        name="finance_db",
        user="app",
        password="p@ss word",
        port=5432,
        options="sslmode=require",
    )

    assert settings.sqlalchemy_url == (
        "postgresql+psycopg2://app:p%40ss+word@db.example.com:5432/finance_db?sslmode=require"
    )


def test_sqlalchemy_url_without_options() -> None:
    settings = DatabaseSettings(
        endpoint="db.example.com",
        name="finance_db",
        user="app",
        password="pass",
        port=5432,
    )

    assert (
        settings.sqlalchemy_url == "postgresql+psycopg2://app:pass@db.example.com:5432/finance_db"
    )
