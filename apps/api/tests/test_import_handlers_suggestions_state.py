from __future__ import annotations

from uuid import uuid4

from apps.api.handlers import imports as imports_handler
from apps.api.schemas import ImportCategorySuggestionRead


def test_apply_import_suggestions_state_updates_preview_rows(monkeypatch) -> None:
    batch_id = uuid4()
    row_id = uuid4()
    category_id = uuid4()
    preview = {
        "import_batch_id": batch_id,
        "suggestions_status": "not_started",
        "rows": [
            {
                "id": row_id,
                "description": "Test",
                "draft": {},
            }
        ],
    }

    monkeypatch.setattr(
        imports_handler,
        "load_import_suggestions_state",
        lambda _batch_id, user_id: {
            "status": "completed",
            "suggestions": [
                ImportCategorySuggestionRead(
                    id=row_id,
                    category_id=category_id,
                    confidence=0.8,
                    reason="history",
                )
            ],
        },
    )

    merged = imports_handler._apply_import_suggestions_state(
        preview=preview,
        import_batch_id=batch_id,
        user_id="user-1",
    )

    assert merged["suggestions_status"] == "completed"
    assert merged["rows"][0]["suggested_category_id"] == category_id
    assert merged["rows"][0]["suggested_confidence"] == 0.8
    assert merged["rows"][0]["suggested_reason"] == "history"
    assert merged["rows"][0]["draft"] == {}


def test_apply_import_suggestions_state_preserves_existing_draft_category(monkeypatch) -> None:
    batch_id = uuid4()
    row_id = uuid4()
    suggested_category_id = uuid4()
    saved_draft_category_id = uuid4()
    preview = {
        "import_batch_id": batch_id,
        "suggestions_status": "not_started",
        "rows": [
            {
                "id": row_id,
                "description": "Test",
                "draft": {"category_id": str(saved_draft_category_id)},
            }
        ],
    }

    monkeypatch.setattr(
        imports_handler,
        "load_import_suggestions_state",
        lambda _batch_id, user_id: {
            "status": "completed",
            "suggestions": [
                ImportCategorySuggestionRead(
                    id=row_id,
                    category_id=suggested_category_id,
                    confidence=0.8,
                    reason="history",
                )
            ],
        },
    )

    merged = imports_handler._apply_import_suggestions_state(
        preview=preview,
        import_batch_id=batch_id,
        user_id="user-1",
    )

    assert merged["rows"][0]["suggested_category_id"] == suggested_category_id
    assert merged["rows"][0]["draft"]["category_id"] == str(saved_draft_category_id)


def test_apply_import_suggestions_state_sets_failed_status(monkeypatch) -> None:
    batch_id = uuid4()
    preview = {
        "import_batch_id": batch_id,
        "suggestions_status": "not_started",
        "rows": [],
    }
    monkeypatch.setattr(
        imports_handler,
        "load_import_suggestions_state",
        lambda _batch_id, user_id: {"status": "failed", "suggestions": []},
    )

    merged = imports_handler._apply_import_suggestions_state(
        preview=preview,
        import_batch_id=batch_id,
        user_id="user-1",
    )
    assert merged["suggestions_status"] == "failed"
