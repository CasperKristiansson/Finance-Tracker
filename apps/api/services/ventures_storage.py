"""S3 presigned URL helper for Ventures logos and documents."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Any, Optional, Protocol, cast
from urllib.parse import quote
from uuid import UUID, uuid4

import boto3
from botocore.exceptions import BotoCoreError, ClientError

VENTURES_BUCKET_ENV = "VENTURES_BUCKET"
VENTURES_PREFIX_ENV = "VENTURES_PREFIX"
VENTURES_URL_EXPIRES_ENV = "VENTURES_URL_EXPIRES_SECONDS"

DEFAULT_EXPIRES_SECONDS = 900
LOGO_MAX_BYTES = 5 * 1024 * 1024
DOCUMENT_MAX_BYTES = 25 * 1024 * 1024

ALLOWED_LOGO_MIME_TYPES = {"image/png", "image/jpeg", "image/webp"}
ALLOWED_DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "image/png",
    "image/jpeg",
    "image/webp",
}
BLOCKED_EXTENSIONS = {
    ".7z",
    ".apk",
    ".app",
    ".bat",
    ".bin",
    ".cmd",
    ".com",
    ".dmg",
    ".exe",
    ".gz",
    ".js",
    ".jar",
    ".msi",
    ".ps1",
    ".rar",
    ".sh",
    ".svg",
    ".tar",
    ".zip",
}


def _resolve_region() -> Optional[str]:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-north-1"


class S3Client(Protocol):
    def generate_presigned_url(
        self, ClientMethod: str, Params: dict[str, Any], ExpiresIn: int
    ) -> str: ...


def _build_s3_client(region: Optional[str] = None) -> S3Client:
    resolved_region = region or _resolve_region()
    client = boto3.client(
        "s3",
        region_name=resolved_region,
        endpoint_url=f"https://s3.{resolved_region}.amazonaws.com",
    )
    return cast(S3Client, client)


def _safe_filename(filename: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]+", "-", filename or "").strip("-") or "file"


def _extension(filename: str) -> str:
    _, dot, ext = filename.rpartition(".")
    return f".{ext.lower()}" if dot else ""


@dataclass(slots=True)
class VentureStorage:
    """Build object keys and presigned URLs for venture assets."""

    bucket: str
    prefix: str = ""
    url_expires_seconds: int = DEFAULT_EXPIRES_SECONDS
    client: S3Client = field(default_factory=_build_s3_client)

    @classmethod
    def from_env(cls, *, client: Optional[S3Client] = None) -> "VentureStorage":
        bucket = os.getenv(VENTURES_BUCKET_ENV)
        if not bucket:
            raise RuntimeError("Ventures storage bucket is not configured")

        prefix = (os.getenv(VENTURES_PREFIX_ENV) or "").strip().strip("/")
        expires = DEFAULT_EXPIRES_SECONDS
        expires_raw = os.getenv(VENTURES_URL_EXPIRES_ENV)
        if expires_raw:
            try:
                expires = max(60, int(expires_raw))
            except ValueError:
                expires = DEFAULT_EXPIRES_SECONDS

        return cls(
            bucket=bucket,
            prefix=prefix,
            url_expires_seconds=expires,
            client=client or _build_s3_client(_resolve_region()),
        )

    def validate_upload(
        self, *, purpose: str, file_name: str, mime_type: str, size_bytes: int
    ) -> None:
        ext = _extension(file_name)
        if ext in BLOCKED_EXTENSIONS or mime_type == "image/svg+xml":
            raise ValueError("File type is not allowed for Ventures uploads")

        if purpose == "logo":
            if mime_type not in ALLOWED_LOGO_MIME_TYPES:
                raise ValueError("Logo MIME type must be PNG, JPEG, or WebP")
            if size_bytes > LOGO_MAX_BYTES:
                raise ValueError("Logo uploads are limited to 5 MB")
            return

        if purpose == "document":
            if mime_type not in ALLOWED_DOCUMENT_MIME_TYPES:
                raise ValueError("Document MIME type is not allowed")
            if size_bytes > DOCUMENT_MAX_BYTES:
                raise ValueError("Document uploads are limited to 25 MB")
            return

        raise ValueError("Unknown Ventures upload purpose")

    def build_object_key(
        self, *, user_id: str, company_id: UUID | None, purpose: str, file_name: str
    ) -> str:
        asset_id = uuid4()
        safe_name = _safe_filename(file_name)
        company_part = str(company_id) if company_id is not None else "pending"
        parts = ["ventures", user_id, company_part, purpose, f"{asset_id}_{safe_name}"]
        key = "/".join(parts)
        if self.prefix:
            return f"{self.prefix}/{key}"
        return key

    def user_key_prefix(self, *, user_id: str) -> str:
        """Return the S3 key prefix owned by a user inside the Ventures bucket."""

        key_prefix = f"ventures/{user_id}/"
        if self.prefix:
            return f"{self.prefix}/{key_prefix}"
        return key_prefix

    def is_user_key(self, *, user_id: str, key: str) -> bool:
        return key.startswith(self.user_key_prefix(user_id=user_id))

    def create_upload_url(self, *, key: str, mime_type: str) -> str:
        try:
            url = self.client.generate_presigned_url(
                "put_object",
                Params={"Bucket": self.bucket, "Key": key, "ContentType": mime_type},
                ExpiresIn=self.url_expires_seconds,
            )
            return quote(url, safe=":/?&=%")
        except (BotoCoreError, ClientError) as exc:
            raise RuntimeError("Unable to generate upload URL for venture file") from exc

    def create_download_url(self, *, key: str) -> str:
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=self.url_expires_seconds,
            )
            return quote(url, safe=":/?&=%")
        except (BotoCoreError, ClientError) as exc:
            raise RuntimeError("Unable to generate download URL for venture file") from exc


__all__ = [
    "VentureStorage",
    "VENTURES_BUCKET_ENV",
    "VENTURES_PREFIX_ENV",
    "VENTURES_URL_EXPIRES_ENV",
    "ALLOWED_LOGO_MIME_TYPES",
    "ALLOWED_DOCUMENT_MIME_TYPES",
    "LOGO_MAX_BYTES",
    "DOCUMENT_MAX_BYTES",
]
