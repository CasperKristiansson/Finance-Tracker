"""S3-backed storage helper for import files."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Any, Optional, Protocol, cast
from urllib.parse import quote
from uuid import UUID

import boto3
from botocore.exceptions import BotoCoreError, ClientError

IMPORT_FILES_BUCKET_ENV = "IMPORT_FILES_BUCKET"
IMPORT_FILES_PREFIX_ENV = "IMPORT_FILES_PREFIX"
IMPORT_FILES_URL_EXPIRES_ENV = "IMPORT_FILES_URL_EXPIRES_SECONDS"

_DEFAULT_EXPIRES_SECONDS = 900


def _resolve_region() -> Optional[str]:
    return os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION") or "eu-north-1"


class S3Client(Protocol):
    def put_object(self, **kwargs: Any) -> Any: ...

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


@dataclass(slots=True)
class ImportFileStorage:
    """Utility for uploading and serving import files from S3."""

    bucket: str
    prefix: str = ""
    url_expires_seconds: int = _DEFAULT_EXPIRES_SECONDS
    client: S3Client = field(default_factory=_build_s3_client)

    @classmethod
    def from_env(cls, *, client: Optional[S3Client] = None) -> "ImportFileStorage":
        bucket = os.getenv(IMPORT_FILES_BUCKET_ENV)
        if not bucket:
            raise RuntimeError("Import file storage bucket is not configured")

        region = _resolve_region()
        prefix = (os.getenv(IMPORT_FILES_PREFIX_ENV) or "").strip().strip("/")
        expires_raw = os.getenv(IMPORT_FILES_URL_EXPIRES_ENV)
        expires = _DEFAULT_EXPIRES_SECONDS
        if expires_raw:
            try:
                expires = max(60, int(expires_raw))
            except ValueError:
                expires = _DEFAULT_EXPIRES_SECONDS

        return cls(
            bucket=bucket,
            prefix=prefix,
            url_expires_seconds=expires,
            client=client or _build_s3_client(region),
        )

    def build_object_key(
        self, *, user_id: str, batch_id: UUID, file_id: UUID, filename: str
    ) -> str:
        safe_filename = re.sub(r"[^A-Za-z0-9_.-]+", "-", filename or "").strip("-") or str(file_id)
        parts = ["imports", user_id, str(batch_id), f"{file_id}_{safe_filename}"]
        key = "/".join(parts)
        if self.prefix:
            return f"{self.prefix}/{key}"
        return key

    def upload_file(self, *, key: str, content: bytes, content_type: str | None = None) -> None:
        try:
            kwargs = {"Bucket": self.bucket, "Key": key, "Body": content}
            if content_type:
                kwargs["ContentType"] = content_type
            self.client.put_object(**kwargs)
        except (BotoCoreError, ClientError) as exc:
            raise RuntimeError("Unable to upload import file to storage") from exc

    def create_download_url(self, *, key: str) -> str:
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=self.url_expires_seconds,
            )
            return quote(url, safe=":/?&=%")
        except (BotoCoreError, ClientError) as exc:
            raise RuntimeError("Unable to generate download URL for import file") from exc


__all__ = [
    "ImportFileStorage",
    "IMPORT_FILES_BUCKET_ENV",
    "IMPORT_FILES_PREFIX_ENV",
    "IMPORT_FILES_URL_EXPIRES_ENV",
]
