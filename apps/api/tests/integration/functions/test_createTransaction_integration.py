from __future__ import annotations

from decimal import Decimal

COVERS_SERVERLESS_FUNCTION = "createTransaction"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/transactions"
COVERS_ROUTE = None


def test_createTransaction_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    transaction = data["transaction"]
    assert transaction["id"]
    leg_total = sum(Decimal(str(leg["amount"])) for leg in transaction.get("legs", []))
    assert leg_total == Decimal("0")


def test_createTransaction_rejects_invalid_payload_and_does_not_write(integration_context) -> None:
    context = integration_context
    source = context.create_account()
    target = context.create_account()
    before = context.call(
        "GET",
        f"/transactions?account_ids={source['id']},{target['id']}",
        None,
        expected=200,
    )
    before_count = len(before.get("transactions", []))

    response = context.call_raw(
        "POST",
        "/transactions",
        {
            "occurred_at": "invalid-date",
            "posted_at": "invalid-date",
            "description": context.unique("bad-tx"),
            "legs": [
                {"account_id": source["id"], "amount": "-20.00"},
                {"account_id": target["id"], "amount": "10.00"},
            ],
        },
    )
    context.assert_status(response, 400, message="POST /transactions invalid payload")

    after = context.call(
        "GET",
        f"/transactions?account_ids={source['id']},{target['id']}",
        None,
        expected=200,
    )
    assert len(after.get("transactions", [])) == before_count
