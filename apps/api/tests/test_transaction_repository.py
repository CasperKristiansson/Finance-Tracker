from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlmodel import select

from apps.api.models import Account, Loan, Transaction, TransactionLeg
from apps.api.repositories.transaction import TransactionRepository
from apps.api.services.transaction import TransactionService
from apps.api.shared import (
    AccountType,
    InterestCompound,
    LoanEventType,
    TransactionType,
)

# pylint: disable=redefined-outer-name


@pytest.fixture()
def repo(session):
    return TransactionRepository(session)


def _build_transaction(
    description: str,
    transaction_type: TransactionType = TransactionType.TRANSFER,
) -> Transaction:
    occurred = datetime(2024, 1, 1, tzinfo=timezone.utc)
    return Transaction(
        transaction_type=transaction_type,
        description=description,
        occurred_at=occurred,
        posted_at=occurred,
    )


def _create_account(session, account_type: AccountType = AccountType.NORMAL) -> Account:
    account = Account(account_type=account_type)
    session.add(account)
    session.flush()
    session.refresh(account)
    return account


def _create_loan(session, account: Account) -> Loan:
    loan = Loan(
        account_id=account.id,
        origin_principal=Decimal("1000.00"),
        current_principal=Decimal("1000.00"),
        interest_rate_annual=Decimal("0.0400"),
        interest_compound=InterestCompound.MONTHLY,
    )
    session.add(loan)
    session.flush()
    session.refresh(loan)
    return loan


def _transaction_legs(session, transaction_id):
    statement = select(TransactionLeg).where(TransactionLeg.transaction_id == transaction_id)
    return list(session.exec(statement))


def test_repository_create_persists_legs(repo, session):
    asset = _create_account(session)
    counter = _create_account(session)
    tx = _build_transaction("Lunch")

    legs = [
        TransactionLeg(account_id=asset.id, amount=Decimal("-12.50")),
        TransactionLeg(account_id=counter.id, amount=Decimal("12.50")),
    ]

    saved = repo.create(tx, legs)

    persisted_legs = _transaction_legs(session, saved.id)
    assert len(persisted_legs) == 2


def test_repository_rejects_unbalanced_transaction(repo, session):
    asset = _create_account(session)
    counter = _create_account(session)
    tx = _build_transaction("Bad entry")

    legs = [
        TransactionLeg(account_id=asset.id, amount=Decimal("-10")),
        TransactionLeg(account_id=counter.id, amount=Decimal("5")),
    ]

    with pytest.raises(ValueError):
        repo.create(tx, legs)


def test_service_rejects_single_leg_transaction(session):
    service = TransactionService(session)
    asset = _create_account(session)

    tx = _build_transaction("Single leg")
    leg = TransactionLeg(account_id=asset.id, amount=Decimal("25"))

    with pytest.raises(ValueError):
        service.create_transaction(tx, [leg])


def test_service_rejects_transfer_without_distinct_accounts(session):
    service = TransactionService(session)
    account = _create_account(session)

    tx = _build_transaction("Duplicate accounts")
    legs = [
        TransactionLeg(account_id=account.id, amount=Decimal("100")),
        TransactionLeg(account_id=account.id, amount=Decimal("-100")),
    ]

    with pytest.raises(ValueError):
        service.create_transaction(tx, legs)


def test_transaction_service_creates_and_lists(session):
    service = TransactionService(session)
    asset = _create_account(session)
    counter = _create_account(session)

    tx = _build_transaction("Salary")
    legs = [
        TransactionLeg(account_id=asset.id, amount=Decimal("5000")),
        TransactionLeg(account_id=counter.id, amount=Decimal("-5000")),
    ]

    created = service.create_transaction(tx, legs)
    fetched = service.list_transactions()[0]
    assert fetched.id == created.id

    balance = service.calculate_account_balance(asset.id)
    assert balance == Decimal("5000")


def test_service_generates_loan_event_for_principal_payment(session):
    service = TransactionService(session)
    loan_account = _create_account(session, AccountType.DEBT)
    funding_account = _create_account(session)
    loan = _create_loan(session, loan_account)

    tx = _build_transaction("Loan payment")
    legs = [
        TransactionLeg(account_id=loan_account.id, amount=Decimal("-250.00")),
        TransactionLeg(account_id=funding_account.id, amount=Decimal("250.00")),
    ]

    service.create_transaction(tx, legs)

    events = service.list_loan_events(loan.id)
    assert len(events) == 1
    event = events[0]
    assert event.event_type == LoanEventType.PAYMENT_PRINCIPAL
    assert event.amount == Decimal("250.00")
    assert event.transaction_id == tx.id


def test_manual_loan_event_creation(session):
    service = TransactionService(session)
    loan_account = _create_account(session, AccountType.DEBT)
    funding_account = _create_account(session)
    loan = _create_loan(session, loan_account)

    tx = _build_transaction("Loan disbursement")
    legs = [
        TransactionLeg(account_id=loan_account.id, amount=Decimal("300.00")),
        TransactionLeg(account_id=funding_account.id, amount=Decimal("-300.00")),
    ]

    created = service.create_transaction(tx, legs)
    persisted_leg = _transaction_legs(session, created.id)[0]

    occurred = datetime(2024, 1, 1, tzinfo=timezone.utc)
    manual_event = service.create_loan_event(
        loan_id=loan.id,
        transaction=created,
        transaction_leg=persisted_leg,
        event_type=LoanEventType.FEE,
        amount=Decimal("300.00"),
        occurred_at=occurred,
    )

    events = service.list_loan_events(loan.id)
    assert len(events) == 2
    event_types = {event.event_type for event in events}
    assert LoanEventType.DISBURSEMENT in event_types
    assert LoanEventType.FEE in event_types
    assert any(event.id == manual_event.id for event in events)
