"""User settings endpoints backed by persistent storage."""

from __future__ import annotations

from typing import Any, Dict

from pydantic import ValidationError

from ..schemas import SettingsPayload, SettingsRequest, SettingsResponse
from ..services import SettingsService
from ..shared import session_scope
from .utils import ensure_engine, get_user_id, json_response, parse_body, reset_engine_state


def reset_handler_state() -> None:
    """Reset cached engine state for tests."""

    reset_engine_state()


def _to_response_payload(payload: SettingsPayload) -> Dict[str, Any]:
    response = SettingsResponse(settings=payload)
    return response.model_dump(mode="json")


def get_settings(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Return stored settings for the requesting user."""

    ensure_engine()
    user_id = get_user_id(event)

    with session_scope(user_id=user_id) as session:
        service = SettingsService(session)
        settings = service.get_settings(user_id)
        theme = settings.theme
        first_name = settings.first_name
        last_name = settings.last_name

    payload = SettingsPayload(theme=theme, first_name=first_name, last_name=last_name)
    return json_response(200, _to_response_payload(payload))


def save_settings(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Persist incoming settings for the requesting user."""

    ensure_engine()
    user_id = get_user_id(event)
    body = parse_body(event)

    try:
        request = SettingsRequest.model_validate(body)
    except ValidationError as exc:
        return json_response(400, {"error": exc.errors()})

    payload = request.settings

    with session_scope(user_id=user_id) as session:
        service = SettingsService(session)
        updated = service.update_settings(
            user_id,
            theme=payload.theme,
            first_name=payload.first_name,
            last_name=payload.last_name,
        )
        theme = updated.theme
        first_name = updated.first_name
        last_name = updated.last_name

    response_payload = SettingsPayload(theme=theme, first_name=first_name, last_name=last_name)
    return json_response(200, _to_response_payload(response_payload))
