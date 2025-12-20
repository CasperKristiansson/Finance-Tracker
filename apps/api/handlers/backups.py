"""Scheduled handler to export database snapshots to S3."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict

from ..jobs.database_backup import DatabaseBackupJob
from .utils import ensure_engine

logger = logging.getLogger(__name__)


def run_database_backup(_event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Entrypoint for the monthly backup EventBridge rule."""

    ensure_engine()
    bucket = os.getenv("BACKUP_BUCKET_NAME")
    prefix = os.getenv("BACKUP_PREFIX", "database-backups")

    if not bucket:
        logger.error("BACKUP_BUCKET_NAME is not configured; aborting backup run.")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "BACKUP_BUCKET_NAME is not configured"}),
        }

    job = DatabaseBackupJob(bucket=bucket, prefix=prefix)
    result = job.run()

    return {
        "statusCode": 200,
        "body": json.dumps(result),
    }


__all__ = ["run_database_backup"]
