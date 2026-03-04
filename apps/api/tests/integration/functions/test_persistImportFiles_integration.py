from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "persistImportFiles"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/imports/{importBatchId}/files"
COVERS_ROUTE = None


XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def test_persistImportFiles_integration(integration_context) -> None:
    context = integration_context
    data = context.create_import_preview()
    preview = data["preview"]
    preview_file = preview["files"][0]

    response = context.call(
        "POST",
        f"/imports/{preview['import_batch_id']}/files",
        {
            "files": [
                {
                    "id": preview_file["id"],
                    "filename": preview_file["filename"],
                    "account_id": preview_file["account_id"],
                    "row_count": preview_file["row_count"],
                    "error_count": preview_file["error_count"],
                    "bank_import_type": preview_file.get("bank_import_type"),
                    "content_base64": data["workbook_b64"],
                    "content_type": XLSX_CONTENT_TYPE,
                }
            ]
        },
        expected=200,
    )

    assert response["import_batch_id"] == preview["import_batch_id"]
    assert preview_file["id"] in response.get("file_ids", [])
