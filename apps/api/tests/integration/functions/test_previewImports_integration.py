from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "previewImports"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/imports/preview"
COVERS_ROUTE = None


def test_previewImports_integration(integration_context) -> None:
    context = integration_context
    data = context.create_import_preview()
    preview = data["preview"]
    assert preview["import_batch_id"]
