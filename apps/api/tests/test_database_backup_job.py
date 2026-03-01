from __future__ import annotations

import enum
import json
from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from typing import Any, cast
from uuid import UUID

import pytest

import apps.api.jobs.database_backup as backup_module
from apps.api.jobs.database_backup import DatabaseBackupJob, _normalize_value

# pylint: disable=protected-access


class _FakeS3Client:
    def __init__(self) -> None:
        self.put_calls: list[dict] = []

    def put_object(self, **kwargs) -> None:
        self.put_calls.append(kwargs)


class _FakeSession:
    def __init__(self) -> None:
        self.closed = False

    def close(self) -> None:
        self.closed = True


class _Flavor(enum.Enum):
    VANILLA = "vanilla"


def test_normalize_value_converts_supported_types() -> None:
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    today = date(2026, 1, 1)
    amount = Decimal("12.34")
    uid = UUID(int=42)

    assert _normalize_value(now) == now.isoformat()
    assert _normalize_value(today) == today.isoformat()
    assert _normalize_value(amount) == "12.34"
    assert _normalize_value(uid) == str(uid)
    assert _normalize_value(_Flavor.VANILLA) == "vanilla"
    assert _normalize_value("raw") == "raw"


def test_base_prefix_and_table_key_formatting() -> None:
    s3 = _FakeS3Client()
    now = datetime(2026, 3, 5, 7, 8, 9, tzinfo=timezone.utc)
    job = DatabaseBackupJob(bucket="bucket", prefix="/monthly/", s3_client=s3, now=now)

    assert job.base_prefix == "monthly/2026/03/2026-03-05T07-08-09Z"
    assert job._table_key("accounts").endswith("/accounts.json")


def test_upload_json_serializes_payload() -> None:
    s3 = _FakeS3Client()
    job = DatabaseBackupJob(
        bucket="bucket",
        prefix="backups",
        s3_client=s3,
        now=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )

    job._upload_json("path/data.json", {"amount": Decimal("1.50")})

    assert len(s3.put_calls) == 1
    call = s3.put_calls[0]
    assert call["Bucket"] == "bucket"
    assert call["Key"] == "path/data.json"
    assert call["ContentType"] == "application/json"
    assert json.loads(call["Body"].decode("utf-8")) == {"amount": "1.50"}


def test_fetch_table_rows_normalizes_values(monkeypatch: pytest.MonkeyPatch) -> None:
    class FakeResult:
        def mappings(self):
            return [{"id": UUID(int=1), "amount": Decimal("9.99")}]

    class FakeSession:
        def execute(self, _statement):
            return FakeResult()

    monkeypatch.setattr(backup_module, "select", lambda _table: object())

    table = SimpleNamespace(name="transactions")
    s3 = _FakeS3Client()
    job = DatabaseBackupJob(bucket="bucket", prefix="backup", s3_client=s3)

    rows = job._fetch_table_rows(cast(Any, FakeSession()), cast(Any, table))

    assert rows == [{"id": str(UUID(int=1)), "amount": "9.99"}]


def test_select_tables_filters_requested_and_logs_missing(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    tables = [SimpleNamespace(name="accounts"), SimpleNamespace(name="transactions")]
    fake_sqlmodel = SimpleNamespace(metadata=SimpleNamespace(sorted_tables=tables))
    monkeypatch.setattr(backup_module, "SQLModel", fake_sqlmodel)
    job = DatabaseBackupJob(bucket="bucket", prefix="backups", s3_client=_FakeS3Client())

    with caplog.at_level("WARNING"):
        selected = job._select_tables(["transactions", "missing_table"])

    assert [table.name for table in selected] == ["transactions"]
    assert "Skipping unknown tables" in caplog.text


def test_select_tables_returns_all_when_no_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    tables = [SimpleNamespace(name="accounts"), SimpleNamespace(name="transactions")]
    fake_sqlmodel = SimpleNamespace(metadata=SimpleNamespace(sorted_tables=tables))
    monkeypatch.setattr(backup_module, "SQLModel", fake_sqlmodel)
    job = DatabaseBackupJob(bucket="bucket", prefix="backups", s3_client=_FakeS3Client())

    selected = job._select_tables(None)

    assert selected == tables


def test_select_tables_uses_constructor_table_names(monkeypatch: pytest.MonkeyPatch) -> None:
    tables = [SimpleNamespace(name="accounts"), SimpleNamespace(name="transactions")]
    fake_sqlmodel = SimpleNamespace(metadata=SimpleNamespace(sorted_tables=tables))
    monkeypatch.setattr(backup_module, "SQLModel", fake_sqlmodel)
    job = DatabaseBackupJob(
        bucket="bucket",
        prefix="backups",
        s3_client=_FakeS3Client(),
        table_names=["accounts"],
    )

    selected = job._select_tables(None)

    assert [table.name for table in selected] == ["accounts"]


def test_run_uploads_tables_and_manifest(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _FakeSession()
    now = datetime(2026, 2, 3, 4, 5, 6, tzinfo=timezone.utc)
    uploads: list[tuple[str, object]] = []
    selected_tables = [SimpleNamespace(name="accounts"), SimpleNamespace(name="transactions")]

    monkeypatch.setattr(backup_module, "get_session", lambda: session)
    job = DatabaseBackupJob(bucket="snapshots", prefix="db", s3_client=_FakeS3Client(), now=now)
    monkeypatch.setattr(job, "_select_tables", lambda _override: selected_tables)
    monkeypatch.setattr(job, "_fetch_table_rows", lambda _session, table: [{"table": table.name}])
    monkeypatch.setattr(job, "_upload_json", lambda key, payload: uploads.append((key, payload)))

    result = job.run()

    assert session.closed is True
    assert result["bucket"] == "snapshots"
    assert result["manifest_key"] == "db/2026/02/2026-02-03T04-05-06Z/manifest.json"
    assert [entry["table"] for entry in result["tables"]] == ["accounts", "transactions"]
    assert result["tables"][0]["row_count"] == 1
    assert uploads[0][0].endswith("/accounts.json")
    assert uploads[1][0].endswith("/transactions.json")
    assert uploads[2][0].endswith("/manifest.json")


def test_run_passes_override_table_names_to_selector(monkeypatch: pytest.MonkeyPatch) -> None:
    session = _FakeSession()
    captured: dict[str, object] = {}
    monkeypatch.setattr(backup_module, "get_session", lambda: session)
    job = DatabaseBackupJob(bucket="snapshots", prefix="db", s3_client=_FakeS3Client())

    def fake_select_tables(override):
        captured["override"] = override
        return []

    monkeypatch.setattr(job, "_select_tables", fake_select_tables)
    monkeypatch.setattr(job, "_upload_json", lambda _key, _payload: None)

    result = job.run(table_names=["accounts"])

    assert captured["override"] == ["accounts"]
    assert not result["tables"]
    assert session.closed is True
