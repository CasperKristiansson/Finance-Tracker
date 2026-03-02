from __future__ import annotations

from decimal import Decimal

COVERS_SERVERLESS_FUNCTION = "createLoanActivity"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/loans/{accountId}/activity"
COVERS_ROUTE = None


def test_createLoanActivity_integration(integration_context) -> None:
    context = integration_context
    loan_data = context.create_loan()
    loan_account_id = loan_data["account"]["id"]
    funding_account = context.create_account(account_type="normal")

    response = context.call(
        "POST",
        f"/loans/{loan_account_id}/activity",
        {
            "kind": "payment",
            "funding_account_id": funding_account["id"],
            "amount": "100.00",
            "occurred_at": "2025-01-15T00:00:00Z",
            "description": context.unique("loan-payment"),
            "sync_principal": True,
        },
        expected=201,
    )

    assert response.get("transaction_id")
    assert Decimal(str(response["current_principal"])) == Decimal("9900.00")
