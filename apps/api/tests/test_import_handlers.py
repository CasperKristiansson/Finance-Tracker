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
from apps.api.services import ImportService
from apps.api.shared import (
    AccountType,
    CategoryType,
    TransactionType,
    configure_engine,
    get_default_user_id,
    get_engine,
    scope_session_to_user,
)


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
    assert body["accounts"] and body["accounts"][0]["account_id"] == str(account_id)


def test_preview_returns_error_when_account_has_no_bank_type():
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
    assert file_meta["row_count"] == 0
    assert file_meta["error_count"] >= 1
    assert "bank import type" in file_meta["errors"][0]["message"].lower()


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


def test_preview_includes_related_transactions():
    account_id = _create_account(bank_import_type="swedbank")
    groceries_id = _create_category(name="Groceries")
    tx_id = _create_categorized_transaction(
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
    row_id = body["rows"][0]["id"]
    account_ctx = next(ctx for ctx in body["accounts"] if ctx["account_id"] == str(account_id))
    assert any(item["id"] == str(tx_id) for item in account_ctx["similar_transactions"])
    match = next(m for m in account_ctx["similar_by_row"] if m["row_id"] == row_id)
    assert str(tx_id) in match["transaction_ids"]


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


def test_delete_import_draft_fails_for_committed_batch():
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
    assert delete_response["statusCode"] == 400


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

    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        service = ImportService(session)
        service.mark_import_suggestions_running(import_batch_id)
        service.persist_import_suggestions(
            import_batch_id,
            suggestions=[
                ImportCategorySuggestionRead(
                    id=target_row_id,
                    category_id=category_id,
                    confidence=0.81,
                    reason="Matched prior grocery merchant",
                )
            ],
        )
        session.commit()

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
