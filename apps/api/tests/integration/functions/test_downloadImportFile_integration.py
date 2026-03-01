from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "downloadImportFile"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/import-files/download"
COVERS_ROUTE = None


def test_downloadImportFile_integration(integration_context) -> None:
    context = integration_context
    data = context.commit_import(include_files=True)
    preview_file = data["preview"]["files"][0]
    body = context.call(
        "POST",
        "/import-files/download",
        {"file_id": preview_file["id"]},
        expected=200,
    )
    assert body.get("url")
