from __future__ import annotations

from decimal import Decimal

COVERS_SERVERLESS_FUNCTION = "updateLoan"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "PATCH"
COVERS_HTTP_PATH = "/loans/{accountId}"
COVERS_ROUTE = None


def test_updateLoan_integration(integration_context) -> None:
    context = integration_context
    data = context.create_loan()
    account_id = data["account"]["id"]
    body = context.call(
        "PATCH",
        f"/loans/{account_id}",
        {"interest_rate_annual": "0.04", "minimum_payment": "650.00"},
        expected=200,
    )
    assert Decimal(body["interest_rate_annual"]) == Decimal("0.04")
