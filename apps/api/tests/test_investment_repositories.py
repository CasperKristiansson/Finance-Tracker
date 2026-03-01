from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from sqlmodel import Session

from apps.api.models import InvestmentHolding, InvestmentSnapshot, InvestmentTransaction
from apps.api.repositories.investment_snapshots import (
    InvestmentSnapshotRepository as SnapshotWithHoldingsRepository,
)
from apps.api.repositories.investment_transactions import InvestmentTransactionRepository
from apps.api.repositories.investments import (
    InvestmentSnapshotRepository as LegacyInvestmentSnapshotRepository,
)


def _snapshot(snapshot_date: date, *, provider: str = "nordnet") -> InvestmentSnapshot:
    return InvestmentSnapshot(
        provider=provider,
        report_type="portfolio",
        account_name="Main",
        snapshot_date=snapshot_date,
        portfolio_value=Decimal("1000.00"),
        raw_text="raw",
        parsed_payload={"ok": True},
    )


def test_legacy_investment_snapshot_repository_create_and_list(session: Session) -> None:
    repository = LegacyInvestmentSnapshotRepository(session)
    older = repository.create(_snapshot(date(2026, 1, 1)))
    newer = repository.create(_snapshot(date(2026, 2, 1)))

    listed = repository.list()
    assert listed[0].id == newer.id
    assert listed[1].id == older.id

    limited = repository.list(limit=1)
    assert len(limited) == 1
    assert limited[0].id == newer.id


def test_snapshot_repository_with_holdings(session: Session) -> None:
    repository = SnapshotWithHoldingsRepository(session)
    first = _snapshot(date(2026, 1, 1))
    first_holdings = [
        InvestmentHolding(snapshot_id=first.id, snapshot_date=first.snapshot_date, name="Fund A"),
        InvestmentHolding(snapshot_id=first.id, snapshot_date=first.snapshot_date, name="Fund B"),
    ]
    repository.create_with_holdings(first, first_holdings)

    second = _snapshot(date(2026, 3, 1))
    repository.create_with_holdings(
        second,
        [
            InvestmentHolding(
                snapshot_id=second.id, snapshot_date=second.snapshot_date, name="Fund C"
            )
        ],
    )

    listed = repository.list_snapshots()
    assert listed[0].id == second.id
    assert listed[0].holdings

    latest = repository.latest_snapshot()
    assert latest is not None
    assert latest.id == second.id
    assert repository.get_snapshot(second.id) is not None
    assert repository.get_snapshot(uuid4()) is None

    limited = repository.list_snapshots(limit=1)
    assert len(limited) == 1
    assert limited[0].id == second.id

    third = _snapshot(date(2026, 4, 1))
    repository.create_with_holdings(third, [])
    fetched = repository.get_snapshot(third.id)
    assert fetched is not None


def test_investment_transaction_repository_filters_and_linking(session: Session) -> None:
    repository = InvestmentTransactionRepository(session)
    repository.bulk_insert([])

    t1 = InvestmentTransaction(
        occurred_at=datetime(2026, 1, 10, tzinfo=timezone.utc),
        transaction_type="buy",
        description="Buy A",
        holding_name="Fund A",
        amount_sek=Decimal("-100.00"),
    )
    t2 = InvestmentTransaction(
        occurred_at=datetime(2026, 2, 15, tzinfo=timezone.utc),
        transaction_type="dividend",
        description="Dividend A",
        holding_name="Fund A",
        amount_sek=Decimal("10.00"),
    )
    t3 = InvestmentTransaction(
        occurred_at=datetime(2026, 3, 20, tzinfo=timezone.utc),
        transaction_type="sell",
        description="Sell B",
        holding_name="Fund B",
        amount_sek=Decimal("50.00"),
    )
    repository.bulk_insert([t1, t2, t3])

    by_holding = repository.list_transactions(holding="Fund A")
    assert {tx.id for tx in by_holding} == {t1.id, t2.id}

    by_type = repository.list_transactions(tx_type="sell")
    assert [tx.id for tx in by_type] == [t3.id]

    by_range = repository.list_transactions(
        start=datetime(2026, 2, 1, tzinfo=timezone.utc),
        end=datetime(2026, 3, 1, tzinfo=timezone.utc),
    )
    assert [tx.id for tx in by_range] == [t2.id]

    limited = repository.list_transactions(limit=1)
    assert len(limited) == 1

    unsynced = repository.list_unsynced(limit=5)
    assert len(unsynced) == 3

    ledger_tx_id = str(UUID(int=123))
    repository.mark_linked(str(t1.id), ledger_tx_id)

    refreshed = session.get(InvestmentTransaction, t1.id)
    assert refreshed is not None
    assert str(refreshed.ledger_transaction_id) == ledger_tx_id


def test_investment_transaction_repository_mark_linked_ignores_invalid_ids(
    session: Session,
) -> None:
    repository = InvestmentTransactionRepository(session)
    tx = InvestmentTransaction(
        occurred_at=datetime(2026, 1, 10, tzinfo=timezone.utc),
        transaction_type="buy",
        description="Buy A",
        holding_name="Fund A",
        amount_sek=Decimal("-100.00"),
    )
    repository.bulk_insert([tx])

    repository.mark_linked("not-a-uuid", str(UUID(int=1)))
    repository.mark_linked(str(tx.id), "still-not-a-uuid")

    persisted = session.get(InvestmentTransaction, tx.id)
    assert persisted is not None
    assert persisted.ledger_transaction_id is None
