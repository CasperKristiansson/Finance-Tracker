from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID


def test_add_transaction_updates_balances(
    api_call,
    json_body,
    make_account_event,
    make_transaction_event,
) -> None:
    # Create two accounts via API
    checking_resp = api_call("POST", "/accounts", make_account_event("normal")["body"])
    savings_resp = api_call("POST", "/accounts", make_account_event("normal")["body"])

    assert checking_resp["statusCode"] == 201
    assert savings_resp["statusCode"] == 201

    checking_id = UUID(json_body(checking_resp)["id"])
    savings_id = UUID(json_body(savings_resp)["id"])

    # Create a transfer transaction moving 200 from checking to savings via Lambda
    occurred = datetime(2025, 1, 15, tzinfo=timezone.utc)
    legs = [
        {"account_id": str(checking_id), "amount": "-200.00"},
        {"account_id": str(savings_id), "amount": "200.00"},
    ]
    create_tx_resp = api_call(
        "POST", "/transactions", make_transaction_event(legs, occurred)["body"]
    )
    assert create_tx_resp["statusCode"] == 201

    # Verify the transaction is listed via API
    list_resp = api_call("GET", f"/transactions?account_ids={checking_id},{savings_id}")
    assert list_resp["statusCode"] == 200
    tx_body = json_body(list_resp)
    assert len(tx_body["transactions"]) == 1
    tx = tx_body["transactions"][0]
    assert UUID(tx["id"])
    assert Decimal(tx["legs"][0]["amount"]) == Decimal("-200.00")
    assert Decimal(tx["legs"][1]["amount"]) == Decimal("200.00")

    running_balances = {UUID(k): Decimal(v) for k, v in tx_body["running_balances"].items()}
    assert running_balances[checking_id] == Decimal("-200.00")
    assert running_balances[savings_id] == Decimal("200.00")

    # Account listing should reflect updated balances
    accounts_resp = api_call("GET", "/accounts")
    assert accounts_resp["statusCode"] == 200
    accounts = json_body(accounts_resp)["accounts"]
    balances = {UUID(item["id"]): Decimal(item["balance"]) for item in accounts}
    assert balances[checking_id] == Decimal("-200.00")
    assert balances[savings_id] == Decimal("200.00")


def test_list_transactions_filters_by_account(
    api_call,
    json_body,
    make_account_event,
    make_transaction_event,
) -> None:
    acc1 = UUID(
        json_body(api_call("POST", "/accounts", make_account_event("normal")["body"]))["id"]
    )
    acc2 = UUID(
        json_body(api_call("POST", "/accounts", make_account_event("normal")["body"]))["id"]
    )
    acc3 = UUID(
        json_body(api_call("POST", "/accounts", make_account_event("normal")["body"]))["id"]
    )

    occurred = datetime(2025, 2, 1, tzinfo=timezone.utc)
    api_call(
        "POST",
        "/transactions",
        make_transaction_event(
            [
                {"account_id": str(acc1), "amount": "-50.00"},
                {"account_id": str(acc2), "amount": "50.00"},
            ],
            occurred,
        )["body"],
    )
    api_call(
        "POST",
        "/transactions",
        make_transaction_event(
            [
                {"account_id": str(acc2), "amount": "-75.00"},
                {"account_id": str(acc3), "amount": "75.00"},
            ],
            occurred,
        )["body"],
    )

    filtered_resp = api_call(
        "GET",
        f"/transactions?account_ids={acc3}",
    )
    assert filtered_resp["statusCode"] == 200
    transactions = json_body(filtered_resp)["transactions"]
    assert len(transactions) == 1
    tx = transactions[0]
    leg_account_ids = {UUID(leg["account_id"]) for leg in tx["legs"]}
    assert acc3 in leg_account_ids


def test_reconcile_account_posts_adjustment(
    api_call,
    json_body,
    make_account_event,
) -> None:
    account_resp = api_call("POST", "/accounts", make_account_event("normal")["body"])
    assert account_resp["statusCode"] == 201
    account_id = json_body(account_resp)["id"]

    captured_at = datetime(2025, 3, 1, tzinfo=timezone.utc)
    reconcile_payload = {
        "captured_at": captured_at.isoformat(),
        "reported_balance": "150.00",
        "description": "Test reconciliation",
    }
    recon_resp = api_call("POST", f"/accounts/{account_id}/reconcile", reconcile_payload)
    assert recon_resp["statusCode"] == 201
    recon_body = json_body(recon_resp)
    assert Decimal(recon_body["ledger_balance"]) == Decimal("0")
    assert Decimal(recon_body["delta_posted"]) == Decimal("150.00")
    assert recon_body["transaction_id"] is not None
    assert recon_body["snapshot_id"] is not None

    transactions_resp = api_call("GET", f"/transactions?account_ids={account_id}")
    assert transactions_resp["statusCode"] == 200
    transactions = json_body(transactions_resp)["transactions"]
    posted = next(tx for tx in transactions if tx["id"] == recon_body["transaction_id"])
    assert posted["transaction_type"] == "adjustment"

    second_payload = {
        "captured_at": (captured_at + timedelta(days=1)).isoformat(),
        "reported_balance": "100.00",
        "description": "Test reconciliation decrease",
    }
    second_resp = api_call("POST", f"/accounts/{account_id}/reconcile", second_payload)
    assert second_resp["statusCode"] == 201
    second_body = json_body(second_resp)
    assert Decimal(second_body["delta_posted"]) == Decimal("-50.00")

    transactions_resp = api_call("GET", f"/transactions?account_ids={account_id}")
    assert transactions_resp["statusCode"] == 200
    transactions = json_body(transactions_resp)["transactions"]
    posted = next(tx for tx in transactions if tx["id"] == second_body["transaction_id"])
    assert posted["transaction_type"] == "adjustment"

    accounts_resp = api_call("GET", "/accounts")
    balances = {
        UUID(item["id"]): Decimal(item["balance"]) for item in json_body(accounts_resp)["accounts"]
    }
    assert balances[UUID(account_id)] == Decimal("150.00")


def test_warmup_endpoint(api_call, json_body) -> None:
    resp = api_call("GET", "/warmup")
    assert resp["statusCode"] == 200
    body = json_body(resp)
    assert body.get("status") in {"ready", "starting"}


def test_patch_account_updates_fields(api_call, json_body, make_account_event) -> None:
    create_resp = api_call("POST", "/accounts", make_account_event("normal")["body"])
    assert create_resp["statusCode"] == 201
    account_id = json_body(create_resp)["id"]

    patch_payload = {"is_active": False, "name": "Updated Name"}
    patch_resp = api_call("PATCH", f"/accounts/{account_id}", patch_payload)
    assert patch_resp["statusCode"] == 200
    updated = json_body(patch_resp)
    assert updated["is_active"] is False
    assert updated["name"] == "Updated Name"
