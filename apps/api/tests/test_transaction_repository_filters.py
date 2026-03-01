from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from sqlmodel import select

from apps.api.models import Account, Category, TaxEvent, Transaction, TransactionLeg
from apps.api.repositories.transaction import TransactionRepository
from apps.api.shared import (
    AccountType,
    CategoryType,
    LoanEventType,
    TaxEventType,
    TransactionType,
)

# pylint: disable=redefined-outer-name


def _account(session, *, name: str, account_type: AccountType = AccountType.NORMAL) -> Account:
    account = Account(name=name, account_type=account_type)
    session.add(account)
    session.flush()
    session.refresh(account)
    return account


def _category(session, *, name: str, category_type: CategoryType) -> Category:
    category = Category(name=name, category_type=category_type)
    session.add(category)
    session.flush()
    session.refresh(category)
    return category


def _tx(
    session,
    *,
    tx_type: TransactionType,
    occurred_at: datetime,
    description: str,
    notes: str | None,
    external_id: str | None,
    category_id,
    legs: list[tuple[Account, Decimal]],
) -> Transaction:
    transaction = Transaction(
        transaction_type=tx_type,
        occurred_at=occurred_at,
        posted_at=occurred_at,
        description=description,
        notes=notes,
        external_id=external_id,
        category_id=category_id,
    )
    session.add(transaction)
    session.flush()
    session.add_all(
        [
            TransactionLeg(
                transaction_id=transaction.id,
                account_id=account.id,
                amount=amount,
            )
            for account, amount in legs
        ]
    )
    session.commit()
    session.refresh(transaction)
    return transaction


def test_transaction_repository_list_filter_and_sort_branches(session) -> None:
    repo = TransactionRepository(session)
    bank = _account(session, name="Bank")
    savings = _account(session, name="Savings")
    groceries = _category(session, name="Groceries", category_type=CategoryType.EXPENSE)
    salary = _category(session, name="Salary", category_type=CategoryType.INCOME)

    t1 = _tx(
        session,
        tx_type=TransactionType.INCOME,
        occurred_at=datetime(2024, 1, 3, tzinfo=timezone.utc),
        description="Salary payout",
        notes="January",
        external_id="ext-1",
        category_id=salary.id,
        legs=[(bank, Decimal("5000")), (savings, Decimal("-5000"))],
    )
    t2 = _tx(
        session,
        tx_type=TransactionType.EXPENSE,
        occurred_at=datetime(2024, 1, 5, tzinfo=timezone.utc),
        description="ICA groceries",
        notes="Food",
        external_id="ext-2",
        category_id=groceries.id,
        legs=[(bank, Decimal("-200")), (savings, Decimal("200"))],
    )
    t3 = _tx(
        session,
        tx_type=TransactionType.TRANSFER,
        occurred_at=datetime(2024, 1, 7, tzinfo=timezone.utc),
        description="Move to savings",
        notes="Monthly transfer",
        external_id="ext-3",
        category_id=None,
        legs=[(bank, Decimal("-1200")), (savings, Decimal("1200"))],
    )

    session.add(TaxEvent(transaction_id=t2.id, event_type=TaxEventType.PAYMENT))
    session.commit()

    # Cover search, category_ids, transaction_types, amount join, sort_by amount and offset.
    amount_rows = repo.list(
        account_ids=[bank.id],
        category_ids=[groceries.id],
        transaction_types=[TransactionType.EXPENSE],
        search="ICA",
        min_amount=Decimal("150"),
        max_amount=Decimal("250"),
        sort_by="amount",
        sort_dir="asc",
        limit=5,
        offset=0,
    )
    assert [row.id for row in amount_rows] == [t2.id]

    # Cover tax_event True (join TaxEvent).
    tax_rows = repo.list(tax_event=True, sort_by="occurred_at", sort_dir="desc")
    assert [row.id for row in tax_rows] == [t2.id]

    # Cover tax_event False (outer join TaxEvent and null filter).
    non_tax_rows = repo.list(tax_event=False, sort_by="occurred_at", sort_dir="desc")
    assert t2.id not in [row.id for row in non_tax_rows]
    assert {t1.id, t3.id}.issubset({row.id for row in non_tax_rows})

    # Cover sort branches for description/type/category and unknown fallback branch.
    by_desc = repo.list(sort_by="description", sort_dir="asc")
    assert [row.description for row in by_desc][:2] == ["ICA groceries", "Move to savings"]

    by_type = repo.list(sort_by="type", sort_dir="asc")
    assert by_type[0].transaction_type == TransactionType.EXPENSE

    by_category = repo.list(sort_by="category", sort_dir="asc")
    assert by_category[0].id == t3.id
    assert {row.category_id for row in by_category[1:]} >= {groceries.id, salary.id}

    fallback_sort = repo.list(sort_by="unknown", sort_dir="asc")
    assert fallback_sort[0].occurred_at >= fallback_sort[-1].occurred_at

    # Cover list offset branch with a non-zero offset.
    offset_rows = repo.list(sort_by="occurred_at", sort_dir="desc", limit=1, offset=1)
    assert len(offset_rows) == 1

    min_only = repo.list(min_amount=Decimal("1000"), sort_by="occurred_at", sort_dir="desc")
    assert {row.id for row in min_only} == {t1.id, t3.id}

    max_only = repo.list(max_amount=Decimal("300"), sort_by="occurred_at", sort_dir="desc")
    assert {row.id for row in max_only} == {t2.id}


