from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "deleteImportDraft"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "DELETE"
COVERS_HTTP_PATH = "/imports/{importBatchId}"
COVERS_ROUTE = None


def test_deleteImportDraft_integration(integration_context) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    body = context.call(
        "DELETE",
        f"/imports/{preview['import_batch_id']}",
        None,
        expected=200,
    )
    assert body["import_batch_id"] == preview["import_batch_id"]
    assert body["deleted"] is True


def test_deleteImportDraft_allows_committed_batch_cleanup(integration_context) -> None:
    context = integration_context
    data = context.commit_import(include_files=False)
    preview = data["preview"]
    body = context.call(
        "DELETE",
        f"/imports/{preview['import_batch_id']}",
        None,
        expected=200,
    )
    assert body["deleted"] is True


def test_deleteImportDraft_enforces_user_scope(integration_context, api_call_other_user) -> None:
    context = integration_context
    preview = context.create_import_preview()["preview"]
    response = api_call_other_user("DELETE", f"/imports/{preview['import_batch_id']}", None)
    context.assert_status(response, 404, message="DELETE /imports/{id} wrong user")
