from __future__ import annotations

from uuid import uuid4

import pytest
from botocore.exceptions import ClientError

import apps.api.services.imports.storage as storage_module
from apps.api.services.imports.storage import ImportFileStorage

# pylint: disable=protected-access


class _FakeClient:
    def __init__(self) -> None:
        self.put_calls: list[dict] = []
        self.url_calls: list[dict] = []

    def put_object(self, **kwargs):
        self.put_calls.append(kwargs)

    def generate_presigned_url(self, ClientMethod, Params, ExpiresIn):
        self.url_calls.append(
            {"ClientMethod": ClientMethod, "Params": Params, "ExpiresIn": ExpiresIn}
        )
        return "https://example.com/file name.xlsx?x=1&y=2"


def _client_error(operation: str) -> ClientError:
    return ClientError({"Error": {"Code": "InternalError", "Message": "boom"}}, operation)


def test_resolve_region_precedence(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("AWS_REGION", "eu-west-1")
    monkeypatch.setenv("AWS_DEFAULT_REGION", "us-east-1")
    assert storage_module._resolve_region() == "eu-west-1"

    monkeypatch.delenv("AWS_REGION", raising=False)
    assert storage_module._resolve_region() == "us-east-1"

    monkeypatch.delenv("AWS_DEFAULT_REGION", raising=False)
    assert storage_module._resolve_region() == "eu-north-1"


def test_from_env_requires_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(storage_module.IMPORT_FILES_BUCKET_ENV, raising=False)
    with pytest.raises(RuntimeError, match="bucket is not configured"):
        ImportFileStorage.from_env(client=_FakeClient())


def test_from_env_parses_prefix_expires_and_uses_builder(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(storage_module.IMPORT_FILES_BUCKET_ENV, "imports-bucket")
    monkeypatch.setenv(storage_module.IMPORT_FILES_PREFIX_ENV, " /uploads/ ")
    monkeypatch.setenv(storage_module.IMPORT_FILES_URL_EXPIRES_ENV, "30")
    built_client = _FakeClient()

    monkeypatch.setattr(storage_module, "_build_s3_client", lambda _region=None: built_client)
    storage = ImportFileStorage.from_env()
    assert storage.bucket == "imports-bucket"
    assert storage.prefix == "uploads"
    assert storage.url_expires_seconds == 60
    assert storage.client is built_client

    monkeypatch.setenv(storage_module.IMPORT_FILES_URL_EXPIRES_ENV, "invalid")
    storage_invalid = ImportFileStorage.from_env(client=_FakeClient())
    assert storage_invalid.url_expires_seconds == 900

    monkeypatch.delenv(storage_module.IMPORT_FILES_URL_EXPIRES_ENV, raising=False)
    storage_default = ImportFileStorage.from_env(client=_FakeClient())
    assert storage_default.url_expires_seconds == 900


def test_build_object_key_and_upload_download() -> None:
    client = _FakeClient()
    storage = ImportFileStorage(bucket="bucket", prefix="base", client=client)
    key = storage.build_object_key(
        user_id="user-1",
        batch_id=uuid4(),
        file_id=uuid4(),
        filename="bad / name?.xlsx",
    )
    assert key.startswith("base/imports/user-1/")
    assert key.endswith(".xlsx")

    storage.upload_file(key=key, content=b"hello")
    storage.upload_file(key=key, content=b"hello", content_type="application/vnd.ms-excel")
    assert len(client.put_calls) == 2
    assert "ContentType" not in client.put_calls[0]
    assert client.put_calls[1]["ContentType"] == "application/vnd.ms-excel"

    url = storage.create_download_url(key=key)
    assert "file%20name.xlsx" in url
    assert client.url_calls[0]["ClientMethod"] == "get_object"


def test_upload_and_download_raise_runtime_errors() -> None:
    class FailingClient:
        def put_object(self, **_kwargs):
            raise _client_error("PutObject")

        def generate_presigned_url(self, *_args, **_kwargs):
            raise _client_error("GetObject")

    storage = ImportFileStorage(bucket="bucket", client=FailingClient())
    with pytest.raises(RuntimeError, match="Unable to upload"):
        storage.upload_file(key="a", content=b"x")

    with pytest.raises(RuntimeError, match="Unable to generate download URL"):
        storage.create_download_url(key="a")


def test_build_s3_client_and_prefixless_key(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def _fake_client(service_name: str, **kwargs):
        captured["service_name"] = service_name
        captured["kwargs"] = kwargs
        return _FakeClient()

    monkeypatch.setattr(storage_module.boto3, "client", _fake_client)
    client = storage_module._build_s3_client("eu-north-1")
    assert isinstance(client, _FakeClient)
    assert captured["service_name"] == "s3"
    assert captured["kwargs"]["region_name"] == "eu-north-1"

    storage = ImportFileStorage(bucket="bucket", prefix="", client=_FakeClient())
    key = storage.build_object_key(
        user_id="user",
        batch_id=uuid4(),
        file_id=uuid4(),
        filename="",
    )
    assert key.startswith("imports/user/")
