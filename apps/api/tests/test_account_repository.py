from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlmodel import select

from apps.api.models import Account, Loan, Transaction, TransactionLeg
from apps.api.repositories.account import AccountRepository
from apps.api.services import AccountService
from apps.api.shared import AccountType, CreatedSource, InterestCompound, TransactionType


def _create_transaction(
    session, account_src: Account, account_dst: Account, amount: Decimal, occurred: datetime
) -> None:
    transaction = Transaction(
        transaction_type=TransactionType.TRANSFER,
        description="transfer",
        occurred_at=occurred,
        posted_at=occurred,
        created_source=CreatedSource.SYSTEM,
    )
    session.add(transaction)
    session.flush()

    session.add_all(
        [
            TransactionLeg(
                transaction_id=transaction.id,
                account_id=account_src.id,
                amount=amount,
            ),
            TransactionLeg(
                transaction_id=transaction.id,
                account_id=account_dst.id,
                amount=-amount,
            ),
        ]
    )
    session.commit()


def test_calculate_balance_with_and_without_as_of(session):
    repo = AccountRepository(session)

    account = Account(name="A", account_type=AccountType.NORMAL)
    counter_account = Account(name="B", account_type=AccountType.NORMAL)
    session.add_all([account, counter_account])
    session.commit()
    session.refresh(account)
    session.refresh(counter_account)

    balance = repo.calculate_balance(account.id)
    assert balance == Decimal("0")

    occurred = datetime(2024, 1, 1, tzinfo=timezone.utc)
    _create_transaction(session, account, counter_account, Decimal("200.00"), occurred)

    balance = repo.calculate_balance(account.id)
    assert balance == Decimal("200.00")

    balance_prior = repo.calculate_balance(
        account.id, as_of=datetime(2023, 12, 31, tzinfo=timezone.utc)
    )
    assert balance_prior == Decimal("0")

    later_tx_time = datetime(2024, 2, 1, tzinfo=timezone.utc)
    _create_transaction(session, account, counter_account, Decimal("-50.00"), later_tx_time)

    balance_mid = repo.calculate_balance(
        account.id, as_of=datetime(2024, 1, 15, tzinfo=timezone.utc)
    )
    assert balance_mid == Decimal("200.00")

    balance_latest = repo.calculate_balance(account.id)
    assert balance_latest == Decimal("150.00")


def test_attach_loan_rules(session):
    repo = AccountRepository(session)

    normal_account = Account(account_type=AccountType.NORMAL)
    debt_account = Account(account_type=AccountType.DEBT)
    session.add_all([normal_account, debt_account])
    session.commit()
    session.refresh(normal_account)
    session.refresh(debt_account)

    loan = Loan(
        account_id=debt_account.id,
        origin_principal=Decimal("1000.00"),
        current_principal=Decimal("1000.00"),
        interest_rate_annual=Decimal("0.0450"),
        interest_compound=InterestCompound.MONTHLY,
    )

    attached = repo.attach_loan(debt_account.id, loan)
    assert attached.account_id == debt_account.id

    with pytest.raises(ValueError):
        repo.attach_loan(
            debt_account.id,
            Loan(
                account_id=debt_account.id,
                origin_principal=Decimal("500.00"),
                current_principal=Decimal("500.00"),
                interest_rate_annual=Decimal("0.0300"),
                interest_compound=InterestCompound.MONTHLY,
            ),
        )

    with pytest.raises(ValueError):
        repo.attach_loan(
            normal_account.id,
            Loan(
                account_id=normal_account.id,
                origin_principal=Decimal("500.00"),
                current_principal=Decimal("500.00"),
                interest_rate_annual=Decimal("0.0300"),
                interest_compound=InterestCompound.MONTHLY,
            ),
        )


def test_account_service_create_and_balance(session):
    service = AccountService(session)

    account = Account(name="Acct", account_type=AccountType.NORMAL)
    created = service.create_account(account)
    assert created.id is not None

    _, balance = service.get_account_with_balance(created.id)
    assert balance == Decimal("0")

    counter = Account(name="Counter", account_type=AccountType.NORMAL)
    session.add(counter)
    session.commit()
    session.refresh(counter)

    _create_transaction(
        session,
        created,
        counter,
        Decimal("75.00"),
        datetime(2024, 3, 1, tzinfo=timezone.utc),
    )

    _, updated_balance = service.get_account_with_balance(created.id)
    assert updated_balance == Decimal("75.00")

    listings = service.list_accounts_with_balance()
    assert any(
        account.id == created.id and balance == Decimal("75.00") for account, balance in listings
    )

    debt_account = Account(name="Debt", account_type=AccountType.DEBT)
    with pytest.raises(ValueError):
        service.create_account(debt_account)

    debt_account = Account(name="Debt2", account_type=AccountType.DEBT)
    loan_args = {
        "origin_principal": Decimal("2000.00"),
        "current_principal": Decimal("2000.00"),
        "interest_rate_annual": Decimal("0.0500"),
        "interest_compound": InterestCompound.MONTHLY,
    }
    created_debt = service.create_account(debt_account, loan_kwargs=loan_args)

    loan_in_db = session.exec(select(Loan).where(Loan.account_id == created_debt.id)).one()
    assert loan_in_db.origin_principal == Decimal("2000.00")

    updated_account = service.update_account(created.id, is_active=False)
    assert updated_account.is_active is False
