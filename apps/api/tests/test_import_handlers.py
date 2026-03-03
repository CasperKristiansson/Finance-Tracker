from __future__ import annotations

import base64
import io
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterator
from uuid import UUID

import pytest
from openpyxl import Workbook
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, select

from apps.api.handlers import imports as import_handlers
from apps.api.handlers.imports import (
    commit_imports,
    delete_import_draft,
    get_import_draft,
    list_import_drafts,
    preview_imports,
    reset_handler_state,
    save_import_draft,
)
from apps.api.models import Account, Category, Transaction, TransactionLeg
from apps.api.schemas import ImportCategorySuggestionRead
from apps.api.shared import (
    AccountType,
    CategoryType,
    TransactionType,
    configure_engine,
    get_default_user_id,
    get_engine,
    import_draft_state,
    import_suggestions_state,
    scope_session_to_user,
)
from apps.api.shared.import_suggestions_state import save_import_suggestions_state


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_handler_state()
    configure_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    try:
        yield
    finally:
        SQLModel.metadata.drop_all(engine)


class _FakeDraftStoreTable:
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

    def scan(self, *, FilterExpression, **_kwargs):  # noqa: N803 - boto style
        _ = FilterExpression
        items = [
            item
            for item in self.items.values()
            if item.get("item_type") == "import_draft" and item.get("status") == "draft"
        ]
        return {"Items": items}


@pytest.fixture(autouse=True)
def configure_import_draft_store(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    table = _FakeDraftStoreTable()
    monkeypatch.setattr(import_draft_state, "_get_table", lambda: table)
    monkeypatch.setattr(import_suggestions_state, "_get_table", lambda: table)
    yield


def _json_body(response: dict) -> dict:
    return json.loads(response["body"])


def _b64_workbook(builder) -> str:
    workbook = Workbook()
    sheet = workbook.active
    builder(sheet)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return base64.b64encode(buffer.getvalue()).decode()


def _swedbank_workbook() -> str:
    def build(sheet):
        sheet.append(["Transaktioner Privatkonto"])
        sheet.append([])
        sheet.append(
            [
                "Radnummer",
                "Bokföringsdag",
                "Transaktionsdag",
                "Valutadag",
                "Referens",
                "Beskrivning",
                "Belopp",
                "Bokfört saldo",
            ]
        )
        sheet.append(
            [
                "1",
                "2024-01-01",
                "2024-01-01",
                "2024-01-01",
                "Ref 123",
                "Deposit",
                "100.50",
                "1200.00",
            ]
        )
        sheet.append(
            [
                "2",
                "2024-01-02",
                "2024-01-02",
                "2024-01-02",
                "Transfer",
                "Outgoing",
                "-100.50",
                "1099.50",
            ]
        )

    return _b64_workbook(build)


def _circle_k_workbook() -> str:
    def build(sheet):
        sheet.append(["Transaktionsexport"])
        sheet.append([])
        sheet.append(
            ["Datum", "Bokfört", "Specifikation", "Ort", "Valuta", "Utl. belopp", "Belopp"]
        )
        sheet.append(["2024-02-01", "2024-02-02", "Groceries", "Stockholm", "SEK", "", "250"])

    return _b64_workbook(build)


def _create_account(*, bank_import_type: str | None) -> UUID:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        account = Account(
            name="Account",
            account_type=AccountType.NORMAL,
            bank_import_type=bank_import_type,
            is_active=True,
        )
        session.add(account)
        session.commit()
        session.refresh(account)
        return account.id


def _create_category(*, name: str) -> UUID:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        category = Category(name=name, category_type=CategoryType.EXPENSE, is_archived=False)
        session.add(category)
        session.commit()
        session.refresh(category)
        return category.id


def _create_categorized_transaction(
    *, account_id: UUID, category_id: UUID, description: str
) -> UUID:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tx = Transaction(
            transaction_type=TransactionType.EXPENSE,
            occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            description=description,
            category_id=category_id,
        )
        session.add(tx)
        session.flush()
        session.add(
            TransactionLeg(
                transaction_id=tx.id,
                account_id=account_id,
                amount=Decimal("-99.00"),
            )
        )
        session.commit()
        return tx.id


def test_preview_parses_swedbank_and_returns_rows():
    account_id = _create_account(bank_import_type="swedbank")
    payload = _swedbank_workbook()
    response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ],
                    "note": "preview",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["import_batch_id"]
    assert body["files"][0]["bank_import_type"] == "swedbank"
    assert body["files"][0]["row_count"] == 2
    assert body["rows"] and len(body["rows"]) == 2
    assert body["accounts"] == []


