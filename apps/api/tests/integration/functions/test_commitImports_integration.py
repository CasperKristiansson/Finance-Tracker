from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "commitImports"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/imports/commit"
COVERS_ROUTE = None


def test_commitImports_integration(integration_context) -> None:
    context = integration_context
    data = context.commit_import(include_files=False)
    assert data["commit"]["import_batch_id"]
