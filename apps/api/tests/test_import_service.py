from __future__ import annotations

import base64
from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID, uuid4

import pytest
from sqlmodel import select

from apps.api.models import (
    Account,
    Category,
    ImportFile,
    ImportRow,
    ImportRule,
    TaxEvent,
    Transaction,
    TransactionImportBatch,
    TransactionLeg,
)
from apps.api.schemas.imports import (
    ImportCommitFile,
    ImportCommitRequest,
    ImportCommitRow,
    ImportDraftSaveRequest,
    ImportPreviewFile,
    ImportPreviewRequest,
)
from apps.api.services.imports.service import CategorySuggestion, ImportService, RuleMatch
from apps.api.shared import AccountType, BankImportType, CategoryType, TaxEventType, TransactionType

# pylint: disable=protected-access,use-implicit-booleaness-not-comparison


def _create_account(session, *, bank_import_type: str | None = "swedbank") -> Account:
    account = Account(
        name=f"Account-{uuid4()}",
        account_type=AccountType.NORMAL,
        bank_import_type=bank_import_type,
        is_active=True,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def _create_category(session, name: str = "Groceries") -> Category:
    category = Category(name=name, category_type=CategoryType.EXPENSE)
    session.add(category)
    session.commit()
    session.refresh(category)
    return category


def test_preview_import_covers_account_errors_and_suggestion_fallback(session, monkeypatch):
    account = _create_account(session, bank_import_type="swedbank")
    groceries = _create_category(session, name="Groceries")

    service = ImportService(session)

    def _parse_bank_rows(**_kwargs):
        return ([{"date": "2024-01-01", "description": "ICA 123", "amount": "-10.00"}], [])

    def _suggest_categories(_rows, _column_map, _rule_matches):
        return {
            0: CategorySuggestion(
                category_id=None, category="Groceries", confidence=0.91, reason="rule"
            )
        }

    def _match_transfers(_rows, _column_map):
        return {0: {"paired_with": 2}}

    monkeypatch.setattr("apps.api.services.imports.service.parse_bank_rows", _parse_bank_rows)
    monkeypatch.setattr("apps.api.services.imports.service.suggest_categories", _suggest_categories)
    monkeypatch.setattr("apps.api.services.imports.service.match_transfers", _match_transfers)
    monkeypatch.setattr(
        service,
        "_rule_matches",
        lambda *_args, **_kwargs: {
            0: RuleMatch(
                rule_id=uuid4(),
                category_id=groceries.id,
                category_name=groceries.name,
                summary="matched",
                score=0.9,
                rule_type="category",
            )
        },
    )

    payload = ImportPreviewRequest(
        files=[
            ImportPreviewFile(
                filename="ok.xlsx",
                account_id=account.id,
                content_base64=base64.b64encode(b"file").decode("utf-8"),
            ),
            ImportPreviewFile(
                filename="missing.xlsx",
                account_id=UUID(int=999),
                content_base64=base64.b64encode(b"file").decode("utf-8"),
            ),
        ],
        note="preview",
    )

    result = service.preview_import(payload)
    assert result["import_batch_id"]
    assert len(result["files"]) == 2
    first_row = result["rows"][0]
    assert first_row["suggested_category_id"] == groceries.id
    assert first_row["rule_applied"] is True
    assert first_row["transfer_match"] == {"paired_with": 2}
    assert result["accounts"][0]["similar_by_row"][0]["row_id"] == first_row["id"]
    assert any("Account not found" in err["message"] for err in result["files"][1]["errors"])


def test_list_import_drafts_skips_empty_and_committed_batches(session):
    service = ImportService(session)
    account = _create_account(session)

    empty_batch = TransactionImportBatch(source_name="empty")
    session.add(empty_batch)
    session.flush()

    open_batch = TransactionImportBatch(source_name="open")
    committed_batch = TransactionImportBatch(source_name="committed")
    session.add_all([open_batch, committed_batch])
    session.flush()

    open_file = ImportFile(
        batch_id=open_batch.id,
        filename="open.xlsx",
        account_id=account.id,
        row_count=1,
        error_count=0,
        status="draft",
        bank_type="swedbank",
    )
    committed_file = ImportFile(
        batch_id=committed_batch.id,
        filename="committed.xlsx",
        account_id=account.id,
        row_count=1,
        error_count=0,
        status="draft",
        bank_type="swedbank",
    )
    session.add_all([open_file, committed_file])
    session.flush()

    session.add(
        Transaction(
            transaction_type=TransactionType.TRANSFER,
            occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            import_batch_id=committed_batch.id,
        )
    )
    session.commit()

    drafts = service.list_import_drafts()["drafts"]
    assert len(drafts) == 1
    assert drafts[0]["import_batch_id"] == open_batch.id


def test_save_import_draft_errors_and_row_replacement_paths(session, monkeypatch):
    service = ImportService(session)
    account = _create_account(session)

    with pytest.raises(ValueError, match="No rows provided"):
        service.save_import_draft(uuid4(), ImportDraftSaveRequest(rows=[]))

    batch = TransactionImportBatch(source_name="draft")
    session.add(batch)
    session.flush()
    file_model = ImportFile(
        batch_id=batch.id,
        filename="draft.xlsx",
        account_id=account.id,
        row_count=1,
        error_count=0,
        status="draft",
        bank_type="swedbank",
    )
    session.add(file_model)
    session.flush()

    existing_row = ImportRow(
        file_id=file_model.id,
        row_index=1,
        data={
            "account_id": str(account.id),
            "occurred_at": "2024-01-01",
            "amount": "10",
            "description": "Old",
            "draft": {"x": 1},
        },
    )
    stale_draft_row = ImportRow(
        file_id=file_model.id,
        row_index=2,
        data={
            "account_id": str(account.id),
            "occurred_at": "2024-01-02",
            "amount": "20",
            "description": "Tmp",
            "is_draft_row": True,
        },
    )
    session.add_all([existing_row, stale_draft_row])
    session.commit()

    row_payload = ImportCommitRow(
        id=existing_row.id,
        file_id=file_model.id,
        account_id=account.id,
        occurred_at="2024-01-03",
        amount="30",
        description="Updated",
    )
    saved = service.save_import_draft(
        batch.id,
        ImportDraftSaveRequest(rows=[row_payload]),
    )
    assert saved["import_batch_id"] == batch.id

    persisted = session.get(ImportRow, existing_row.id)
    assert persisted is not None
    assert persisted.row_index == 1
    assert persisted.data["draft"]["description"] == "Updated"
    assert stale_draft_row in session.deleted

    # Committed batch path.
    session.add(
        Transaction(
            transaction_type=TransactionType.TRANSFER,
            occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            import_batch_id=batch.id,
        )
    )
    session.commit()
    with pytest.raises(ValueError, match="already committed"):
        service.save_import_draft(batch.id, ImportDraftSaveRequest(rows=[row_payload]))

    # Force no files branch after batch load.
    monkeypatch.setattr(
        service,
        "_load_batch",
        lambda _batch_id: SimpleNamespace(id=uuid4(), files=[]),
    )
    monkeypatch.setattr(service, "_batch_has_transactions", lambda _batch_id: False)
    with pytest.raises(LookupError, match="Import batch not found"):
        service.save_import_draft(uuid4(), ImportDraftSaveRequest(rows=[row_payload]))


def test_resolve_draft_row_file_id_variants(session):
    service = ImportService(session)
    file_a = uuid4()
    file_b = uuid4()
    file_by_id = {
        file_a: SimpleNamespace(id=file_a),
        file_b: SimpleNamespace(id=file_b),
    }

    row_with_file = SimpleNamespace(file_id=file_a)
    assert (
        service._resolve_draft_row_file_id(
            row=row_with_file,
            file_by_id=file_by_id,
            persisted=None,
        )
        == file_a
    )

    persisted = SimpleNamespace(file_id=file_b)
    row_without_file = SimpleNamespace(file_id=None)
    assert (
        service._resolve_draft_row_file_id(
            row=row_without_file,
            file_by_id=file_by_id,
            persisted=persisted,
        )
        == file_b
    )

    with pytest.raises(ValueError, match="unknown file"):
        service._resolve_draft_row_file_id(
            row=SimpleNamespace(file_id=uuid4()),
            file_by_id=file_by_id,
            persisted=None,
        )

    with pytest.raises(ValueError, match="must include file_id"):
        service._resolve_draft_row_file_id(
            row=row_without_file,
            file_by_id=file_by_id,
            persisted=None,
        )


def test_commit_import_file_storage_paths_and_runtime_errors(session, monkeypatch):
    service = ImportService(session)
    account = _create_account(session)

    with pytest.raises(ValueError, match="No rows provided"):
        service.commit_import(ImportCommitRequest(rows=[]))

    with pytest.raises(LookupError, match="Import batch not found"):
        service.commit_import(
            ImportCommitRequest(
                import_batch_id=uuid4(),
                rows=[
                    ImportCommitRow(
                        id=uuid4(),
                        account_id=account.id,
                        occurred_at="2024-01-01",
                        amount="10",
                        description="x",
                    )
                ],
            )
        )

    class _StorageFail:
        def build_object_key(self, **_kwargs):
            return "k"

        def upload_file(self, **_kwargs):
            raise RuntimeError("fail")

    file_id = uuid4()
    with pytest.raises(RuntimeError, match="fail"):
        service_with_bad_storage = ImportService(session, storage=_StorageFail())
        service_with_bad_storage.commit_import(
            ImportCommitRequest(
                rows=[
                    ImportCommitRow(
                        id=uuid4(),
                        account_id=account.id,
                        occurred_at="2024-01-01",
                        amount="10",
                        description="x",
                        file_id=file_id,
                    )
                ],
                files=[
                    ImportCommitFile(
                        id=file_id,
                        filename="f.xlsx",
                        account_id=account.id,
                        row_count=1,
                        error_count=0,
                        bank_import_type=BankImportType.SWEDBANK,
                        content_base64=base64.b64encode(b"x").decode("utf-8"),
                    )
                ],
            )
        )

    monkeypatch.setattr(
        "apps.api.services.imports.service.ImportFileStorage.from_env",
        lambda: (_ for _ in ()).throw(RuntimeError("missing env")),
    )
    with pytest.raises(RuntimeError, match="missing env"):
        ImportService(session).commit_import(
            ImportCommitRequest(
                rows=[
                    ImportCommitRow(
                        id=uuid4(),
                        account_id=account.id,
                        occurred_at="2024-01-01",
                        amount="10",
                        description="x",
                    )
                ],
                files=[
                    ImportCommitFile(
                        id=uuid4(),
                        filename="f.xlsx",
                        account_id=account.id,
                        row_count=1,
                        error_count=0,
                        bank_import_type=BankImportType.SWEDBANK,
                        content_base64=base64.b64encode(b"x").decode("utf-8"),
                    )
                ],
            )
        )


def test_commit_import_tax_events_rules_and_file_updates(session):
    account = _create_account(session)
    transfer_account = _create_account(session)
    groceries = _create_category(session, "Groceries")

    class _StorageOK:
        def __init__(self) -> None:
            self.uploaded: list[str] = []

        def build_object_key(self, **kwargs):
            return f"{kwargs['batch_id']}/{kwargs['file_id']}/{kwargs['filename']}"

        def upload_file(self, **kwargs):
            self.uploaded.append(kwargs["key"])

    storage = _StorageOK()
    service = ImportService(session, storage=storage)

    file_id = uuid4()
    row_id = uuid4()
    tax_row_id = uuid4()
    transfer_row_id = uuid4()

    batch_payload = ImportCommitRequest(
        note="import",
        files=[
            ImportCommitFile(
                id=file_id,
                filename="file.xlsx",
                account_id=account.id,
                row_count=3,
                error_count=0,
                bank_import_type=BankImportType.SWEDBANK,
                content_base64=base64.b64encode(b"content").decode("utf-8"),
            )
        ],
        rows=[
            ImportCommitRow(
                id=row_id,
                file_id=file_id,
                account_id=account.id,
                occurred_at="2024-01-01",
                amount="-99.00",
                description="ICA Maxi",
                category_id=groceries.id,
            ),
            ImportCommitRow(
                id=tax_row_id,
                file_id=file_id,
                account_id=account.id,
                occurred_at="2024-01-02",
                amount="100.00",
                description="Tax refund",
                tax_event_type=TaxEventType.REFUND,
            ),
            ImportCommitRow(
                id=transfer_row_id,
                file_id=file_id,
                account_id=account.id,
                transfer_account_id=transfer_account.id,
                occurred_at="2024-01-03",
                amount="25.00",
                description="Transfer",
            ),
            ImportCommitRow(
                id=uuid4(),
                file_id=file_id,
                account_id=account.id,
                occurred_at="2024-01-04",
                amount="10.00",
                description="Ignored",
                delete=True,
            ),
        ],
    )

    committed = service.commit_import(batch_payload)
    assert len(committed["transaction_ids"]) == 3
    assert storage.uploaded

    batch_id = committed["import_batch_id"]
    rules = list(session.exec(select(ImportRule)).all())
    assert any(rule.matcher_text == "ica maxi" for rule in rules)
    assert session.exec(select(TaxEvent)).all()

    stored_files = list(
        session.exec(select(ImportFile).where(ImportFile.batch_id == batch_id)).all()
    )
    assert stored_files and stored_files[0].status == "processed"


def test_commit_import_validation_branches(session):
    service = ImportService(session)
    account = _create_account(session)

    with pytest.raises(ValueError, match="Date is not a valid ISO date"):
        service.commit_import(
            ImportCommitRequest(
                rows=[
                    ImportCommitRow(
                        id=uuid4(),
                        account_id=account.id,
                        occurred_at="not-a-date",
                        amount="10",
                        description="x",
                    )
                ]
            )
        )

    with pytest.raises(ValueError, match="Amount must be numeric"):
        service.commit_import(
            ImportCommitRequest(
                rows=[
                    ImportCommitRow(
                        id=uuid4(),
                        account_id=account.id,
                        occurred_at="2024-01-01",
                        amount="not-a-number",
                        description="x",
                    )
                ]
            )
        )

    with pytest.raises(ValueError, match="Description is required"):
        service.commit_import(
            ImportCommitRequest(
                rows=[
                    ImportCommitRow(
                        id=uuid4(),
                        account_id=account.id,
                        occurred_at="2024-01-01",
                        amount="10",
                        description=" ",
                    )
                ]
            )
        )

    with pytest.raises(ValueError, match="unknown import file"):
        service.commit_import(
            ImportCommitRequest(
                rows=[
                    ImportCommitRow(
                        id=uuid4(),
                        file_id=uuid4(),
                        account_id=account.id,
                        occurred_at="2024-01-01",
                        amount="10",
                        description="x",
                    )
                ]
            )
        )


def test_import_service_misc_helpers_and_rule_updates(session):
    service = ImportService(session)
    category = _create_category(session, "Food")

    assert service._coerce_uuid(category.id) == category.id
    assert service._coerce_uuid(str(category.id)) == category.id
    assert service._coerce_uuid("bad") is None

    assert service._coerce_bank_import_type(None) is None
    assert service._coerce_bank_import_type("") is None
    assert service._coerce_bank_import_type("swedbank") == BankImportType.SWEDBANK
    assert service._coerce_bank_import_type("invalid") is None

    valid_bytes = service._decode_base64(base64.b64encode(b"ok").decode("utf-8"))
    assert valid_bytes == b"ok"
    with pytest.raises(ValueError, match="Unable to decode"):
        service._decode_base64("not-base64")

    assert service._merchant_tokens("Payment to ICA Maxi Stockholm")
    assert service._merchant_tokens("se ab card payment") == []
    assert service._parse_date("2024-01-01") is not None

    assert not service._validate_rows([], None)
    assert service._validate_rows([{"x": 1}], None)
    assert service._validate_rows(
        [{"date": "", "description": "", "amount": ""}],
        {"date": "date", "description": "description", "amount": "amount"},
    )

    with pytest.raises(ValueError, match="must include file_id"):
        service._resolve_draft_row_file_id(
            row=SimpleNamespace(file_id=None),
            file_by_id={uuid4(): SimpleNamespace(), uuid4(): SimpleNamespace()},
            persisted=None,
        )

    empty_similar = service._similar_transactions_for_account(uuid4(), merchant_tokens=[], limit=5)
    assert not empty_similar

    # Rule scoring and recording paths.
    inactive_rule = ImportRule(matcher_text="ica", category_id=category.id, is_active=False)
    assert (
        service._score_rule(
            inactive_rule,
            "ica maxi",
            Decimal("100"),
            datetime.now(timezone.utc),
            {category.id: category},
        )
        is None
    )

    active_rule = ImportRule(
        matcher_text="ica",
        matcher_amount=Decimal("100"),
        amount_tolerance=Decimal("5"),
        matcher_day_of_month=10,
        category_id=category.id,
        is_active=True,
    )
    matched = service._score_rule(
        active_rule,
        "ICA MAXI",
        Decimal("103"),
        datetime(2024, 1, 10, tzinfo=timezone.utc),
        {category.id: category},
    )
    assert matched is not None

    no_day_match = service._score_rule(
        active_rule,
        "ICA MAXI",
        Decimal("103"),
        datetime(2024, 1, 1, tzinfo=timezone.utc),
        {category.id: category},
    )
    assert no_day_match is None

    no_category = service._score_rule(
        ImportRule(matcher_text="ica", is_active=True, category_id=uuid4()),
        "ICA MAXI",
        Decimal("100"),
        datetime(2024, 1, 10, tzinfo=timezone.utc),
        {},
    )
    assert no_category is None

    service._record_rule_from_row(
        "ICA Maxi", Decimal("99"), datetime(2024, 1, 15, tzinfo=timezone.utc), category.id
    )
    created_rule = session.exec(
        select(ImportRule).where(ImportRule.matcher_text == "ica maxi")
    ).one()
    assert created_rule.amount_tolerance is not None

    service._record_rule_from_row(
        "ICA Maxi", Decimal("101"), datetime(2024, 1, 16, tzinfo=timezone.utc), category.id
    )
    updated_rule = session.exec(select(ImportRule).where(ImportRule.id == created_rule.id)).one()
    assert updated_rule.category_id == category.id

    # Existing offset account branch and cache branch.
    offset = Account(name="", account_type=AccountType.NORMAL, is_active=False)
    session.add(offset)
    session.commit()
    offset_a = service._get_or_create_offset_account()
    offset_b = service._get_or_create_offset_account()
    assert offset_a.id == offset_b.id
    assert offset_a.name == "Offset"


def test_commit_import_updates_existing_file_without_transactions(session):
    account = _create_account(session)

    class _StorageOK:
        def build_object_key(self, **kwargs):
            return f"{kwargs['batch_id']}/{kwargs['file_id']}/{kwargs['filename']}"

        def upload_file(self, **_kwargs):
            return None

    service = ImportService(session, storage=_StorageOK())
    file_id = uuid4()

    first = service.commit_import(
        ImportCommitRequest(
            note="first",
            files=[
                ImportCommitFile(
                    id=file_id,
                    filename="file.xlsx",
                    account_id=account.id,
                    row_count=0,
                    error_count=0,
                    bank_import_type=BankImportType.SWEDBANK,
                    content_base64=base64.b64encode(b"content").decode("utf-8"),
                )
            ],
            rows=[
                ImportCommitRow(
                    id=uuid4(),
                    file_id=file_id,
                    account_id=account.id,
                    occurred_at="2024-01-01",
                    amount="10.00",
                    description="ignored",
                    delete=True,
                )
            ],
        )
    )
    batch_id = first["import_batch_id"]

    second = service.commit_import(
        ImportCommitRequest(
            import_batch_id=batch_id,
            note="second",
            files=[
                ImportCommitFile(
                    id=file_id,
                    filename="file-renamed.xlsx",
                    account_id=account.id,
                    row_count=0,
                    error_count=0,
                    bank_import_type=BankImportType.SWEDBANK,
                    content_base64=base64.b64encode(b"content-2").decode("utf-8"),
                )
            ],
            rows=[
                ImportCommitRow(
                    id=uuid4(),
                    file_id=file_id,
                    account_id=account.id,
                    occurred_at="2024-01-02",
                    amount="5.00",
                    description="ignored",
                    delete=True,
                )
            ],
        )
    )
    assert second["import_batch_id"] == batch_id


def test_import_service_additional_branch_paths(session):
    service = ImportService(session)
    account = _create_account(session)
    category = _create_category(session, "Utilities")

    with pytest.raises(LookupError, match="Import batch not found"):
        service.get_import_draft(uuid4())

    batch = TransactionImportBatch(source_name="draft")
    session.add(batch)
    session.flush()
    file_model = ImportFile(
        batch_id=batch.id,
        filename="draft.xlsx",
        account_id=account.id,
        row_count=1,
        error_count=0,
        status="draft",
        bank_type="swedbank",
    )
    session.add(file_model)
    session.flush()
    existing_row = ImportRow(
        file_id=file_model.id,
        row_index=1,
        data={
            "account_id": str(account.id),
            "occurred_at": "2024-01-01",
            "amount": "10",
            "description": "Persisted",
            "draft": {"keep": True},
        },
        suggested_category="Utilities",
        suggested_confidence=Decimal("0.75"),
        suggested_reason="rule",
        transfer_match={"paired_with": 2},
        rule_applied=True,
        rule_type="category",
        rule_summary="matched",
    )
    session.add(existing_row)
    session.commit()

    # New row without file_id should use the single-file fallback and create ImportRow.
    new_row_id = uuid4()
    saved = service.save_import_draft(
        batch.id,
        ImportDraftSaveRequest(
            rows=[
                ImportCommitRow(
                    id=new_row_id,
                    account_id=account.id,
                    occurred_at="2024-01-02",
                    amount="20.00",
                    description="New row",
                )
            ]
        ),
    )
    assert saved["import_batch_id"] == batch.id
    created = session.get(ImportRow, new_row_id)
    assert created is not None
    assert created.data.get("is_draft_row") is True

    preview = service.get_import_draft(batch.id)
    assert preview["files"][0]["preview_rows"]

    # Cover similar transaction branches with empty description candidate and per-row empty token case.
    tx = Transaction(
        transaction_type=TransactionType.EXPENSE,
        category_id=category.id,
        description="",
        occurred_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
    )
    session.add(tx)
    session.flush()
    session.add(
        TransactionLeg(
            transaction_id=tx.id,
            account_id=account.id,
            amount=Decimal("-10"),
        )
    )
    session.add(
        TaxEvent(
            transaction_id=tx.id,
            event_type=TaxEventType.PAYMENT,
        )
    )
    session.add(
        ImportRule(
            matcher_text="electricity",
            category_id=category.id,
            is_active=True,
        )
    )
    session.flush()
    session.add(
        ImportRow(
            file_id=file_model.id,
            row_index=99,
            data={
                "account_id": str(account.id),
                "occurred_at": "2024-01-03",
                "amount": "30.00",
                "description": "Electricity bill",
            },
        )
    )
    tx_match = Transaction(
        transaction_type=TransactionType.EXPENSE,
        category_id=category.id,
        description="electricity stockholm",
        occurred_at=datetime(2024, 1, 11, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 11, tzinfo=timezone.utc),
    )
    session.add(tx_match)
    session.flush()
    session.add(
        TransactionLeg(
            transaction_id=tx_match.id,
            account_id=account.id,
            amount=Decimal("-11"),
        )
    )
    session.add(
        ImportRule(
            matcher_text="existing",
            category_id=category.id,
            is_active=True,
            matcher_amount=None,
            amount_tolerance=None,
            matcher_day_of_month=None,
        )
    )
    session.commit()

    context = service._build_account_context(
        account_id=account.id,
        row_entries=[(uuid4(), ""), (uuid4(), "Electricity bill January")],
        category_lookup_by_id={category.id: category},
    )
    assert context["similar_by_row"]

    assert service._validate_rows(
        [{"date": "2024-01-01", "description": "x", "amount": "10"}],
        {"date": "date", "description": None, "amount": "amount"},
    )
    assert (
        service._rule_matches(
            rows=[{"description": "x"}],
            column_map={"date": "date", "amount": "amount"},
            category_lookup={category.id: category},
        )
        == {}
    )
    assert (
        service._score_rule(
            ImportRule(matcher_text="nomatch", category_id=category.id, is_active=True),
            "other text",
            Decimal("10"),
            datetime(2024, 1, 1, tzinfo=timezone.utc),
            {category.id: category},
        )
        is None
    )
    assert (
        service._score_rule(
            ImportRule(
                matcher_text="electricity",
                category_id=category.id,
                matcher_amount=Decimal("100"),
                amount_tolerance=Decimal("1"),
                is_active=True,
            ),
            "electricity bill",
            Decimal("120"),
            datetime(2024, 1, 1, tzinfo=timezone.utc),
            {category.id: category},
        )
        is None
    )

    service._record_rule_from_row("   ", Decimal("10"), datetime.now(timezone.utc), category.id)
    service._record_rule_from_row("existing", Decimal("40"), datetime(2024, 1, 20), category.id)
    existing = session.exec(select(ImportRule).where(ImportRule.matcher_text == "existing")).one()
    assert existing.matcher_amount == Decimal("40")
    assert existing.amount_tolerance is not None
    assert existing.matcher_day_of_month == 20
    assert service._derive_amount_tolerance(None) is None


def test_import_service_rule_matching_preview_and_commit_guard_paths(session, monkeypatch):
    service = ImportService(session)
    account = _create_account(session)
    category = _create_category(session, "Rent")
    session.add(ImportRule(matcher_text="rent", category_id=category.id, is_active=True))
    session.commit()

    matches = service._rule_matches(
        rows=[{"description": "Monthly rent", "amount": "1000", "date": "2024-02-01"}],
        column_map={"description": "description", "amount": "amount", "date": "date"},
        category_lookup={category.id: category},
    )
    assert 0 in matches

    errors = service._validate_rows(
        [{"description": "x", "amount": "not-a-number", "date": "bad-date"}],
        {"description": "description", "amount": "amount", "date": "date"},
    )
    assert any("numeric" in message for _row, message in errors)
    assert any("valid ISO date" in message for _row, message in errors)

    batch = TransactionImportBatch(source_name="draft")
    session.add(batch)
    session.flush()
    file_a = ImportFile(
        batch_id=batch.id,
        filename="a.xlsx",
        account_id=account.id,
        row_count=1,
        error_count=0,
        status="draft",
        bank_type="swedbank",
    )
    file_b = ImportFile(
        batch_id=batch.id,
        filename="b.xlsx",
        account_id=account.id,
        row_count=1,
        error_count=0,
        status="draft",
        bank_type="swedbank",
    )
    session.add_all([file_a, file_b])
    session.flush()
    moved_row = ImportRow(
        file_id=file_a.id,
        row_index=1,
        data={
            "account_id": str(account.id),
            "occurred_at": "2024-01-01",
            "amount": "10",
            "description": "Move me",
        },
    )
    session.add(moved_row)
    session.commit()

    service.save_import_draft(
        batch.id,
        ImportDraftSaveRequest(
            rows=[
                ImportCommitRow(
                    id=moved_row.id,
                    file_id=file_b.id,
                    account_id=account.id,
                    occurred_at="2024-01-01",
                    amount="10",
                    description="Move me",
                )
            ]
        ),
    )
    assert session.get(ImportRow, moved_row.id).file_id == file_b.id

    custom_row = SimpleNamespace(
        id=uuid4(),
        row_index=1,
        data={"occurred_at": "2024-01-01", "amount": "10", "description": "Subscription row"},
        suggested_category=None,
        suggested_confidence=None,
        suggested_reason=None,
        transfer_match=None,
        rule_applied=False,
        rule_type=None,
        rule_summary=None,
        suggested_subscription_id=uuid4(),
        suggested_subscription_name="Gym",
        suggested_subscription_confidence=Decimal("0.85"),
        suggested_subscription_reason="Recurring amount",
    )
    custom_file = SimpleNamespace(
        id=uuid4(),
        filename="custom.xlsx",
        account_id=account.id,
        bank_type="swedbank",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        row_count=1,
        error_count=0,
        rows=[custom_row],
        errors=[],
    )
    custom_batch = SimpleNamespace(
        id=uuid4(),
        note=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        files=[custom_file],
    )
    monkeypatch.setattr(service, "_category_lookup_by_id", lambda: {})
    preview = service._build_preview_from_batch(custom_batch)
    assert "suggested_subscription_name" not in preview["files"][0]["preview_rows"][0]
    assert len(preview["rows"]) == 1

    similar_candidates = [
        SimpleNamespace(
            id=uuid4(),
            description="",
            category_id=None,
            occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            id=uuid4(),
            description="rent stockholm one",
            category_id=category.id,
            occurred_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            id=uuid4(),
            description="rent stockholm two",
            category_id=category.id,
            occurred_at=datetime(2024, 1, 3, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            id=uuid4(),
            description="rent stockholm three",
            category_id=category.id,
            occurred_at=datetime(2024, 1, 4, tzinfo=timezone.utc),
        ),
        SimpleNamespace(
            id=uuid4(),
            description="rent stockholm four",
            category_id=category.id,
            occurred_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
        ),
    ]
    monkeypatch.setattr(service, "_latest_transactions_for_account", lambda *_args, **_kwargs: [])
    monkeypatch.setattr(
        service,
        "_similar_transactions_for_account",
        lambda *_args, **_kwargs: similar_candidates,
    )
    ctx = service._build_account_context(
        account_id=account.id,
        row_entries=[(uuid4(), "Rent Stockholm monthly")],
        category_lookup_by_id={category.id: category},
        per_row_limit=3,
    )
    assert len(ctx["similar_by_row"][0]["transaction_ids"]) == 3

    committed_batch = TransactionImportBatch(source_name="committed")
    session.add(committed_batch)
    session.flush()
    session.add(
        Transaction(
            transaction_type=TransactionType.TRANSFER,
            occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
            import_batch_id=committed_batch.id,
        )
    )
    session.commit()

    with pytest.raises(ValueError, match="already committed"):
        service.commit_import(
            ImportCommitRequest(
                import_batch_id=committed_batch.id,
                rows=[
                    ImportCommitRow(
                        id=uuid4(),
                        account_id=account.id,
                        occurred_at="2024-01-02",
                        amount="5.00",
                        description="x",
                        delete=True,
                    )
                ],
            )
        )


def test_import_service_build_preview_skips_rows_without_account_id(session, monkeypatch):
    service = ImportService(session)

    class _PreviewEnvelope:
        def __init__(self, payload):
            self._payload = payload

        def model_dump(self, mode="python"):  # pylint: disable=unused-argument
            return self._payload

    monkeypatch.setattr(
        "apps.api.services.imports.draft_mixin.ImportPreviewResponse",
        SimpleNamespace(model_validate=lambda payload: _PreviewEnvelope(payload)),
    )
    monkeypatch.setattr(service, "_category_lookup_by_id", lambda: {})

    row = SimpleNamespace(
        id=uuid4(),
        row_index=1,
        data={"description": "No account"},
        suggested_category=None,
        suggested_confidence=None,
        suggested_reason=None,
        transfer_match=None,
        rule_applied=False,
        rule_type=None,
        rule_summary=None,
        suggested_subscription_id=None,
        suggested_subscription_name=None,
        suggested_subscription_confidence=None,
        suggested_subscription_reason=None,
    )
    file_item = SimpleNamespace(
        id=uuid4(),
        filename="missing-account.xlsx",
        account_id=None,
        bank_type="swedbank",
        created_at=datetime.now(timezone.utc),
        row_count=1,
        error_count=0,
        rows=[row],
        errors=[],
    )
    batch = SimpleNamespace(id=uuid4(), files=[file_item])
    preview = service._build_preview_from_batch(batch)
    assert preview["rows"] == []


def test_import_service_account_context_token_dedupe_and_breaks(session, monkeypatch):
    service = ImportService(session)
    account = _create_account(session)
    monkeypatch.setattr(service, "_latest_transactions_for_account", lambda *_args, **_kwargs: [])
    monkeypatch.setattr(service, "_similar_transactions_for_account", lambda *_args, **_kwargs: [])

    context = service._build_account_context(
        account_id=account.id,
        row_entries=[(uuid4(), "alpha alpha beta gamma delta epsilon zeta eta theta iota")],
        category_lookup_by_id={},
    )
    assert context["similar_transactions"] == []


def test_import_service_preview_and_rule_matching_branch_coverage(session, monkeypatch):
    account = _create_account(session, bank_import_type="swedbank")
    service = ImportService(session)

    monkeypatch.setattr(
        "apps.api.services.imports.service.parse_bank_rows",
        lambda **_kwargs: (
            [
                {"date": "2024-01-01", "description": "Groceries", "amount": "-10"},
                {"date": "2024-01-02", "description": "Transport", "amount": "-5"},
            ],
            [],
        ),
    )
    monkeypatch.setattr(
        "apps.api.services.imports.service.match_transfers",
        lambda *_args, **_kwargs: {},
    )
    monkeypatch.setattr(
        "apps.api.services.imports.service.suggest_categories",
        lambda *_args, **_kwargs: {
            0: CategorySuggestion(
                category_id=None,
                category="Groceries",
                confidence=0.8,
                reason=None,
            )
        },
    )
    monkeypatch.setattr(service, "_rule_matches", lambda *_args, **_kwargs: {})

    preview = service.preview_import(
        ImportPreviewRequest(
            files=[
                ImportPreviewFile(
                    filename="rows.xlsx",
                    account_id=account.id,
                    content_base64=base64.b64encode(b"content").decode("utf-8"),
                )
            ]
        )
    )
    assert len(preview["rows"]) == 2
    assert preview["rows"][0]["suggested_category_name"] == "Groceries"
    assert preview["rows"][1]["suggested_category_name"] is None

    persisted_batch = service._persist_preview_batch(note=None, files=[], rows=[])
    assert persisted_batch is not None

    service_for_rules = ImportService(session)
    rule_a = SimpleNamespace(rule_id=uuid4())
    rule_b = SimpleNamespace(rule_id=uuid4())
    scored = [
        RuleMatch(
            rule_id=uuid4(),
            category_id=None,
            category_name="A",
            summary="high",
            score=0.9,
            rule_type="category",
        ),
        RuleMatch(
            rule_id=uuid4(),
            category_id=None,
            category_name="B",
            summary="low",
            score=0.5,
            rule_type="category",
        ),
        None,
        None,
    ]
    monkeypatch.setattr(service_for_rules, "_active_rules", lambda: [rule_a, rule_b])
    monkeypatch.setattr(service_for_rules, "_score_rule", lambda *_args, **_kwargs: scored.pop(0))
    matches = service_for_rules._rule_matches(
        rows=[
            {"description": "a", "amount": "10", "date": "2024-01-01"},
            {"description": "b", "amount": "11", "date": "2024-01-02"},
        ],
        column_map={"description": "description", "amount": "amount", "date": "date"},
        category_lookup={},
    )
    assert 0 in matches
    assert 1 not in matches


def test_import_service_record_rule_existing_without_category_id(session):
    service = ImportService(session)
    existing = ImportRule(
        matcher_text="existing-nocat",
        category_id=None,
        is_active=True,
        matcher_amount=None,
        amount_tolerance=None,
        matcher_day_of_month=None,
    )
    session.add(existing)
    session.commit()

    service._record_rule_from_row(
        "existing-nocat",
        Decimal("15"),
        datetime(2024, 1, 21, tzinfo=timezone.utc),
        0,  # type: ignore[arg-type]
    )
    refreshed = session.exec(
        select(ImportRule).where(ImportRule.matcher_text == "existing-nocat")
    ).one()
    assert refreshed.matcher_amount == Decimal("15")
    assert refreshed.matcher_day_of_month == 21