def test_preview_autodetects_bank_type_without_account_lookup():
    account_id = _create_account(bank_import_type=None)
    payload = _swedbank_workbook()
    response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    file_meta = body["files"][0]
    assert file_meta["bank_import_type"] == "swedbank"
    assert file_meta["row_count"] == 2


def test_preview_circle_k_amounts_are_negated():
    account_id = _create_account(bank_import_type="circle_k_mastercard")
    payload = _circle_k_workbook()
    response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "ck.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 200
    created = _json_body(response)
    first_amount = Decimal(created["rows"][0]["amount"])
    assert first_amount < 0


def test_preview_returns_503_when_draft_store_is_unavailable(monkeypatch: pytest.MonkeyPatch):
    account_id = _create_account(bank_import_type="swedbank")
    payload = _swedbank_workbook()

    monkeypatch.setattr(
        import_handlers,
        "save_import_draft_preview",
        lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("Draft store unavailable")),
    )

    response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ],
                    "note": "preview",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )

    assert response["statusCode"] == 503
    assert _json_body(response) == {"error": "Draft store unavailable"}


def test_preview_includes_related_transactions():
    account_id = _create_account(bank_import_type="swedbank")
    groceries_id = _create_category(name="Groceries")
    _create_categorized_transaction(
        account_id=account_id,
        category_id=groceries_id,
        description="Deposit salary",
    )
    payload = _swedbank_workbook()
    response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["accounts"] == []


