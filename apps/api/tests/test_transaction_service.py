from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import UUID

import pytest
from sqlmodel import select

from apps.api.models import (
    Account,
    Category,
    ImportFile,
    InvestmentSnapshot,
    Loan,
    Transaction,
    TransactionImportBatch,
    TransactionLeg,
)
from apps.api.services.transaction import TransactionService
from apps.api.shared import (
    AccountType,
    CategoryType,
    InterestCompound,
    LoanEventType,
    TransactionType,
)

# pylint: disable=protected-access


def _balanced_legs(a: UUID, b: UUID, amount: Decimal) -> list[TransactionLeg]:
    return [
        TransactionLeg(account_id=a, amount=amount),
        TransactionLeg(account_id=b, amount=-amount),
    ]


def test_infer_transaction_type_paths(session) -> None:
    service = TransactionService(session)
    account_a = Account(name="A", account_type=AccountType.NORMAL)
    account_b = Account(name="B", account_type=AccountType.NORMAL)
    category_income = Category(name="Salary", category_type=CategoryType.INCOME)
    session.add_all([account_a, account_b, category_income])
    session.commit()

    legs = _balanced_legs(account_a.id, account_b.id, Decimal("100"))

    assert (
        service._infer_transaction_type(legs, None, TransactionType.INVESTMENT_EVENT)
        == TransactionType.INVESTMENT_EVENT
    )
    assert (
        service._infer_transaction_type(legs, None, TransactionType.ADJUSTMENT)
        == TransactionType.ADJUSTMENT
    )
    assert (
        service._infer_transaction_type(legs, category_income, TransactionType.TRANSFER)
        == TransactionType.INCOME
    )
    assert (
        service._infer_transaction_type(legs, None, TransactionType.EXPENSE)
        == TransactionType.EXPENSE
    )
    assert (
        service._infer_transaction_type(legs, None, TransactionType.TRANSFER)
        == TransactionType.TRANSFER
    )


def test_snapshot_external_id_parser(session) -> None:
    service = TransactionService(session)
    snapshot_id = UUID(int=42)
    assert (
        service._snapshot_id_from_external_id(f"investment_snapshot:{snapshot_id}") == snapshot_id
    )
    assert service._snapshot_id_from_external_id("other:123") is None
    assert service._snapshot_id_from_external_id("investment_snapshot:not-a-uuid") is None
    assert service._snapshot_id_from_external_id(None) is None


def test_update_and_delete_investment_snapshot_side_effects(session) -> None:
    service = TransactionService(session)
    account_a = Account(name="Broker", account_type=AccountType.INVESTMENT)
    account_b = Account(name="Offset", account_type=AccountType.NORMAL, is_active=False)
    session.add_all([account_a, account_b])
    session.commit()

    snapshot = InvestmentSnapshot(
        provider="manual",
        report_type="portfolio_report",
        account_name="Broker",
        snapshot_date=date(2024, 1, 1),
        portfolio_value=Decimal("100"),
        raw_text="old",
        parsed_payload={"accounts": {"Broker": 100}},
    )
    session.add(snapshot)
    session.commit()
    session.refresh(snapshot)

    transaction = Transaction(
        transaction_type=TransactionType.INVESTMENT_EVENT,
        occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        external_id=f"investment_snapshot:{snapshot.id}",
        description="before",
    )
    created = service.create_transaction(
        transaction,
        _balanced_legs(account_a.id, account_b.id, Decimal("10")),
    )

    updated = service.update_transaction(
        created.id,
        occurred_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
        notes="  updated note  ",
    )
    assert updated.id == created.id

    synced = session.exec(
        select(InvestmentSnapshot).where(InvestmentSnapshot.id == snapshot.id)
    ).one()
    assert synced.snapshot_date == date(2024, 2, 1)
    assert synced.raw_text == "updated note"

    service.delete_transaction(created.id)
    assert (
        session.exec(select(InvestmentSnapshot).where(InvestmentSnapshot.id == snapshot.id)).first()
        is None
    )


def test_add_transaction_leg_and_missing_lookup(session) -> None:
    service = TransactionService(session)
    account_a = Account(name="A", account_type=AccountType.NORMAL)
    account_b = Account(name="B", account_type=AccountType.NORMAL)
    session.add_all([account_a, account_b])
    session.commit()

    transaction = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    created = service.create_transaction(
        transaction,
        _balanced_legs(account_a.id, account_b.id, Decimal("20")),
    )

    new_leg = service.add_transaction_leg(
        created.id, TransactionLeg(account_id=account_a.id, amount=Decimal("5"))
    )
    assert new_leg.transaction_id == created.id

    with pytest.raises(LookupError, match="Transaction not found"):
        service.add_transaction_leg(
            UUID(int=999), TransactionLeg(account_id=account_a.id, amount=Decimal("1"))
        )
    with pytest.raises(LookupError, match="Transaction not found"):
        service.update_transaction(UUID(int=999), description="x")
    with pytest.raises(LookupError, match="Transaction not found"):
        service.delete_transaction(UUID(int=999))


