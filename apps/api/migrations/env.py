"""Alembic environment configuration."""

from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path
from typing import Optional
from urllib.parse import quote_plus

import boto3
from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

# ensure project root is on sys.path
BASE_DIR = Path(__file__).resolve().parents[3]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from apps.api import models  # noqa: F401  # ensure models are imported

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

DATABASE_URL_ENV = "DATABASE_URL"
DB_SSM_PREFIX_ENV = "DB_SSM_PREFIX"
DB_SSM_ENV_ENV = "DB_SSM_ENV"
DB_AWS_PROFILE_ENV = "DB_AWS_PROFILE"
DB_AWS_REGION_ENV = "DB_AWS_REGION"


def _fetch_ssm_database_url() -> Optional[str]:
    """Build a DATABASE_URL from SSM parameters when requested.

    Expected parameters (by default): /finance-tracker/{env}/db/{endpoint,name,user,password}
    Optional overrides:
      - DB_SSM_PREFIX: full prefix up to /db (default: /finance-tracker/{DB_SSM_ENV or ENV or default}/db)
      - DB_SSM_ENV: environment slug to interpolate into the default prefix (default: value of ENV env var or 'default')
      - DB_AWS_PROFILE: AWS profile for boto3 session (default: current env/profile)
      - DB_AWS_REGION: AWS region (default: eu-north-1)
    """

    prefix = os.getenv(DB_SSM_PREFIX_ENV)
    env_name = os.getenv(DB_SSM_ENV_ENV) or os.getenv("ENV") or "default"
    region = os.getenv(DB_AWS_REGION_ENV, "eu-north-1")
    profile = os.getenv(DB_AWS_PROFILE_ENV)

    ssm_prefix = prefix or f"/finance-tracker/{env_name}/db"

    session = boto3.Session(profile_name=profile) if profile else boto3.Session()
    ssm = session.client("ssm", region_name=region)

    def _get_param(key: str, decrypt: bool = False) -> str:
        name = f"{ssm_prefix}/{key}"
        resp = ssm.get_parameter(Name=name, WithDecryption=decrypt)
        return resp["Parameter"]["Value"]

    endpoint = _get_param("endpoint")
    name = _get_param("name")
    user = _get_param("user")
    password = _get_param("password", decrypt=True)
    port = os.getenv("DB_PORT", "5432")

    password_enc = quote_plus(password)
    return f"postgresql+psycopg2://{user}:{password_enc}@{endpoint}:{port}/{name}"


def _get_database_url() -> str:
    overrides = context.get_x_argument(as_dictionary=True)
    if overrides.get("db-url"):
        return overrides["db-url"]

    # Prefer explicit env var
    env_url = os.getenv(DATABASE_URL_ENV)
    if env_url:
        return env_url

    # Attempt to build from SSM parameters when configured
    try:
        ssm_url = _fetch_ssm_database_url()
        if ssm_url:
            return ssm_url
    except Exception as exc:  # pragma: no cover - SSM errors should fall through
        raise RuntimeError(f"Failed to resolve database URL from SSM: {exc}") from exc

    # Fallback to alembic.ini
    configured = config.get_main_option("sqlalchemy.url")
    if configured and configured not in {"%(database_url)s", "driver_not_set"}:
        return configured
    raise RuntimeError("Database URL not provided. Set DATABASE_URL or pass --x db-url=<url>.")


target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    url = _get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = _get_database_url()

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        future=True,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