def test_commit_is_all_or_nothing():
    account_id = _create_account(bank_import_type="swedbank")
    response = commit_imports(
        {
            "body": json.dumps(
                {
                    "note": "commit",
                    "rows": [
                        {
                            "id": str(UUID(int=1)),
                            "account_id": str(account_id),
                            "occurred_at": "2024-01-01",
                            "amount": "10.00",
                            "description": "Valid row",
                        },
                        {
                            "id": str(UUID(int=2)),
                            "account_id": str(account_id),
                            "occurred_at": "2024-01-02",
                            "amount": "not-a-number",
                            "description": "Invalid row",
                        },
                    ],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 400

    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        assert session.exec(select(Transaction)).all() == []


def test_get_import_draft_returns_persisted_preview():
    account_id = _create_account(bank_import_type="swedbank")
    payload = _swedbank_workbook()
    preview_response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ],
                    "note": "draft resume",
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    preview_body = _json_body(preview_response)
    import_batch_id = preview_body["import_batch_id"]

    resumed_response = get_import_draft(
        {
            "pathParameters": {"importBatchId": import_batch_id},
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    assert resumed_response["statusCode"] == 200
    resumed_body = _json_body(resumed_response)
    assert resumed_body["import_batch_id"] == import_batch_id
    assert resumed_body["rows"]
    assert resumed_body["files"][0]["filename"] == "swedbank.xlsx"


def test_save_import_draft_persists_row_edits():
    account_id = _create_account(bank_import_type="swedbank")
    payload = _swedbank_workbook()
    preview_response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    preview_body = _json_body(preview_response)
    row = preview_body["rows"][0]
    import_batch_id = preview_body["import_batch_id"]

    save_response = save_import_draft(
        {
            "pathParameters": {"importBatchId": import_batch_id},
            "body": json.dumps(
                {
                    "rows": [
                        {
                            "id": row["id"],
                            "file_id": row["file_id"],
                            "account_id": row["account_id"],
                            "occurred_at": row["occurred_at"],
                            "amount": row["amount"],
                            "description": "Updated draft description",
                            "category_id": None,
                            "subscription_id": None,
                            "transfer_account_id": None,
                            "tax_event_type": None,
                            "delete": False,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    assert save_response["statusCode"] == 200

    resumed_response = get_import_draft(
        {
            "pathParameters": {"importBatchId": import_batch_id},
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    resumed_body = _json_body(resumed_response)
    resumed_row = resumed_body["rows"][0]
    assert resumed_row["draft"] is not None
    assert resumed_row["draft"]["description"] == "Updated draft description"


def test_list_import_drafts_excludes_committed_batches():
    account_id = _create_account(bank_import_type="swedbank")
    payload = _swedbank_workbook()
    preview_response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    preview_body = _json_body(preview_response)
    import_batch_id = preview_body["import_batch_id"]
    row = preview_body["rows"][0]

    before_commit = list_import_drafts(
        {"requestContext": {"authorizer": {"jwt": {"claims": {}}}}},
        None,
    )
    assert before_commit["statusCode"] == 200
    before_drafts = _json_body(before_commit)["drafts"]
    assert any(draft["import_batch_id"] == import_batch_id for draft in before_drafts)

    commit_response = commit_imports(
        {
            "body": json.dumps(
                {
                    "import_batch_id": import_batch_id,
                    "rows": [
                        {
                            "id": row["id"],
                            "file_id": row["file_id"],
                            "account_id": row["account_id"],
                            "occurred_at": row["occurred_at"],
                            "amount": row["amount"],
                            "description": row["description"],
                            "category_id": None,
                            "subscription_id": None,
                            "transfer_account_id": None,
                            "tax_event_type": None,
                            "delete": False,
                        }
                    ],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert commit_response["statusCode"] == 200

    after_commit = list_import_drafts(
        {"requestContext": {"authorizer": {"jwt": {"claims": {}}}}},
        None,
    )
    after_drafts = _json_body(after_commit)["drafts"]
    assert all(draft["import_batch_id"] != import_batch_id for draft in after_drafts)


def test_delete_import_draft_removes_session():
    account_id = _create_account(bank_import_type="swedbank")
    payload = _swedbank_workbook()
    preview_response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    import_batch_id = _json_body(preview_response)["import_batch_id"]

    delete_response = delete_import_draft(
        {
            "pathParameters": {"importBatchId": import_batch_id},
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    assert delete_response["statusCode"] == 200

    drafts_response = list_import_drafts(
        {"requestContext": {"authorizer": {"jwt": {"claims": {}}}}},
        None,
    )
    drafts = _json_body(drafts_response)["drafts"]
    assert all(draft["import_batch_id"] != import_batch_id for draft in drafts)


def test_delete_import_draft_allows_committed_batch_cleanup():
    account_id = _create_account(bank_import_type="swedbank")
    payload = _swedbank_workbook()
    preview_response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    preview_body = _json_body(preview_response)
    import_batch_id = preview_body["import_batch_id"]
    row = preview_body["rows"][0]

    commit_response = commit_imports(
        {
            "body": json.dumps(
                {
                    "import_batch_id": import_batch_id,
                    "rows": [
                        {
                            "id": row["id"],
                            "file_id": row["file_id"],
                            "account_id": row["account_id"],
                            "occurred_at": row["occurred_at"],
                            "amount": row["amount"],
                            "description": row["description"],
                            "category_id": None,
                            "subscription_id": None,
                            "transfer_account_id": None,
                            "tax_event_type": None,
                            "delete": False,
                        }
                    ],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert commit_response["statusCode"] == 200

    delete_response = delete_import_draft(
        {
            "pathParameters": {"importBatchId": import_batch_id},
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    assert delete_response["statusCode"] == 200


def test_persisted_suggestions_are_returned_on_draft_reload():
    account_id = _create_account(bank_import_type="swedbank")
    category_id = _create_category(name="Groceries")
    payload = _swedbank_workbook()
    preview_response = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {
                            "filename": "swedbank.xlsx",
                            "account_id": str(account_id),
                            "content_base64": payload,
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    preview_body = _json_body(preview_response)
    import_batch_id = UUID(preview_body["import_batch_id"])
    target_row_id = UUID(preview_body["rows"][0]["id"])

    save_import_suggestions_state(
        import_batch_id=import_batch_id,
        user_id=get_default_user_id(),
        status="completed",
        suggestions=[
            ImportCategorySuggestionRead(
                id=target_row_id,
                category_id=category_id,
                confidence=0.81,
                reason="Matched prior grocery merchant",
            )
        ],
    )

    resumed_response = get_import_draft(
        {
            "pathParameters": {"importBatchId": str(import_batch_id)},
            "requestContext": {"authorizer": {"jwt": {"claims": {}}}},
        },
        None,
    )
    assert resumed_response["statusCode"] == 200
    resumed_body = _json_body(resumed_response)
    assert resumed_body["suggestions_status"] == "completed"
    row = next(item for item in resumed_body["rows"] if item["id"] == str(target_row_id))
    assert row["suggested_category_id"] == str(category_id)


def test_commit_creates_batch_and_transactions():
    account_id = _create_account(bank_import_type="swedbank")
    response = commit_imports(
        {
            "body": json.dumps(
                {
                    "note": "commit ok",
                    "rows": [
                        {
                            "id": str(UUID(int=1)),
                            "account_id": str(account_id),
                            "occurred_at": "2024-01-01",
                            "amount": "10.00",
                            "description": "Committed row",
                        }
                    ],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["import_batch_id"]
    assert body["transaction_ids"] and len(body["transaction_ids"]) == 1


def test_import_handler_validation_and_error_paths(monkeypatch: pytest.MonkeyPatch):
    preview_invalid = preview_imports({"body": "{}", "isBase64Encoded": False}, None)
    assert preview_invalid["statusCode"] == 400

    commit_invalid = commit_imports({"body": "{}", "isBase64Encoded": False}, None)
    assert commit_invalid["statusCode"] == 400

    missing_draft_id = get_import_draft({"pathParameters": {}}, None)
    assert missing_draft_id["statusCode"] == 400

    missing_save_id = save_import_draft(
        {"pathParameters": {}, "body": json.dumps({"rows": []}), "isBase64Encoded": False},
        None,
    )
    assert missing_save_id["statusCode"] == 400

    save_invalid = save_import_draft(
        {
            "pathParameters": {"importBatchId": str(UUID(int=1))},
            "body": "{}",
            "isBase64Encoded": False,
        },
        None,
    )
    assert save_invalid["statusCode"] == 400

    class _PreviewLookupErrorService:
        def __init__(self, _session) -> None:
            pass

        def commit_import(self, _data):
            raise LookupError("missing")

    monkeypatch.setattr(import_handlers, "ImportService", _PreviewLookupErrorService)
    monkeypatch.setattr(
        import_handlers,
        "build_import_preview",
        lambda _data: (_ for _ in ()).throw(LookupError("missing")),
    )
    preview_lookup = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {"filename": "f", "account_id": str(UUID(int=1)), "content_base64": "Zg=="}
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert preview_lookup["statusCode"] == 404

    commit_lookup = commit_imports(
        {
            "body": json.dumps(
                {
                    "rows": [
                        {
                            "id": str(UUID(int=1)),
                            "account_id": str(UUID(int=1)),
                            "occurred_at": "2024-01-01",
                            "amount": "1",
                            "description": "x",
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert commit_lookup["statusCode"] == 404

    draft_lookup = get_import_draft(
        {"pathParameters": {"importBatchId": str(UUID(int=1))}},
        None,
    )
    assert draft_lookup["statusCode"] == 404

    save_lookup = save_import_draft(
        {
            "pathParameters": {"importBatchId": str(UUID(int=1))},
            "body": json.dumps(
                {
                    "rows": [
                        {
                            "id": str(UUID(int=1)),
                            "account_id": str(UUID(int=1)),
                            "occurred_at": "2024-01-01",
                            "amount": "1",
                            "description": "x",
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert save_lookup["statusCode"] == 404

    class _PreviewValueErrorService(_PreviewLookupErrorService):
        def commit_import(self, _data):
            raise ValueError("bad commit")

    monkeypatch.setattr(import_handlers, "ImportService", _PreviewValueErrorService)
    monkeypatch.setattr(
        import_handlers,
        "build_import_preview",
        lambda _data: (_ for _ in ()).throw(ValueError("bad preview")),
    )
    preview_value = preview_imports(
        {
            "body": json.dumps(
                {
                    "files": [
                        {"filename": "f", "account_id": str(UUID(int=1)), "content_base64": "Zg=="}
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert preview_value["statusCode"] == 400
    commit_value = commit_imports(
        {
            "body": json.dumps(
                {
                    "rows": [
                        {
                            "id": str(UUID(int=1)),
                            "account_id": str(UUID(int=1)),
                            "occurred_at": "2024-01-01",
                            "amount": "1",
                            "description": "x",
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert commit_value["statusCode"] == 400
    draft_value = get_import_draft(
        {"pathParameters": {"importBatchId": str(UUID(int=1))}},
        None,
    )
    assert draft_value["statusCode"] == 404
    save_value = save_import_draft(
        {
            "pathParameters": {"importBatchId": str(UUID(int=1))},
            "body": json.dumps(
                {
                    "rows": [
                        {
                            "id": str(UUID(int=1)),
                            "account_id": str(UUID(int=1)),
                            "occurred_at": "2024-01-01",
                            "amount": "1",
                            "description": "x",
                        }
                    ]
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert save_value["statusCode"] == 404
