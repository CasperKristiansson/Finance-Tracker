from __future__ import annotations

from uuid import uuid4

COVERS_SERVERLESS_FUNCTION = "saveImportDraft"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/imports/{importBatchId}/draft"
COVERS_ROUTE = None


def test_saveImportDraft_integration(integration_context) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    row = preview["rows"][0]
    body = context.call(
        "POST",
        f"/imports/{preview['import_batch_id']}/draft",
        {
            "rows": [
                {
                    "id": row["id"],
                    "file_id": row["file_id"],
                    "account_id": row["account_id"],
                    "occurred_at": row["occurred_at"],
                    "amount": row["amount"],
                    "description": f"{row['description']} updated",
                    "category_id": row.get("suggested_category_id"),
                    "transfer_account_id": None,
                    "tax_event_type": None,
                    "delete": False,
                }
            ]
        },
        expected=200,
    )
    assert body["import_batch_id"] == preview["import_batch_id"]


def test_saveImportDraft_persists_row_fields_roundtrip(integration_context) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    row = preview["rows"][0]
    category = context.create_category(category_type="expense")

    expected_description = context.unique("edited")
    expected_amount = "-42.10"
    expected_tax_event_type = "payment"

    context.call(
        "POST",
        f"/imports/{preview['import_batch_id']}/draft",
        {
            "rows": [
                {
                    "id": row["id"],
                    "file_id": row["file_id"],
                    "account_id": row["account_id"],
                    "occurred_at": row["occurred_at"],
                    "amount": expected_amount,
                    "description": expected_description,
                    "category_id": category["id"],
                    "transfer_account_id": None,
                    "tax_event_type": expected_tax_event_type,
                    "delete": True,
                }
            ]
        },
        expected=200,
    )

    refreshed = context.call("GET", f"/imports/{preview['import_batch_id']}", None, expected=200)
    refreshed_row = next(item for item in refreshed["rows"] if item["id"] == row["id"])
    draft = refreshed_row.get("draft") or {}

    assert draft["id"] == row["id"]
    assert draft["file_id"] == row["file_id"]
    assert draft["account_id"] == row["account_id"]
    assert draft["occurred_at"] == row["occurred_at"]
    assert draft["amount"] == expected_amount
    assert draft["description"] == expected_description
    assert draft["category_id"] == category["id"]
    assert draft["transfer_account_id"] is None
    assert draft["tax_event_type"] == expected_tax_event_type
    assert draft["delete"] is True


def test_saveImportDraft_rejects_unknown_file_and_preserves_rows(integration_context) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    row = preview["rows"][0]
    original_description = row["description"]

    response = context.call_raw(
        "POST",
        f"/imports/{preview['import_batch_id']}/draft",
        {
            "rows": [
                {
                    "id": row["id"],
                    "file_id": str(uuid4()),
                    "account_id": row["account_id"],
                    "occurred_at": row["occurred_at"],
                    "amount": row["amount"],
                    "description": context.unique("should-not-save"),
                    "category_id": None,
                    "transfer_account_id": None,
                    "tax_event_type": None,
                    "delete": False,
                }
            ]
        },
    )
    context.assert_status(response, 400, message="POST /imports/{id}/draft unknown file")

    refreshed = context.call("GET", f"/imports/{preview['import_batch_id']}", None, expected=200)
    refreshed_row = next(item for item in refreshed["rows"] if item["id"] == row["id"])
    assert refreshed_row["description"] == original_description


def test_saveImportDraft_rejects_invalid_payload_and_has_no_side_effect(
    integration_context,
) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    row = preview["rows"][0]
    before = context.call("GET", f"/imports/{preview['import_batch_id']}", None, expected=200)
    before_row = next(item for item in before["rows"] if item["id"] == row["id"])

    response = context.call_raw(
        "POST",
        f"/imports/{preview['import_batch_id']}/draft",
        {"rows": [{"id": row["id"]}]},
    )
    context.assert_status(response, 400, message="POST /imports/{id}/draft invalid payload")

    after = context.call("GET", f"/imports/{preview['import_batch_id']}", None, expected=200)
    after_row = next(item for item in after["rows"] if item["id"] == row["id"])
    assert after_row["description"] == before_row["description"]
