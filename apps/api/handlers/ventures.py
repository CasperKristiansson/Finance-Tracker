"""Serverless HTTP handlers for Ventures."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from ..schemas import (
    VentureCompanyCreateRequest,
    VentureCompanyUpdateRequest,
    VentureDocumentCreateRequest,
    VentureGraphLayoutUpdateRequest,
    VentureNoteCreateRequest,
    VentureNoteUpdateRequest,
    VentureOwnershipCreateRequest,
    VenturePresignRequest,
    VentureValuationCreateRequest,
)
from ..services import VentureService
from ..shared import session_scope
from .utils import (
    ensure_engine,
    extract_path_uuid,
    get_user_id,
    json_response,
    parse_body,
    reset_engine_state,
)


def reset_handler_state() -> None:
    """Reset internal handler state for tests."""

    reset_engine_state()


def _company_id(event: Dict[str, Any]):
    return extract_path_uuid(event, param_names=("companyId", "company_id"))


def _note_id(event: Dict[str, Any]):
    return extract_path_uuid(event, param_names=("noteId", "note_id"))


def _document_id(event: Dict[str, Any]):
    return extract_path_uuid(event, param_names=("documentId", "document_id"))


def ventures_overview(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP GET /ventures/overview."""

    ensure_engine()
    user_id = get_user_id(event)
    with session_scope(user_id=user_id) as session:
        response = VentureService(session).overview().model_dump(mode="json")
    return json_response(200, response)


