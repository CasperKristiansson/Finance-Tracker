from __future__ import annotations

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
