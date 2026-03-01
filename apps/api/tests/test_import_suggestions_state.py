from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

from apps.api.schemas import ImportCategorySuggestionRead
from apps.api.shared import import_suggestions_state as state_store


class _FakeTable:
    def __init__(self) -> None:
        self.items: dict[str, dict] = {}

    def get_item(self, *, Key: dict) -> dict:
        key = str(Key["connection_id"])
        item = self.items.get(key)
        if item is None:
            return {}
        return {"Item": item}

    def put_item(self, *, Item: dict) -> None:
        self.items[str(Item["connection_id"])] = Item

    def delete_item(self, *, Key: dict) -> None:
        self.items.pop(str(Key["connection_id"]), None)


def test_load_save_delete_import_suggestions_state(monkeypatch) -> None:
    table = _FakeTable()
    monkeypatch.setattr(state_store, "_get_table", lambda: table)

    batch_id = uuid4()
    category_id = uuid4()
    row_id = uuid4()

    saved = state_store.save_import_suggestions_state(
        import_batch_id=batch_id,
        user_id="user-1",
        status="completed",
        suggestions=[
            ImportCategorySuggestionRead(
                id=row_id,
                category_id=category_id,
                confidence=0.91,
                reason="Matched history",
            )
        ],
    )
    assert saved is True

    pk = f"batch#{batch_id}"
    stored_item = table.items[pk]
    # Mimic DynamoDB number deserialization behavior.
    stored_item["suggestions"][0]["confidence"] = Decimal("0.91")

    loaded = state_store.load_import_suggestions_state(batch_id, user_id="user-1")
    assert loaded is not None
    assert loaded["status"] == "completed"
    loaded_suggestions = loaded["suggestions"]
    assert len(loaded_suggestions) == 1
    assert loaded_suggestions[0].id == row_id
    assert loaded_suggestions[0].category_id == category_id
    assert loaded_suggestions[0].confidence == 0.91

    deleted = state_store.delete_import_suggestions_state(batch_id)
    assert deleted is True
    assert state_store.load_import_suggestions_state(batch_id, user_id="user-1") is None


def test_load_state_respects_user_scope(monkeypatch) -> None:
    table = _FakeTable()
    monkeypatch.setattr(state_store, "_get_table", lambda: table)

    batch_id = uuid4()
    table.put_item(
        Item={
            "connection_id": f"batch#{batch_id}",
            "item_type": "import_suggestions_state",
            "import_batch_id": str(batch_id),
            "user_id": "user-a",
            "status": "running",
            "updated_at": 1,
            "expires_at": 2,
        }
    )

    assert state_store.load_import_suggestions_state(batch_id, user_id="user-b") is None
    loaded = state_store.load_import_suggestions_state(batch_id, user_id="user-a")
    assert loaded is not None
    assert loaded["status"] == "running"
