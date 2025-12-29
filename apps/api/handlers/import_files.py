"""HTTP handlers for stored import files."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from ..schemas import ImportFileListResponse
from ..services.imports.files import ImportFileService
from ..shared import session_scope
from .utils import ensure_engine, get_user_id, json_response, parse_body


def list_import_files(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP GET /import-files"""

    ensure_engine()
    user_id = get_user_id(event)

    with session_scope(user_id=user_id) as session:
        service = ImportFileService(session)
        files = service.list_files()

    response = ImportFileListResponse.model_validate(files).model_dump(mode="json")
    return json_response(200, response)


def download_import_file(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /import-files/download"""

    ensure_engine()
    user_id = get_user_id(event)
    parsed_body = parse_body(event)

    if not isinstance(parsed_body, dict) or "file_id" not in parsed_body:
        return json_response(400, {"error": "file_id is required"})
    file_id = parsed_body["file_id"]

    try:
        with session_scope(user_id=user_id) as session:
            service = ImportFileService(session)
            result = service.build_download_url(file_id)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    except ValueError as exc:
        return json_response(400, {"error": str(exc)})

    return json_response(200, result)


__all__ = ["list_import_files", "download_import_file"]
