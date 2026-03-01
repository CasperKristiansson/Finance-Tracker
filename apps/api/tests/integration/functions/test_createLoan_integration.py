from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "createLoan"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/loans"
COVERS_ROUTE = None


def test_createLoan_integration(integration_context) -> None:
    context = integration_context
    data = context.create_loan()
    account_id = data["account"]["id"]
    response = context.call_raw(
        "POST",
        "/loans",
        {
            "account_id": account_id,
            "origin_principal": "9000.00",
            "current_principal": "9000.00",
            "interest_rate_annual": "0.031",
            "interest_compound": "monthly",
            "minimum_payment": "400.00",
        },
    )
    context.assert_status(response, 400, message="POST /loans")
    body = context.json_or_empty(response)
    assert "already has a linked loan" in str(body.get("error", "")).lower()
