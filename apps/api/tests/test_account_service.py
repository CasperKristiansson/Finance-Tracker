from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

import pytest
from sqlmodel import select

from apps.api.models import Account, BalanceSnapshot, InvestmentSnapshot, Loan, Transaction
from apps.api.services.account import AccountService
from apps.api.shared import AccountType, InterestCompound, TransactionType

# pylint: disable=protected-access


def test_create_account_rejects_loan_kwargs_for_non_debt(session) -> None:
    service = AccountService(session)
    account = Account(name="Checking", account_type=AccountType.NORMAL)
    with pytest.raises(ValueError, match="Loan details supplied"):
        service.create_account(
            account,
            loan_kwargs={
                "origin_principal": Decimal("1000"),
                "current_principal": Decimal("1000"),
                "interest_rate_annual": Decimal("0.03"),
                "interest_compound": InterestCompound.MONTHLY,
            },
        )


def test_account_service_lookup_errors(session) -> None:
    service = AccountService(session)
    missing = UUID(int=1)
    with pytest.raises(LookupError, match="Account not found"):
        service.get_account_with_balance(missing)
    with pytest.raises(LookupError, match="Account not found"):
        service.update_account(missing, name="x")
    with pytest.raises(LookupError, match="Account not found"):
        service.attach_loan(
            missing,
            {
                "origin_principal": Decimal("1000"),
                "current_principal": Decimal("1000"),
                "interest_rate_annual": Decimal("0.03"),
                "interest_compound": InterestCompound.MONTHLY,
            },
        )


def test_reconcile_account_zero_delta_creates_snapshot_only(session) -> None:
    service = AccountService(session)
    account = service.create_account(Account(name="Main", account_type=AccountType.NORMAL))

    result = service.reconcile_account(
        account.id,
        captured_at=datetime(2024, 4, 1, tzinfo=timezone.utc),
        reported_balance=Decimal("0"),
    )

    assert result["transaction"] is None
    assert result["delta"] == Decimal("0")
    snapshots = session.exec(select(BalanceSnapshot)).all()
    assert len(snapshots) == 1


def test_reconcile_account_posts_adjustment_when_delta_non_zero(session) -> None:
    service = AccountService(session)
    account = service.create_account(Account(name="Main", account_type=AccountType.NORMAL))

    result = service.reconcile_account(
        account.id,
        captured_at=datetime(2024, 5, 1, tzinfo=timezone.utc),
        reported_balance=Decimal("250"),
        description="sync",
    )

    tx = result["transaction"]
    assert tx is not None
    assert tx.transaction_type == TransactionType.ADJUSTMENT
    assert result["delta"] == Decimal("250")
    assert service.get_or_create_offset_account().name == "Offset"


def test_reconciliation_state_for_normal_account(session) -> None:
    service = AccountService(session)
    account = service.create_account(Account(name="Main", account_type=AccountType.NORMAL))

    # No snapshots yet.
    state = service.reconciliation_state(account.id)
    assert state["last_captured_at"] is None
    assert state["delta_since_snapshot"] is None

    # Snapshot exists.
    service.reconcile_account(
        account.id,
        captured_at=datetime(2024, 5, 1, tzinfo=timezone.utc),
        reported_balance=Decimal("100"),
    )
    state = service.reconciliation_state(account.id)
    assert state["last_captured_at"] is not None
    assert state["last_reported_balance"] == Decimal("100")


def test_reconciliation_state_for_investment_account(session) -> None:
    service = AccountService(session)
    account = service.create_account(Account(name="Broker", account_type=AccountType.INVESTMENT))

    empty_state = service.reconciliation_state(account.id)
    assert empty_state["last_captured_at"] is None
    assert empty_state["last_reported_balance"] == Decimal("0")

    snapshot = InvestmentSnapshot(
        provider="manual",
        report_type="portfolio_report",
        account_name="Broker",
        snapshot_date=date(2024, 6, 1),
        portfolio_value=Decimal("1234"),
        raw_text="raw",
        parsed_payload={"accounts": {"broker": 1234}},
    )
    session.add(snapshot)
    session.commit()

    state = service.reconciliation_state(account.id)
    assert state["last_reported_balance"] == Decimal("1234")
    assert state["delta_since_snapshot"] == Decimal("0")


def test_investment_balance_helper_handles_case_and_invalid_values() -> None:
    snapshot = InvestmentSnapshot(
        provider="manual",
        report_type="portfolio_report",
        account_name="Broker",
        snapshot_date=date(2024, 6, 1),
        portfolio_value=Decimal("0"),
        raw_text="raw",
        parsed_payload={"accounts": {"BROKER": "not-decimal", "Alt": 50}},
    )

    assert AccountService._investment_balance("broker", snapshot) == Decimal("0")
    assert AccountService._investment_balance("alt", snapshot) == Decimal("50")
    assert AccountService._investment_balance("missing", snapshot) == Decimal("0")

    malformed = InvestmentSnapshot(
        provider="manual",
        report_type="portfolio_report",
        account_name="Broker",
        snapshot_date=date(2024, 6, 1),
        portfolio_value=Decimal("0"),
        raw_text="raw",
        parsed_payload={"accounts": []},
    )
    assert AccountService._investment_balance("broker", malformed) == Decimal("0")


def test_latest_investment_snapshot_respects_as_of(session) -> None:
    service = AccountService(session)
    session.add_all(
        [
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name="Broker",
                snapshot_date=date(2024, 1, 1),
                portfolio_value=Decimal("100"),
                raw_text="raw",
                parsed_payload={"accounts": {"Broker": 100}},
            ),
            InvestmentSnapshot(
                provider="manual",
                report_type="portfolio_report",
                account_name="Broker",
                snapshot_date=date(2024, 3, 1),
                portfolio_value=Decimal("300"),
                raw_text="raw",
                parsed_payload={"accounts": {"Broker": 300}},
            ),
        ]
    )
    session.commit()

    latest = service._latest_investment_snapshot(as_of=None)
    assert latest is not None
    assert latest.snapshot_date == date(2024, 3, 1)

    as_of_latest = service._latest_investment_snapshot(
        as_of=datetime(2024, 2, 1, tzinfo=timezone.utc)
    )
    assert as_of_latest is not None
    assert as_of_latest.snapshot_date == date(2024, 1, 1)


def test_get_or_create_offset_account_is_cached(session) -> None:
    service = AccountService(session)
    first = service.get_or_create_offset_account()
    second = service.get_or_create_offset_account()
    assert first.id == second.id
    loans = session.exec(select(Loan)).all()
    assert loans == []
    transactions = session.exec(select(Transaction)).all()
    assert transactions == []


def test_get_or_create_offset_account_uses_existing_inactive_offset(session) -> None:
    existing = Account(name="Offset", account_type=AccountType.NORMAL, is_active=False)
    session.add(existing)
    session.commit()

    service = AccountService(session)
    found = service.get_or_create_offset_account()
    assert found.id == existing.id
