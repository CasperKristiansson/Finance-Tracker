"""Helper script to fetch Aurora credentials from SSM and test connectivity.

Typical usage from the bastion host:

    python3 temp.py --timeout 30

From a local machine with AWS credentials:

    python3 temp.py --profile Personal --environment default --timeout 30

Install dependencies (already available after pip install on bastion):

    python3 -m pip install --user boto3 psycopg2-binary
"""

from __future__ import annotations

import argparse
import sys
from typing import Dict

import boto3
import psycopg2
from psycopg2 import OperationalError


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--environment",
        default="default",
        help="Terraform workspace / environment name (default: default).",
    )
    parser.add_argument(
        "--region",
        default="eu-north-1",
        help="AWS region that hosts the SSM parameters (default: eu-north-1).",
    )
    parser.add_argument(
        "--profile",
        default=None,
        help="Optional AWS profile name. If omitted, the default credential chain is used.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=5432,
        help="Database port (default: 5432).",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=10.0,
        help="Connection timeout in seconds (default: 10).",
    )
    parser.add_argument(
        "--skip-connection",
        action="store_true",
        help="Fetch and print credentials only; do not attempt to connect to the database.",
    )
    return parser.parse_args()


def fetch_db_credentials(session: boto3.Session, environment: str) -> Dict[str, str]:
    ssm = session.client("ssm")
    prefix = f"/finance-tracker/{environment}/db"
    parameter_names = {
        "endpoint": f"{prefix}/endpoint",
        "database": f"{prefix}/name",
        "user": f"{prefix}/user",
        "password": f"{prefix}/password",
    }

    response = ssm.get_parameters(Names=list(parameter_names.values()), WithDecryption=True)

    found = {item["Name"]: item["Value"] for item in response.get("Parameters", [])}
    missing = [full_name for full_name in parameter_names.values() if full_name not in found]
    if missing:
        raise RuntimeError("Missing expected SSM parameters: " + ", ".join(missing))

    return {key: found[value] for key, value in parameter_names.items()}


def attempt_connection(creds: Dict[str, str], port: int, timeout: float) -> None:
    host = creds["endpoint"]
    dbname = creds["database"]
    user = creds["user"]
    password = creds["password"]
    timeout_seconds = max(1, int(round(timeout)))

    print(f"Connecting to PostgreSQL at {host}:{port}/{dbname} as {user}...")
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            dbname=dbname,
            user=user,
            password=password,
            connect_timeout=timeout_seconds,
        )
    except OperationalError as exc:
        raise RuntimeError(f"Failed to connect to Aurora: {exc}") from exc

    with conn:
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
            print("Connection successful.")
            print(f"Server version: {version}")

    conn.close()


def main() -> int:
    args = parse_args()

    session_kwargs = {"region_name": args.region}
    if args.profile:
        session_kwargs["profile_name"] = args.profile

    session = boto3.Session(**session_kwargs)

    try:
        creds = fetch_db_credentials(session, args.environment)
    except Exception as exc:  # noqa: BLE001
        print(f"Error fetching credentials: {exc}", file=sys.stderr)
        return 1

    print(
        "Fetched credentials for environment '{env}':\n"
        "  endpoint: {endpoint}\n  database: {database}\n  user: {user}".format(
            env=args.environment,
            endpoint=creds["endpoint"],
            database=creds["database"],
            user=creds["user"],
        )
    )

    if args.skip_connection:
        print("Skipping database connection test.")
        return 0

    try:
        attempt_connection(creds, args.port, args.timeout)
    except Exception as exc:  # noqa: BLE001
        print(f"Error connecting to database: {exc}", file=sys.stderr)
        return 2

    return 0


if __name__ == "__main__":
    sys.exit(main())
