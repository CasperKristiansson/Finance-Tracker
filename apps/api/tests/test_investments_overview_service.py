from __future__ import annotations

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from apps.api.models import (
    Account,
    InvestmentSnapshot,
    InvestmentTransaction,
    Transaction,
    TransactionLeg,
)
from apps.api.services.investments import InvestmentSnapshotService
from apps.api.shared import AccountType, TransactionType


def test_investment_overview_includes_cashflow_series_and_since_start_totals(session) -> None:
    now = datetime.now(timezone.utc)
    investment = Account(name="Broker Account", account_type=AccountType.INVESTMENT, is_active=True)
    cash = Account(name="Cash Account", account_type=AccountType.NORMAL, is_active=True)
    session.add(investment)
    session.add(cash)
    session.commit()

    start_snapshot_date = (now - timedelta(days=40)).date()
    end_snapshot_date = (now - timedelta(days=2)).date()

    session.add(
        InvestmentSnapshot(
            provider="nordnet",
            report_type="portfolio_report",
            account_name=None,
            snapshot_date=start_snapshot_date,
            portfolio_value=Decimal("1000.00"),
            raw_text="seed",
            parsed_payload={"accounts": {"Broker Account": "1000"}},
        )
    )
    session.add(
        InvestmentSnapshot(
            provider="nordnet",
            report_type="portfolio_report",
            account_name=None,
            snapshot_date=end_snapshot_date,
            portfolio_value=Decimal("2000.00"),
            raw_text="seed",
            parsed_payload={"accounts": {"Broker Account": "2000"}},
        )
    )
    session.commit()

    deposit_dt = now - timedelta(days=10)
    withdrawal_dt = now - timedelta(days=5)

    deposit_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=deposit_dt,
        posted_at=deposit_dt,
        description="Deposit",
    )
    deposit_tx.legs = [
        TransactionLeg(
            transaction_id=deposit_tx.id,
            account_id=investment.id,
            amount=Decimal("1000.00"),
        ),
        TransactionLeg(
            transaction_id=deposit_tx.id,
            account_id=cash.id,
            amount=Decimal("-1000.00"),
        ),
    ]

    withdrawal_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=withdrawal_dt,
        posted_at=withdrawal_dt,
        description="Withdrawal",
    )
    withdrawal_tx.legs = [
        TransactionLeg(
            transaction_id=withdrawal_tx.id,
            account_id=investment.id,
            amount=Decimal("-200.00"),
        ),
        TransactionLeg(
            transaction_id=withdrawal_tx.id,
            account_id=cash.id,
            amount=Decimal("200.00"),
        ),
    ]

    session.add(deposit_tx)
    session.add(withdrawal_tx)
    session.commit()

    service = InvestmentSnapshotService(session)
    overview = service.investment_overview()

    portfolio = overview["portfolio"]
    cashflow = portfolio["cashflow"]
    assert cashflow["added_since_start"] == Decimal("1000.00")
    assert cashflow["withdrawn_since_start"] == Decimal("200.00")
    assert cashflow["net_since_start"] == Decimal("800.00")

    assert "cashflow_series" in portfolio
    assert portfolio["cashflow_series"]
    months = [row["period"] for row in portfolio["cashflow_series"]]
    assert months == sorted(months)

    assert portfolio["growth_since_start_ex_transfers"]["amount"] == Decimal("200.00")

    assert overview["accounts"]
    account = overview["accounts"][0]
    assert account["cashflow_since_start_added"] == Decimal("1000.00")
    assert account["cashflow_since_start_withdrawn"] == Decimal("200.00")
    assert account["cashflow_since_start_net"] == Decimal("800.00")
    assert account["growth_since_start_ex_transfers"]["amount"] == Decimal("200.00")


def test_investment_overview_falls_back_to_investment_transactions_for_cashflows(session) -> None:
    now = datetime.now(timezone.utc)
    investment = Account(name="Broker Account", account_type=AccountType.INVESTMENT, is_active=True)
    session.add(investment)
    session.commit()

    start_snapshot_date = (now - timedelta(days=40)).date()
    end_snapshot_date = (now - timedelta(days=2)).date()

    session.add(
        InvestmentSnapshot(
            provider="nordnet",
            report_type="portfolio_report",
            account_name=None,
            snapshot_date=start_snapshot_date,
            portfolio_value=Decimal("1000.00"),
            raw_text="seed",
            parsed_payload={"accounts": {"Broker Account": "1000"}},
        )
    )
    session.add(
        InvestmentSnapshot(
            provider="nordnet",
            report_type="portfolio_report",
            account_name=None,
            snapshot_date=end_snapshot_date,
            portfolio_value=Decimal("2000.00"),
            raw_text="seed",
            parsed_payload={"accounts": {"Broker Account": "2000"}},
        )
    )

    tx_snapshot = InvestmentSnapshot(
        provider="nordnet",
        report_type="transactions",
        account_name="Broker Account",
        snapshot_date=end_snapshot_date,
        portfolio_value=None,
        raw_text="seed",
        parsed_payload={"report_type": "transactions", "rows": []},
    )
    session.add(tx_snapshot)
    session.flush()

    deposit_dt = (now - timedelta(days=10)).replace(tzinfo=None)
    withdrawal_dt = (now - timedelta(days=5)).replace(tzinfo=None)
    session.add(
        InvestmentTransaction(
            snapshot_id=tx_snapshot.id,
            occurred_at=deposit_dt,
            transaction_type="Insättning",
            description="Deposit",
            account_name="Kristiansson Casper Ove · 39370408",
            amount_sek=Decimal("-1000.00"),
        )
    )
    session.add(
        InvestmentTransaction(
            snapshot_id=tx_snapshot.id,
            occurred_at=withdrawal_dt,
            transaction_type="Uttag",
            description="Withdrawal",
            account_name="Kristiansson Casper Ove · 39370408",
            amount_sek=Decimal("200.00"),
        )
    )
    session.commit()

    service = InvestmentSnapshotService(session)
    overview = service.investment_overview()

    portfolio = overview["portfolio"]
    cashflow = portfolio["cashflow"]
    assert cashflow["added_since_start"] == Decimal("1000.00")
    assert cashflow["withdrawn_since_start"] == Decimal("200.00")
    assert cashflow["net_since_start"] == Decimal("800.00")
    assert portfolio["cashflow_series"]
    assert portfolio["growth_since_start_ex_transfers"]["amount"] == Decimal("200.00")

    assert overview["accounts"]
    account = overview["accounts"][0]
    assert account["cashflow_since_start_added"] == Decimal("1000.00")
    assert account["cashflow_since_start_withdrawn"] == Decimal("200.00")
    assert account["cashflow_since_start_net"] == Decimal("800.00")
    assert account["growth_since_start_ex_transfers"]["amount"] == Decimal("200.00")
