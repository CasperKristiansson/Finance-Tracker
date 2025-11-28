"""Lightweight endpoint to wake the Aurora cluster before other requests run."""

from __future__ import annotations

import logging
from typing import Any, Dict

from sqlalchemy import text
from sqlalchemy.exc import OperationalError, SQLAlchemyError

from ..shared import session_scope
from .utils import ensure_engine, json_response

logger = logging.getLogger(__name__)


def warm_database(_event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Ping the database so Aurora can scale up from zero."""

    ensure_engine()
    try:
        with session_scope() as session:
            session.execute(text("SELECT 1"))
        return json_response(200, {"status": "ready"})
    except OperationalError as exc:
        logger.info("Database is still waking up: %s", exc)
        return json_response(
            503,
            {
                "status": "starting",
                "message": "Database is scaling up. Retrying shortly usually succeeds.",
            },
        )
    except SQLAlchemyError as exc:  # pragma: no cover - defensive branch
        logger.exception("Database warmup failed")
        return json_response(
            500,
            {"status": "error", "message": f"Unexpected error: {exc.__class__.__name__}"},
        )