def test_create_transaction_records_loan_events(session) -> None:
    service = TransactionService(session)
    debt = Account(name="Loan Account", account_type=AccountType.DEBT)
    offset = Account(name="Offset", account_type=AccountType.NORMAL, is_active=False)
    session.add_all([debt, offset])
    session.commit()
    loan = Loan(
        account_id=debt.id,
        origin_principal=Decimal("1000"),
        current_principal=Decimal("1000"),
        interest_rate_annual=Decimal("0.05"),
        interest_compound=InterestCompound.MONTHLY,
    )
    category_interest = Category(name="Interest", category_type=CategoryType.INTEREST)
    category_loan = Category(name="Loan", category_type=CategoryType.LOAN)
    session.add_all([loan, category_interest, category_loan])
    session.commit()

    interest_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        category_id=category_interest.id,
        occurred_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
    )
    service.create_transaction(
        interest_tx,
        _balanced_legs(debt.id, offset.id, Decimal("-50")),
    )

    principal_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        category_id=category_loan.id,
        occurred_at=datetime(2024, 1, 11, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 11, tzinfo=timezone.utc),
    )
    service.create_transaction(
        principal_tx,
        _balanced_legs(debt.id, offset.id, Decimal("200")),
    )

    events = service.list_loan_events(loan.id)
    assert len(events) >= 2
    event_types = {event.event_type for event in events}
    assert LoanEventType.PAYMENT_INTEREST in event_types
    assert LoanEventType.DISBURSEMENT in event_types


def test_classify_loan_event_zero_amount_returns_none(session) -> None:
    service = TransactionService(session)
    category = Category(name="Misc", category_type=CategoryType.EXPENSE)
    leg = TransactionLeg(account_id=UUID(int=1), amount=Decimal("0"))
    assert (
        service._classify_loan_event(
            transaction_type=TransactionType.TRANSFER,
            leg=leg,
            category=category,
        )
        is None
    )


def test_classify_loan_event_for_import_counterparty_leg(session) -> None:
    service = TransactionService(session)
    source = Account(name="Checking", account_type=AccountType.NORMAL)
    loan_account = Account(name="Loan", account_type=AccountType.DEBT)
    session.add_all([source, loan_account])
    session.commit()

    batch = TransactionImportBatch(source_name="import")
    session.add(batch)
    session.commit()

    import_file = ImportFile(
        batch_id=batch.id,
        filename="rows.csv",
        account_id=source.id,
        row_count=1,
        error_count=0,
        status="processed",
        bank_type="manual",
    )
    session.add(import_file)
    session.commit()

    tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
        posted_at=datetime(2024, 2, 1, tzinfo=timezone.utc),
        import_file_id=import_file.id,
    )
    leg = TransactionLeg(account_id=loan_account.id, amount=Decimal("100"))
    event_type = service._classify_loan_event(
        transaction_type=TransactionType.TRANSFER,
        leg=leg,
        category=None,
        transaction=tx,
    )
    assert event_type == LoanEventType.PAYMENT_PRINCIPAL


def test_transaction_service_private_branch_paths(session) -> None:
    service = TransactionService(session)

    # _sync_investment_snapshot: investment tx with missing snapshot id returns early.
    missing_snapshot_tx = Transaction(
        transaction_type=TransactionType.INVESTMENT_EVENT,
        occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        external_id=f"investment_snapshot:{UUID(int=999)}",
    )
    service._sync_investment_snapshot(
        missing_snapshot_tx,
        description="x",
        notes=None,
        occurred_at=None,
    )

    snapshot = InvestmentSnapshot(
        provider="manual",
        report_type="portfolio_report",
        account_name="Broker",
        snapshot_date=date(2024, 1, 1),
        portfolio_value=Decimal("123"),
        raw_text="old",
        parsed_payload={"accounts": {"Broker": 123}},
    )
    session.add(snapshot)
    session.commit()

    existing_snapshot_tx = Transaction(
        transaction_type=TransactionType.INVESTMENT_EVENT,
        occurred_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
        external_id=f"investment_snapshot:{snapshot.id}",
    )
    service._sync_investment_snapshot(
        existing_snapshot_tx,
        description="   ",
        notes=None,
        occurred_at=datetime(2024, 1, 3, tzinfo=timezone.utc),
    )
    synced = session.exec(
        select(InvestmentSnapshot).where(InvestmentSnapshot.id == snapshot.id)
    ).one()
    assert synced.snapshot_date == date(2024, 1, 3)
    assert synced.raw_text == "Manual investment balance update"
    service._sync_investment_snapshot(
        Transaction(
            transaction_type=TransactionType.INVESTMENT_EVENT,
            occurred_at=datetime(2024, 1, 4, tzinfo=timezone.utc),
            posted_at=datetime(2024, 1, 4, tzinfo=timezone.utc),
            external_id=None,
        ),
        description="x",
        notes=None,
        occurred_at=None,
    )


