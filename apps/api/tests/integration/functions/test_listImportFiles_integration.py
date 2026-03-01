from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listImportFiles"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/import-files"
COVERS_ROUTE = None


def test_listImportFiles_integration(integration_context) -> None:
    context = integration_context
    data = context.commit_import(include_files=True)
    preview_file = data["preview"]["files"][0]
    body = context.call("GET", "/import-files", None, expected=200)
    file_ids = {item["id"] for item in body.get("files", [])}
    assert preview_file["id"] in file_ids