def test_transaction_repository_update_list_by_account_and_balances(session) -> None:
    repo = TransactionRepository(session)
    bank = _account(session, name="Bank")
    cash = _account(session, name="Cash")
    cat_a = _category(session, name="A", category_type=CategoryType.EXPENSE)
    cat_b = _category(session, name="B", category_type=CategoryType.EXPENSE)
    occurred = datetime(2024, 2, 1, tzinfo=timezone.utc)

    tx = _tx(
        session,
        tx_type=TransactionType.EXPENSE,
        occurred_at=occurred,
        description="Before update",
        notes="old",
        external_id=None,
        category_id=cat_a.id,
        legs=[(bank, Decimal("-50")), (cash, Decimal("50"))],
    )
    updated = repo.update(
        tx,
        description="After update",
        notes="new",
        occurred_at=datetime(2024, 2, 2, tzinfo=timezone.utc),
        posted_at=datetime(2024, 2, 3, tzinfo=timezone.utc),
        category_id=cat_b.id,
    )
    assert updated.description == "After update"
    assert updated.posted_at == datetime(2024, 2, 3)
    assert updated.category_id == cat_b.id

    tx2 = _tx(
        session,
        tx_type=TransactionType.INCOME,
        occurred_at=datetime(2024, 2, 10, tzinfo=timezone.utc),
        description="Paycheck",
        notes=None,
        external_id=None,
        category_id=None,
        legs=[(bank, Decimal("100")), (cash, Decimal("-100"))],
    )

    list_for_bank = repo.list_by_account(bank.id)
    assert [row.id for row in list_for_bank] == [tx2.id, tx.id]

    up_to_first = repo.calculate_account_balance(
        bank.id,
        up_to=datetime(2024, 2, 5, tzinfo=timezone.utc),
    )
    assert up_to_first == Decimal("-50")

    all_balances = repo.calculate_account_balances([bank.id, cash.id])
    assert all_balances[bank.id] == Decimal("50")
    assert all_balances[cash.id] == Decimal("-50")
    assert repo.calculate_account_balances([]) == {}


def test_transaction_repository_create_loan_event_without_commit(session) -> None:
    repo = TransactionRepository(session)
    debt = _account(session, name="Debt", account_type=AccountType.DEBT)
    funding = _account(session, name="Funding")
    tx = _tx(
        session,
        tx_type=TransactionType.TRANSFER,
        occurred_at=datetime(2024, 3, 1, tzinfo=timezone.utc),
        description="Debt disbursement",
        notes=None,
        external_id=None,
        category_id=None,
        legs=[(debt, Decimal("500")), (funding, Decimal("-500"))],
    )
    leg = session.exec(select(TransactionLeg).where(TransactionLeg.transaction_id == tx.id)).first()

    event = repo.create_loan_event(
        loan_id=debt.id,
        transaction=tx,
        transaction_leg=leg,
        event_type=LoanEventType.DISBURSEMENT,
        amount=Decimal("500"),
        occurred_at=datetime(2024, 3, 1, tzinfo=timezone.utc),
        commit=False,
    )
    # The repository should flush and assign an id when commit=False.
    assert event.id is not None