def test_list_recent_transactions_forwards_repository_args(session) -> None:
    service = TransactionService(session)
    captured: dict[str, object] = {}

    class _Repo:
        def list(self, **kwargs):
            captured.update(kwargs)
            return []

    service.repository = _Repo()  # type: ignore[assignment]
    service.list_recent_transactions(
        account_ids=[UUID(int=1)],
        transaction_types=[TransactionType.EXPENSE],
        limit=7,
        include_tax_event=True,
    )

    assert captured["account_ids"] == [UUID(int=1)]
    assert captured["transaction_types"] == [TransactionType.EXPENSE]
    assert captured["sort_by"] == "occurred_at"
    assert captured["sort_dir"] == "desc"
    assert captured["limit"] == 7
    assert captured["offset"] == 0
    assert captured["include_tax_event"] is True

    # _delete_investment_snapshot: non-investment and invalid/missing snapshot branches.
    non_investment_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    service._delete_investment_snapshot(non_investment_tx)
    invalid_external_tx = Transaction(
        transaction_type=TransactionType.INVESTMENT_EVENT,
        occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        external_id="investment_snapshot:not-a-uuid",
    )
    service._delete_investment_snapshot(invalid_external_tx)
    missing_existing_tx = Transaction(
        transaction_type=TransactionType.INVESTMENT_EVENT,
        occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        external_id=f"investment_snapshot:{UUID(int=888)}",
    )
    service._delete_investment_snapshot(missing_existing_tx)

    # _loan_lookup empty path and _classify_loan_event fallback None.
    assert service._loan_lookup([]) == {}
    leg = TransactionLeg(account_id=UUID(int=1), amount=Decimal("5"))
    assert (
        service._classify_loan_event(
            transaction_type=TransactionType.EXPENSE,
            leg=leg,
            category=None,
        )
        is None
    )

    # _record_loan_events early return branches.
    transient_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    transient_tx.id = None
    service._record_loan_events(transient_tx, None, commit=False)

    persisted_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
    )
    session.add(persisted_tx)
    session.commit()
    session.refresh(persisted_tx)
    service._record_loan_events(persisted_tx, None, commit=False)

    debt = Account(name="Debt2", account_type=AccountType.DEBT)
    offset = Account(name="Offset2", account_type=AccountType.NORMAL)
    session.add_all([debt, offset])
    session.commit()
    loan = Loan(
        account_id=debt.id,
        origin_principal=Decimal("500"),
        current_principal=Decimal("500"),
        interest_rate_annual=Decimal("0.03"),
        interest_compound=InterestCompound.MONTHLY,
    )
    session.add(loan)
    session.commit()

    no_event_tx = Transaction(
        transaction_type=TransactionType.EXPENSE,
        occurred_at=datetime(2024, 1, 6, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 6, tzinfo=timezone.utc),
    )
    session.add(no_event_tx)
    session.flush()
    session.add_all(
        [
            TransactionLeg(transaction_id=no_event_tx.id, account_id=debt.id, amount=Decimal("15")),
            TransactionLeg(
                transaction_id=no_event_tx.id, account_id=offset.id, amount=Decimal("-15")
            ),
        ]
    )
    session.commit()
    service._record_loan_events(no_event_tx, None, commit=False)


def test_transaction_service_additional_private_branch_paths(session) -> None:
    service = TransactionService(session)
    account_a = Account(name="A", account_type=AccountType.NORMAL)
    account_b = Account(name="B", account_type=AccountType.NORMAL)
    session.add_all([account_a, account_b])
    session.commit()

    fallback_expense = service._infer_transaction_type(
        _balanced_legs(account_a.id, account_b.id, Decimal("10")),
        category=SimpleNamespace(category_type="unknown"),  # type: ignore[arg-type]
        fallback=TransactionType.EXPENSE,
    )
    assert fallback_expense == TransactionType.EXPENSE

    snapshot = InvestmentSnapshot(
        provider="manual",
        report_type="portfolio_report",
        account_name="Broker",
        snapshot_date=date(2024, 1, 1),
        portfolio_value=Decimal("50"),
        raw_text="keep me",
        parsed_payload={"accounts": {"Broker": 50}},
    )
    session.add(snapshot)
    session.commit()

    tx = Transaction(
        transaction_type=TransactionType.INVESTMENT_EVENT,
        occurred_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
        external_id=f"investment_snapshot:{snapshot.id}",
    )
    service._sync_investment_snapshot(tx, description=None, notes=None, occurred_at=None)
    synced = session.exec(
        select(InvestmentSnapshot).where(InvestmentSnapshot.id == snapshot.id)
    ).one()
    assert synced.snapshot_date == date(2024, 1, 1)
    assert synced.raw_text == "keep me"

    category = Category(name="Misc", category_type=CategoryType.EXPENSE)
    leg = TransactionLeg(account_id=account_a.id, amount=Decimal("25"))
    event_type = service._classify_loan_event(
        transaction_type=TransactionType.TRANSFER,
        leg=leg,
        category=category,
    )
    assert event_type == LoanEventType.DISBURSEMENT
