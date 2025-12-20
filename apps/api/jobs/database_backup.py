"""Database backup helpers for scheduled exports."""

from __future__ import annotations

import enum
import json
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List
from uuid import UUID

import boto3
from sqlalchemy import select
from sqlalchemy.sql.schema import Table
from sqlmodel import Session, SQLModel

from .. import models as _models  # noqa: F401
from ..shared.session import get_session

logger = logging.getLogger(__name__)


def _normalize_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, enum.Enum):
        return value.value
    return value


class DatabaseBackupJob:
    """Export relational tables to JSON and persist them to S3."""

    def __init__(
        self,
        *,
        bucket: str,
        prefix: str,
        s3_client=None,
        now: datetime | None = None,
    ) -> None:
        self.bucket = bucket
        self.prefix = prefix.strip("/")
        self.now = now or datetime.now(timezone.utc)
        self._s3 = s3_client or boto3.client("s3")

    @property
    def base_prefix(self) -> str:
        dated_prefix = self.now.strftime("%Y/%m")
        run_prefix = self.now.strftime("%Y-%m-%dT%H-%M-%SZ")
        parts = [self.prefix, dated_prefix, run_prefix]
        return "/".join(part for part in parts if part)

    def run(self) -> Dict[str, Any]:
        """Backup every mapped SQLModel table into the configured S3 bucket."""

        session = get_session()
        manifest: List[Dict[str, Any]] = []

        try:
            for table in SQLModel.metadata.sorted_tables:
                key = self._table_key(table.name)
                rows = self._fetch_table_rows(session, table)
                self._upload_json(key, rows)

                entry = {
                    "table": table.name,
                    "row_count": len(rows),
                    "s3_key": key,
                }
                logger.info("Backed up table %s to %s (%s rows)", table.name, key, len(rows))
                manifest.append(entry)

            manifest_key = f"{self.base_prefix}/manifest.json"
            manifest_payload = {
                "generated_at": self.now.isoformat(),
                "tables": manifest,
            }
            self._upload_json(manifest_key, manifest_payload)

            return {
                "bucket": self.bucket,
                "manifest_key": manifest_key,
                "tables": manifest,
            }
        finally:
            session.close()

    def _fetch_table_rows(self, session: Session, table: Table) -> List[Dict[str, Any]]:
        result = session.execute(select(table)).mappings()
        rows: List[Dict[str, Any]] = []
        for mapping in result:
            rows.append({key: _normalize_value(value) for key, value in dict(mapping).items()})

        return rows

    def _upload_json(self, key: str, payload: Any) -> None:
        body = json.dumps(payload, default=_normalize_value).encode("utf-8")
        self._s3.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=body,
            ContentType="application/json",
        )

    def _table_key(self, table_name: str) -> str:
        return f"{self.base_prefix}/{table_name}.json"


__all__ = ["DatabaseBackupJob"]
