from __future__ import annotations

from uuid import uuid4

COVERS_SERVERLESS_FUNCTION = "commitImports"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/imports/commit"
COVERS_ROUTE = None


def test_commitImports_integration(integration_context) -> None:
    context = integration_context
    data = context.commit_import(include_files=False)
    assert data["commit"]["import_batch_id"]


def test_commitImports_is_atomic_on_invalid_row(integration_context) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    row = preview["rows"][0]
    account_id = row["account_id"]
    before = context.call("GET", f"/transactions?account_ids={account_id}", None, expected=200)
    before_count = len(before.get("transactions", []))

    response = context.call_raw(
        "POST",
        "/imports/commit",
        {
            "import_batch_id": preview["import_batch_id"],
            "note": context.unique("atomic"),
            "rows": [
                {
                    "id": row["id"],
                    "file_id": row["file_id"],
                    "account_id": row["account_id"],
                    "occurred_at": row["occurred_at"],
                    "amount": row["amount"],
                    "description": row["description"],
                    "category_id": row.get("suggested_category_id"),
                    "transfer_account_id": None,
                    "tax_event_type": None,
                    "delete": False,
                },
                {
                    "id": str(uuid4()),
                    "file_id": str(uuid4()),
                    "account_id": row["account_id"],
                    "occurred_at": row["occurred_at"],
                    "amount": row["amount"],
                    "description": context.unique("invalid-row"),
                    "category_id": None,
                    "transfer_account_id": None,
                    "tax_event_type": None,
                    "delete": False,
                },
            ],
        },
    )
    context.assert_status(response, 400, message="POST /imports/commit invalid row")

    after = context.call("GET", f"/transactions?account_ids={account_id}", None, expected=200)
    assert len(after.get("transactions", [])) == before_count


def test_commitImports_rejects_second_commit_for_same_batch(integration_context) -> None:
    context = integration_context
    data = context.commit_import(include_files=False)
    preview = data["preview"]
    row = preview["rows"][0]

    response = context.call_raw(
        "POST",
        "/imports/commit",
        {
            "import_batch_id": preview["import_batch_id"],
            "note": context.unique("replay"),
            "rows": [
                {
                    "id": row["id"],
                    "file_id": row["file_id"],
                    "account_id": row["account_id"],
                    "occurred_at": row["occurred_at"],
                    "amount": row["amount"],
                    "description": row["description"],
                    "category_id": row.get("suggested_category_id"),
                    "transfer_account_id": None,
                    "tax_event_type": None,
                    "delete": False,
                }
            ],
        },
    )
    context.assert_status(response, 400, message="POST /imports/commit replay")