def create_venture_company(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /ventures/companies."""

    ensure_engine()
    user_id = get_user_id(event)
    try:
        data = VentureCompanyCreateRequest.model_validate(parse_body(event))
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    try:
        with session_scope(user_id=user_id) as session:
            response = VentureService(session).create_company(data).model_dump(mode="json")
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    except ValueError as exc:
        return json_response(400, {"error": str(exc)})
    return json_response(201, response)


def get_venture_company(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP GET /ventures/companies/{companyId}."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    if company_id is None:
        return json_response(400, {"error": "Company ID missing from path"})
    try:
        with session_scope(user_id=user_id) as session:
            response = VentureService(session).company_detail(company_id).model_dump(mode="json")
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(200, response)


def update_venture_company(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP PATCH /ventures/companies/{companyId}."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    if company_id is None:
        return json_response(400, {"error": "Company ID missing from path"})
    try:
        data = VentureCompanyUpdateRequest.model_validate(parse_body(event))
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})
    try:
        with session_scope(user_id=user_id) as session:
            response = (
                VentureService(session).update_company(company_id, data).model_dump(mode="json")
            )
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(200, response)


def delete_venture_company(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP DELETE /ventures/companies/{companyId}."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    if company_id is None:
        return json_response(400, {"error": "Company ID missing from path"})
    try:
        with session_scope(user_id=user_id) as session:
            response = VentureService(session).delete_company(company_id).model_dump(mode="json")
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(200, response)


def create_venture_valuation(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /ventures/companies/{companyId}/valuations."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    if company_id is None:
        return json_response(400, {"error": "Company ID missing from path"})
    try:
        data = VentureValuationCreateRequest.model_validate(parse_body(event))
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})
    try:
        with session_scope(user_id=user_id) as session:
            response = (
                VentureService(session).add_valuation(company_id, data).model_dump(mode="json")
            )
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(201, response)


def create_venture_ownership_event(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /ventures/companies/{companyId}/ownership-events."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    if company_id is None:
        return json_response(400, {"error": "Company ID missing from path"})
    try:
        data = VentureOwnershipCreateRequest.model_validate(parse_body(event))
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})
    try:
        with session_scope(user_id=user_id) as session:
            response = (
                VentureService(session).add_ownership(company_id, data).model_dump(mode="json")
            )
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    except ValueError as exc:
        return json_response(400, {"error": str(exc)})
    return json_response(201, response)


def list_venture_notes(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP GET /ventures/companies/{companyId}/notes."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    if company_id is None:
        return json_response(400, {"error": "Company ID missing from path"})
    try:
        with session_scope(user_id=user_id) as session:
            response = VentureService(session).list_notes(company_id).model_dump(mode="json")
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(200, response)


def create_venture_note(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /ventures/companies/{companyId}/notes."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    if company_id is None:
        return json_response(400, {"error": "Company ID missing from path"})
    try:
        data = VentureNoteCreateRequest.model_validate(parse_body(event))
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})
    try:
        with session_scope(user_id=user_id) as session:
            response = VentureService(session).create_note(company_id, data).model_dump(mode="json")
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(201, response)


def update_venture_note(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP PATCH /ventures/companies/{companyId}/notes/{noteId}."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    note_id = _note_id(event)
    if company_id is None or note_id is None:
        return json_response(400, {"error": "Company ID or note ID missing from path"})
    try:
        data = VentureNoteUpdateRequest.model_validate(parse_body(event))
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})
    try:
        with session_scope(user_id=user_id) as session:
            response = (
                VentureService(session)
                .update_note(company_id, note_id, data)
                .model_dump(mode="json")
            )
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(200, response)


def delete_venture_note(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP DELETE /ventures/companies/{companyId}/notes/{noteId}."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    note_id = _note_id(event)
    if company_id is None or note_id is None:
        return json_response(400, {"error": "Company ID or note ID missing from path"})
    try:
        with session_scope(user_id=user_id) as session:
            response = (
                VentureService(session).delete_note(company_id, note_id).model_dump(mode="json")
            )
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(200, response)


def list_venture_documents(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP GET /ventures/companies/{companyId}/documents."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    if company_id is None:
        return json_response(400, {"error": "Company ID missing from path"})
    try:
        with session_scope(user_id=user_id) as session:
            response = VentureService(session).list_documents(company_id).model_dump(mode="json")
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(200, response)


def create_venture_document(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /ventures/companies/{companyId}/documents."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    if company_id is None:
        return json_response(400, {"error": "Company ID missing from path"})
    try:
        data = VentureDocumentCreateRequest.model_validate(parse_body(event))
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})
    try:
        with session_scope(user_id=user_id) as session:
            response = (
                VentureService(session).create_document(company_id, data).model_dump(mode="json")
            )
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(201, response)


def delete_venture_document(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP DELETE /ventures/companies/{companyId}/documents/{documentId}."""

    ensure_engine()
    user_id = get_user_id(event)
    company_id = _company_id(event)
    document_id = _document_id(event)
    if company_id is None or document_id is None:
        return json_response(400, {"error": "Company ID or document ID missing from path"})
    try:
        with session_scope(user_id=user_id) as session:
            response = (
                VentureService(session)
                .delete_document(
                    company_id,
                    document_id,
                )
                .model_dump(mode="json")
            )
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(200, response)


def update_venture_layout(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP PATCH /ventures/layout."""

    ensure_engine()
    user_id = get_user_id(event)
    try:
        data = VentureGraphLayoutUpdateRequest.model_validate(parse_body(event))
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})
    try:
        with session_scope(user_id=user_id) as session:
            response = VentureService(session).save_graph_layout(data).model_dump(mode="json")
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    return json_response(200, response)


def presign_venture_upload(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """HTTP POST /ventures/uploads/presign."""

    ensure_engine()
    user_id = get_user_id(event)
    try:
        data = VenturePresignRequest.model_validate(parse_body(event))
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})
    try:
        with session_scope(user_id=user_id) as session:
            response = VentureService(session).presign(user_id, data).model_dump(mode="json")
    except LookupError as exc:
        return json_response(404, {"error": str(exc)})
    except (RuntimeError, ValueError) as exc:
        return json_response(400, {"error": str(exc)})
    return json_response(200, response)


__all__ = [
    "reset_handler_state",
    "ventures_overview",
    "create_venture_company",
    "get_venture_company",
    "update_venture_company",
    "delete_venture_company",
    "create_venture_valuation",
    "create_venture_ownership_event",
    "list_venture_notes",
    "create_venture_note",
    "update_venture_note",
    "delete_venture_note",
    "list_venture_documents",
    "create_venture_document",
    "delete_venture_document",
    "update_venture_layout",
    "presign_venture_upload",
]
