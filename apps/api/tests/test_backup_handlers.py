from __future__ import annotations

import json

import pytest

from apps.api.handlers.backups import run_database_backup, run_transactions_backup


def _json_body(response: dict) -> dict:
    return json.loads(response["body"])


def test_run_database_backup_requires_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BACKUP_BUCKET_NAME", raising=False)
    monkeypatch.delenv("BACKUP_PREFIX", raising=False)
    monkeypatch.setattr("apps.api.handlers.backups.ensure_engine", lambda: None)

    response = run_database_backup({}, None)

    assert response["statusCode"] == 500
    assert _json_body(response)["error"] == "BACKUP_BUCKET_NAME is not configured"


def test_run_transactions_backup_requires_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("BACKUP_BUCKET_NAME", raising=False)
    monkeypatch.delenv("BACKUP_PREFIX", raising=False)
    monkeypatch.setattr("apps.api.handlers.backups.ensure_engine", lambda: None)

    response = run_transactions_backup({}, None)

    assert response["statusCode"] == 500
    assert response["headers"]["Content-Type"] == "application/json"
    assert _json_body(response)["error"] == "BACKUP_BUCKET_NAME is not configured"


def test_run_database_backup_runs_job_with_default_prefix(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: dict[str, object] = {}

    class StubJob:
        def __init__(self, *, bucket: str, prefix: str) -> None:
            calls["bucket"] = bucket
            calls["prefix"] = prefix

        def run(self) -> dict:
            return {"ok": True, "tables": 3}

    monkeypatch.setenv("BACKUP_BUCKET_NAME", "snapshot-bucket")
    monkeypatch.delenv("BACKUP_PREFIX", raising=False)
    monkeypatch.setattr("apps.api.handlers.backups.ensure_engine", lambda: None)
    monkeypatch.setattr("apps.api.handlers.backups.DatabaseBackupJob", StubJob)

    response = run_database_backup({}, None)

    assert calls == {"bucket": "snapshot-bucket", "prefix": "database-backups"}
    assert response["statusCode"] == 200
    assert _json_body(response) == {"ok": True, "tables": 3}


def test_run_transactions_backup_runs_job_with_custom_prefix(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: dict[str, object] = {}

    class StubJob:
        def __init__(self, *, bucket: str, prefix: str) -> None:
            calls["bucket"] = bucket
            calls["prefix"] = prefix

        def run(self) -> dict:
            return {"manifest_key": "x/y/manifest.json"}

    monkeypatch.setenv("BACKUP_BUCKET_NAME", "snapshot-bucket")
    monkeypatch.setenv("BACKUP_PREFIX", "monthly")
    monkeypatch.setattr("apps.api.handlers.backups.ensure_engine", lambda: None)
    monkeypatch.setattr("apps.api.handlers.backups.DatabaseBackupJob", StubJob)

    response = run_transactions_backup({}, None)

    assert calls == {"bucket": "snapshot-bucket", "prefix": "monthly"}
    assert response["statusCode"] == 200
    assert response["headers"]["Content-Type"] == "application/json"
    assert _json_body(response) == {"manifest_key": "x/y/manifest.json"}
