"""Pre token generation trigger to block unapproved Cognito users."""

from __future__ import annotations

import logging
import os
from typing import Any, Dict, Optional

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

APPROVAL_ATTRIBUTE = os.getenv("APPROVAL_ATTRIBUTE", "custom:approved")
PENDING_ERROR = "USER_NOT_APPROVED"

_cognito = boto3.client("cognito-idp")


def _is_approved(raw_value: Optional[str]) -> bool:
    """Normalize Cognito boolean strings to a Python boolean."""

    if raw_value is None:
        return False
    return str(raw_value).strip().lower() in {"1", "true", "yes", "y"}


def _initialize_attribute_if_missing(
    user_pool_id: Optional[str],
    username: Optional[str],
    current_value: Optional[str],
) -> Optional[str]:
    """Ensure the approval flag exists for visibility in the console."""

    if current_value is not None or not user_pool_id or not username:
        return current_value

    try:
        _cognito.admin_update_user_attributes(
            UserPoolId=user_pool_id,
            Username=username,
            UserAttributes=[{"Name": APPROVAL_ATTRIBUTE, "Value": "false"}],
        )
        return "false"
    except ClientError as exc:  # pragma: no cover - defensive logging only
        logger.warning(
            "Could not initialize approval flag for %s: %s", username, exc
        )
        return current_value


def lambda_handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Reject token issuance until an admin approves the user."""

    user_pool_id = event.get("userPoolId")
    username = event.get("userName")
    attributes = (event.get("request") or {}).get("userAttributes") or {}

    raw_value = attributes.get(APPROVAL_ATTRIBUTE)
    raw_value = _initialize_attribute_if_missing(
        user_pool_id, username, raw_value
    )

    if not _is_approved(raw_value):
        logger.info("Blocking tokens for unapproved user %s", username)
        raise Exception(PENDING_ERROR)

    return event
