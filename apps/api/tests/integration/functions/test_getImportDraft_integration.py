from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "getImportDraft"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/imports/{importBatchId}"
COVERS_ROUTE = None


def test_getImportDraft_integration(integration_context) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    body = context.call("GET", f"/imports/{preview['import_batch_id']}", None, expected=200)
    assert body["import_batch_id"] == preview["import_batch_id"]
