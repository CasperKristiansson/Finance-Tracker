from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

import pytest

from apps.api.models import Account
from apps.api.services.tax import TaxService
from apps.api.shared import AccountType, TaxEventType


def test_create_tax_event_requires_positive_amount(session) -> None:
    account = Account(name="Bank", account_type=AccountType.NORMAL, is_active=True)
    session.add(account)
    session.commit()

    service = TaxService(session)
    with pytest.raises(ValueError, match="positive"):
        service.create_tax_event(
            account_id=account.id,
            occurred_at=datetime(2026, 1, 2, tzinfo=timezone.utc),
            posted_at=None,
            amount=Decimal("0"),
            event_type=TaxEventType.PAYMENT,
            description="Tax payment",
        )


def test_summary_for_year_current_year_uses_ytd_fetch(session, monkeypatch) -> None:
    service = TaxService(session)
    current_year = datetime.now(timezone.utc).year

    def _row(month: int, event_type: TaxEventType, amount: str):
        return SimpleNamespace(
            transaction=SimpleNamespace(
                occurred_at=datetime(current_year, month, 10, tzinfo=timezone.utc)
            ),
            event=SimpleNamespace(event_type=event_type),
            amount=Decimal(amount),
        )

    calls = {"count": 0}

    def _fake_fetch_tax_rows(**_kwargs):
        calls["count"] += 1
        if calls["count"] == 1:
            return [_row(1, TaxEventType.PAYMENT, "100"), _row(2, TaxEventType.REFUND, "25")]
        if calls["count"] == 2:
            return [_row(1, TaxEventType.PAYMENT, "55")]
        return [_row(3, TaxEventType.REFUND, "10")]

    monkeypatch.setattr(service, "_fetch_tax_rows", _fake_fetch_tax_rows)
    monthly, totals = service.summary_for_year(year=current_year)

    assert len(monthly) == 12
    assert totals.net_tax_paid_ytd == Decimal("55")
    assert totals.net_tax_paid_last_12m == Decimal("-10")
    assert totals.largest_month == 1


def test_summary_all_time_skips_none_year_and_handles_empty_yearly(session, monkeypatch) -> None:
    service = TaxService(session)
    offset_account = Account(
        id=uuid4(),
        name="Offset",
        account_type=AccountType.NORMAL,
        is_active=False,
    )
    monkeypatch.setattr(service, "_get_or_create_offset_account", lambda: offset_account)
    monkeypatch.setattr(service, "_net_tax_paid_between", lambda **_kwargs: Decimal("0"))

    class _Rows:
        def all(self):
            return [(None, Decimal("100"), Decimal("20"), Decimal("80"))]

    monkeypatch.setattr(service.session, "exec", lambda _stmt: _Rows())
    response = service.summary_all_time()

    assert response.yearly == []
    assert response.totals.total_payments == Decimal("0")
    assert response.totals.total_refunds == Decimal("0")
    assert response.totals.largest_year is None


def test_summary_for_year_with_zero_rows_has_no_largest_month(session, monkeypatch) -> None:
    service = TaxService(session)
    target_year = datetime.now(timezone.utc).year - 1

    monkeypatch.setattr(service, "_fetch_tax_rows", lambda **_kwargs: [])
    monthly, totals = service.summary_for_year(year=target_year)

    assert len(monthly) == 12
    assert totals.largest_month is None
    assert totals.largest_month_value is None
