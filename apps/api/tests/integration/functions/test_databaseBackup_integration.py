from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "databaseBackup"
COVERS_EVENT_TYPE = "schedule"
COVERS_HTTP_METHOD = None
COVERS_HTTP_PATH = None
COVERS_ROUTE = None


def test_databaseBackup_integration(integration_context) -> None:
    context = integration_context
    response = context.invoke("databaseBackup", {}, expected=200)
    body = context.json_or_empty(response)
    assert body.get("manifest_key"), "database backup should return manifest key"
    assert isinstance(body.get("tables"), list), "database backup should return tables"
