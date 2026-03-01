from __future__ import annotations

from uuid import uuid4

from apps.api.shared import import_draft_state as draft_state


class _FakeTable:
    def __init__(self) -> None:
        self.items: dict[str, dict] = {}

    def get_item(self, *, Key: dict) -> dict:
        item = self.items.get(str(Key["connection_id"]))
        if item is None:
            return {}
        return {"Item": item}

    def put_item(self, *, Item: dict) -> None:
        self.items[str(Item["connection_id"])] = Item

    def delete_item(self, *, Key: dict) -> None:
        self.items.pop(str(Key["connection_id"]), None)

    def scan(self, *, FilterExpression, **_kwargs):  # noqa: N803 - boto3 naming
        _ = FilterExpression
        return {"Items": list(self.items.values())}


def _preview_payload(batch_id: str) -> dict:
    return {
        "import_batch_id": batch_id,
        "suggestions_status": "not_started",
        "files": [
            {
                "id": str(uuid4()),
                "filename": "test.csv",
                "account_id": str(uuid4()),
                "row_count": 1,
                "error_count": 0,
                "errors": [],
                "preview_rows": [],
            }
        ],
        "rows": [
            {
                "id": str(uuid4()),
                "file_id": None,
                "row_index": 1,
                "account_id": str(uuid4()),
                "occurred_at": "2026-01-01",
                "amount": "10",
                "description": "hello",
                "draft": {},
            }
        ],
        "accounts": [],
    }


def test_import_draft_state_roundtrip(monkeypatch) -> None:
    table = _FakeTable()
    monkeypatch.setattr(draft_state, "_get_table", lambda: table)

    batch_id = uuid4()
    preview = _preview_payload(str(batch_id))
    draft_state.save_import_draft_preview(
        user_id="user-1",
        preview=preview,
        note="note",
    )

    loaded = draft_state.get_import_draft_preview(
        user_id="user-1",
        import_batch_id=batch_id,
    )
    assert loaded is not None
    assert loaded["import_batch_id"] == str(batch_id)

    summaries = draft_state.list_import_draft_summaries(user_id="user-1")
    assert summaries and summaries[0]["import_batch_id"] == str(batch_id)

    row = loaded["rows"][0]
    updated_at = draft_state.save_import_draft_rows(
        user_id="user-1",
        import_batch_id=batch_id,
        rows=[
            {
                "id": row["id"],
                "file_id": loaded["files"][0]["id"],
                "account_id": row["account_id"],
                "occurred_at": row["occurred_at"],
                "amount": "12",
                "description": "updated",
                "category_id": None,
                "transfer_account_id": None,
                "tax_event_type": None,
                "delete": False,
            }
        ],
    )
    assert isinstance(updated_at, str)

    refreshed = draft_state.get_import_draft_preview(
        user_id="user-1",
        import_batch_id=batch_id,
    )
    assert refreshed is not None
    assert refreshed["rows"][0]["description"] == "updated"

    draft_state.mark_import_draft_committed(user_id="user-1", import_batch_id=batch_id)

    draft_state.delete_import_draft_preview(user_id="user-1", import_batch_id=batch_id)
    assert (
        draft_state.get_import_draft_preview(
            user_id="user-1",
            import_batch_id=batch_id,
        )
        is None
    )
