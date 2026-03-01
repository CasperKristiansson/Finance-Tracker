from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

import pytest

from apps.api.models import Account, Loan, LoanEvent, Transaction
from apps.api.repositories.loan import LoanRepository
from apps.api.shared import AccountType, InterestCompound, LoanEventType, TransactionType


def _account(session, *, name: str, account_type: AccountType) -> Account:
    account = Account(name=name, account_type=account_type)
    session.add(account)
    session.flush()
    session.refresh(account)
    return account


def _loan(session, account: Account) -> Loan:
    loan = Loan(
        account_id=account.id,
        origin_principal=Decimal("1000"),
        current_principal=Decimal("900"),
        interest_rate_annual=Decimal("0.0400"),
        interest_compound=InterestCompound.MONTHLY,
    )
    session.add(loan)
    session.commit()
    session.refresh(loan)
    return loan


def test_loan_repository_crud_and_event_listing(session) -> None:
    repo = LoanRepository(session)
    debt = _account(session, name="Debt", account_type=AccountType.DEBT)
    loan = repo.create(
        Loan(
            account_id=debt.id,
            origin_principal=Decimal("2000"),
            current_principal=Decimal("1900"),
            interest_rate_annual=Decimal("0.0500"),
            interest_compound=InterestCompound.MONTHLY,
        )
    )
    fetched_plain = repo.get_by_account_id(debt.id, with_account=False)
    fetched_with_account = repo.get_by_account_id(debt.id, with_account=True)
    assert fetched_plain is not None
    assert fetched_with_account is not None
    assert fetched_with_account.account.id == debt.id

    updated = repo.update_fields(
        loan,
        origin_principal=Decimal("2500"),
        current_principal=Decimal("1800"),
        interest_rate_annual=Decimal("0.0600"),
        interest_compound=InterestCompound.DAILY,
        minimum_payment=Decimal("250"),
        expected_maturity_date=date(2030, 1, 1),
    )
    assert updated.origin_principal == Decimal("2500")
    assert updated.minimum_payment == Decimal("250")
    assert updated.expected_maturity_date == date(2030, 1, 1)

    tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
        posted_at=datetime(2024, 1, 1, tzinfo=timezone.utc),
    )
    session.add(tx)
    session.flush()

    session.add_all(
        [
            LoanEvent(
                loan_id=loan.id,
                transaction_id=tx.id,
                transaction_leg_id=None,
                event_type=LoanEventType.FEE,
                amount=Decimal("30"),
                occurred_at=datetime(2024, 1, 3, tzinfo=timezone.utc),
            ),
            LoanEvent(
                loan_id=loan.id,
                transaction_id=tx.id,
                transaction_leg_id=None,
                event_type=LoanEventType.INTEREST_ACCRUAL,
                amount=Decimal("10"),
                occurred_at=datetime(2024, 1, 2, tzinfo=timezone.utc),
            ),
        ]
    )
    session.commit()

    listed = repo.list_events(loan.id, limit=1, offset=0)
    assert len(listed) == 1
    assert listed[0].event_type == LoanEventType.FEE

    all_events = repo.list_all_events(
        start_date=date(2024, 1, 2),
        end_date=date(2024, 1, 4),
    )
    assert [event.event_type for event in all_events] == [
        LoanEventType.INTEREST_ACCRUAL,
        LoanEventType.FEE,
    ]


def test_loan_repository_validate_account_can_have_loan(session) -> None:
    repo = LoanRepository(session)
    normal = _account(session, name="Normal", account_type=AccountType.NORMAL)
    debt = _account(session, name="Debt", account_type=AccountType.DEBT)
    _loan(session, debt)

    with pytest.raises(ValueError, match="debt accounts"):
        repo.validate_account_can_have_loan(normal)

    with pytest.raises(ValueError, match="linked loan"):
        repo.validate_account_can_have_loan(debt)


def test_loan_repository_optional_field_branches(session) -> None:
    repo = LoanRepository(session)
    debt = _account(session, name="Debt B", account_type=AccountType.DEBT)
    loan = _loan(session, debt)

    updated = repo.update_fields(loan, interest_compound=InterestCompound.YEARLY)
    assert updated.interest_compound == InterestCompound.YEARLY
    assert updated.minimum_payment is None

    fresh_debt = _account(session, name="Debt C", account_type=AccountType.DEBT)
    repo.validate_account_can_have_loan(fresh_debt)
