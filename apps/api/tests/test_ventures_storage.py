from __future__ import annotations

from uuid import uuid4

import pytest

import apps.api.services.ventures_storage as storage_module
from apps.api.schemas.ventures import VenturePresignRequest
from apps.api.services.ventures_storage import VentureStorage


class _FakeClient:
    def __init__(self) -> None:
        self.calls: list[dict] = []

    def generate_presigned_url(self, ClientMethod, Params, ExpiresIn):
        self.calls.append({"ClientMethod": ClientMethod, "Params": Params, "ExpiresIn": ExpiresIn})
        return "https://example.com/file name.pdf?x=1"


def test_venture_storage_env_and_presigned_urls(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(storage_module.VENTURES_BUCKET_ENV, "ventures-bucket")
    monkeypatch.setenv(storage_module.VENTURES_PREFIX_ENV, "/private/")
    monkeypatch.setenv(storage_module.VENTURES_URL_EXPIRES_ENV, "30")
    client = _FakeClient()

    storage = VentureStorage.from_env(client=client)
    assert storage.bucket == "ventures-bucket"
    assert storage.prefix == "private"
    assert storage.url_expires_seconds == 60

    key = storage.build_object_key(
        user_id="user",
        company_id=uuid4(),
        purpose="document",
        file_name="safe file.pdf",
    )
    assert key.startswith("private/ventures/user/")
    assert key.endswith(".pdf")
    assert storage.is_user_key(user_id="user", key=key)
    assert not storage.is_user_key(user_id="other", key=key)

    upload_url = storage.create_upload_url(key=key, mime_type="application/pdf")
    download_url = storage.create_download_url(key=key)
    assert "file%20name.pdf" in upload_url
    assert "file%20name.pdf" in download_url
    assert client.calls[0]["ClientMethod"] == "put_object"
    assert client.calls[1]["ClientMethod"] == "get_object"

    pending_logo_key = storage.build_object_key(
        user_id="user",
        company_id=None,
        purpose="logo",
        file_name="logo.png",
    )
    assert pending_logo_key.startswith("private/ventures/user/pending/logo/")
    assert storage.is_user_key(user_id="user", key=pending_logo_key)


def test_venture_storage_validation_blocks_bad_files() -> None:
    storage = VentureStorage(bucket="bucket", client=_FakeClient())
    storage.validate_upload(
        purpose="logo",
        file_name="logo.webp",
        mime_type="image/webp",
        size_bytes=1024,
    )
    storage.validate_upload(
        purpose="document",
        file_name="memo.pdf",
        mime_type="application/pdf",
        size_bytes=1024,
    )

    with pytest.raises(ValueError, match="not allowed"):
        storage.validate_upload(
            purpose="document",
            file_name="script.exe",
            mime_type="application/octet-stream",
            size_bytes=1024,
        )
    with pytest.raises(ValueError, match="not allowed"):
        storage.validate_upload(
            purpose="logo",
            file_name="logo.svg",
            mime_type="image/svg+xml",
            size_bytes=1024,
        )


def test_venture_presign_download_defaults_to_document_purpose() -> None:
    request = VenturePresignRequest.model_validate(
        {"operation": "download", "storage_key": "ventures/user/company/file.pdf"}
    )

    assert request.purpose == "document"
