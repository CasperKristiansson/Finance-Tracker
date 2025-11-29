"""Lightweight settings endpoints.

These are intentionally minimal and return a stubbed payload so the frontend
can hydrate without a hard dependency on a stored record. Persisting per-user
settings can be added later by backing these functions with a repository.
"""

from __future__ import annotations

from typing import Any, Dict

from .utils import json_response, parse_body


def get_settings(_event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Return a default settings payload."""

    return json_response(
        200,
        {
            "settings": {
                "theme": "system",
            }
        },
    )


def save_settings(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Accept and echo settings payload (stub implementation)."""

    body = parse_body(event)
    settings = body.get("settings") or {}

    # Only allow known keys; ignore others for safety.
    theme = settings.get("theme") if isinstance(settings, dict) else None
    response_settings: Dict[str, Any] = {}
    if isinstance(theme, str) and theme in {"light", "dark", "system"}:
        response_settings["theme"] = theme
    else:
        response_settings["theme"] = "system"

    return json_response(
        200,
        {
            "settings": response_settings,
        },
    )
