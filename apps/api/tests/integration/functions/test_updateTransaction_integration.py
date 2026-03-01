from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "updateTransaction"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "PATCH"
COVERS_HTTP_PATH = "/transactions/{transactionId}"
COVERS_ROUTE = None


def test_updateTransaction_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    transaction_id = data["transaction"]["id"]
    description = context.unique("updated-tx")
    body = context.call(
        "PATCH",
        f"/transactions/{transaction_id}",
        {"description": description},
        expected=200,
    )
    assert body["description"] == description


def test_updateTransaction_enforces_user_scope(integration_context, api_call_other_user) -> None:
    context = integration_context
    data = context.create_transfer()
    transaction_id = data["transaction"]["id"]
    response = api_call_other_user(
        "PATCH",
        f"/transactions/{transaction_id}",
        {"description": context.unique("blocked-update")},
    )
    context.assert_status(response, 404, message="PATCH /transactions/{id} wrong user")
