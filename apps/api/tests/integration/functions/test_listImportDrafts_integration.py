from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listImportDrafts"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/imports/drafts"
COVERS_ROUTE = None


def test_listImportDrafts_integration(integration_context) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    body = context.call("GET", "/imports/drafts", None, expected=200)
    batch_ids = {draft["import_batch_id"] for draft in body.get("drafts", [])}
    assert preview["import_batch_id"] in batch_ids
