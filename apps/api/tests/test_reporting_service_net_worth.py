from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from apps.api.models import Account, InvestmentSnapshot, Transaction, TransactionLeg
from apps.api.services.reporting import ReportingService
from apps.api.shared import AccountType, TransactionType


def test_net_worth_history_replaces_investment_ledger_with_snapshots(session) -> None:
    offset = Account(name="Offset", account_type=AccountType.NORMAL, is_active=True)
    bank = Account(name="Bank", account_type=AccountType.NORMAL, is_active=True)
    investment = Account(name="Broker", account_type=AccountType.INVESTMENT, is_active=True)
    session.add(offset)
    session.add(bank)
    session.add(investment)
    session.commit()

    income_dt = datetime(2024, 1, 1, tzinfo=timezone.utc)
    income_tx = Transaction(
        transaction_type=TransactionType.INCOME,
        occurred_at=income_dt,
        posted_at=income_dt,
        description="Income",
    )
    income_tx.legs = [
        TransactionLeg(transaction_id=income_tx.id, account_id=bank.id, amount=Decimal("2000.00")),
        TransactionLeg(
            transaction_id=income_tx.id, account_id=offset.id, amount=Decimal("-2000.00")
        ),
    ]
    session.add(income_tx)

    transfer_dt = datetime(2024, 1, 5, tzinfo=timezone.utc)
    transfer_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=transfer_dt,
        posted_at=transfer_dt,
        description="Transfer to broker",
    )
    transfer_tx.legs = [
        TransactionLeg(
            transaction_id=transfer_tx.id,
            account_id=bank.id,
            amount=Decimal("-1500.00"),
        ),
        TransactionLeg(
            transaction_id=transfer_tx.id,
            account_id=investment.id,
            amount=Decimal("1500.00"),
        ),
    ]
    session.add(transfer_tx)

    snapshot = InvestmentSnapshot(
        provider="nordnet",
        report_type="portfolio_report",
        account_name=None,
        snapshot_date=datetime(2024, 1, 6, tzinfo=timezone.utc).date(),
        portfolio_value=Decimal("1800.00"),
        raw_text="seed",
        parsed_payload={"accounts": {"Broker": "1800"}},
    )
    session.add(snapshot)

    later_transfer_dt = datetime(2024, 1, 8, tzinfo=timezone.utc)
    later_transfer_tx = Transaction(
        transaction_type=TransactionType.TRANSFER,
        occurred_at=later_transfer_dt,
        posted_at=later_transfer_dt,
        description="Another transfer to broker",
    )
    later_transfer_tx.legs = [
        TransactionLeg(
            transaction_id=later_transfer_tx.id,
            account_id=bank.id,
            amount=Decimal("-200.00"),
        ),
        TransactionLeg(
            transaction_id=later_transfer_tx.id,
            account_id=investment.id,
            amount=Decimal("200.00"),
        ),
    ]
    session.add(later_transfer_tx)
    session.commit()

    service = ReportingService(session)
    history = service.net_worth_history(account_ids=None)
    points = {point.period: point.net_worth for point in history}

    # Before snapshots, net worth is based purely on the ledger (Offset excluded).
    assert points[datetime(2024, 1, 1, tzinfo=timezone.utc).date()] == Decimal("2000.00")

    # Once snapshots exist, they replace the investment ledger (net contributions) to avoid
    # double-counting: net_worth = ledger_total + snapshot_value - investment_ledger_at_snapshot.
    assert points[datetime(2024, 1, 6, tzinfo=timezone.utc).date()] == Decimal("2300.00")

    # Transfers between included accounts should not change full net worth even without a new
    # snapshot; the latest snapshot + post-snapshot contributions should remain represented.
    assert points[datetime(2024, 1, 8, tzinfo=timezone.utc).date()] == Decimal("2300.00")
