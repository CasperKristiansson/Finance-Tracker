"""Temporary helper script to verify local connectivity to the Finance Tracker Aurora DB.

Usage example:

    python temp.py --environment dev --profile Personal --region eu-north-1

Requires boto3 and psycopg2 (``pip install boto3 psycopg2-binary``).
"""

from __future__ import annotations

import argparse
import sys

import boto3
import psycopg2
from psycopg2 import OperationalError


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--environment",
        required=True,
        help="Terraform workspace / environment name (e.g. dev, prod).",
    )
    parser.add_argument(
        "--profile",
        default="Personal",
        help="AWS configuration profile to use when calling SSM.",
    )
    parser.add_argument(
        "--region",
        default="eu-north-1",
        help="AWS region where the Aurora cluster lives.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5432,
        help="Database port (defaults to 5432).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="Connection timeout in seconds (default 10).",
    )
    return parser.parse_args()


def fetch_db_credentials(session: boto3.Session, environment: str) -> dict[str, str]:
    ssm = session.client("ssm")
    prefix = f"/finance-tracker/{environment}/db"
    parameter_names = {
        "endpoint": f"{prefix}/endpoint",
        "name": f"{prefix}/name",
        "user": f"{prefix}/user",
        "password": f"{prefix}/password",
    }

    response = ssm.get_parameters(
        Names=list(parameter_names.values()),
        WithDecryption=True,
    )

    found = {item["Name"]: item["Value"] for item in response.get("Parameters", [])}
    missing = [full_name for full_name in parameter_names.values() if full_name not in found]
    if missing:
        raise RuntimeError(
            "Missing expected SSM parameters: " + ", ".join(missing)
        )

    return {
        key: found[value]
        for key, value in parameter_names.items()
    }


def attempt_connection(creds: dict[str, str], port: int, timeout: float) -> None:
    host = creds["endpoint"]
    dbname = creds["name"]
    user = creds["user"]
    password = creds["password"]

    print(f"Connecting to PostgreSQL at {host}:{port}/{dbname} as {user}...")
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            connect_timeout=timeout,
        )
    except OperationalError as exc:
        raise RuntimeError("Failed to connect to Aurora") from exc

    with conn:
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            print("Connection successful.")
            print(f"Server version: {version}")

    conn.close()


def main() -> int:
    args = parse_args()

    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    try:
        creds = fetch_db_credentials(session, args.environment)
    except Exception as exc:  # noqa: BLE001
        print(f"Error fetching credentials: {exc}", file=sys.stderr)
        return 1

    try:
        attempt_connection(creds, args.port, args.timeout)
    except Exception as exc:  # noqa: BLE001
        print(f"Error connecting to database: {exc}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
