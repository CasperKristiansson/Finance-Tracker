from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "runTransactionsBackup"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "POST"
COVERS_HTTP_PATH = "/backups/transactions"
COVERS_ROUTE = None


def test_runTransactionsBackup_integration(integration_context) -> None:
    context = integration_context
    body = context.call("POST", "/backups/transactions", {}, expected=200)
    assert body.get("manifest_key"), "transactions backup should return manifest key"
