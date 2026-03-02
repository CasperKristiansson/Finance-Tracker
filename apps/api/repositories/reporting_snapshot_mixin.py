"""Investment snapshot helpers for reporting repository."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple, cast

from sqlalchemy import select as sa_select

from ..models.investment_snapshot import InvestmentSnapshot
from ..shared import coerce_decimal
from .reporting_core_mixin import ReportingCoreMixin


class ReportingSnapshotMixin(ReportingCoreMixin):
    """Snapshot extraction and aggregation helpers."""

    def list_investment_snapshots_until(self, *, end: date) -> List[Tuple[date, Decimal]]:
        statement: Any = sa_select(
            cast(Any, InvestmentSnapshot.snapshot_date),
            cast(Any, InvestmentSnapshot.account_name),
            cast(Any, InvestmentSnapshot.portfolio_value),
            cast(Any, InvestmentSnapshot.parsed_payload),
            cast(Any, InvestmentSnapshot.cleaned_payload),
            cast(Any, InvestmentSnapshot.created_at),
            cast(Any, InvestmentSnapshot.updated_at),
        )
        statement = (
            statement.where(InvestmentSnapshot.user_id == self.user_id)
            .where(cast(Any, InvestmentSnapshot.snapshot_date) <= end)
            .order_by(
                cast(Any, InvestmentSnapshot.snapshot_date).asc(),
                cast(Any, InvestmentSnapshot.created_at).asc(),
            )
        )
        rows = self.session.exec(statement).all()

        values_by_date: Dict[date, Dict[str, Tuple[Decimal, datetime]]] = {}
        for (
            snapshot_date,
            account_name,
            portfolio_value,
            parsed_payload,
            cleaned_payload,
            created_at,
            updated_at,
        ) in rows:
            extracted = self._extract_snapshot_account_values(
                account_name=account_name,
                portfolio_value=portfolio_value,
                parsed_payload=parsed_payload,
                cleaned_payload=cleaned_payload,
            )
            if not extracted:
                continue
            date_key = self._coerce_date(snapshot_date)
            snapshot_updated_at = updated_at or created_at
            if snapshot_updated_at is None:
                snapshot_updated_at = datetime.min
            bucket = values_by_date.setdefault(date_key, {})
            for name, value in extracted.items():
                existing = bucket.get(name)
                if existing is None or snapshot_updated_at > existing[1]:
                    bucket[name] = (value, snapshot_updated_at)

        if not values_by_date:
            return []

        results: List[Tuple[date, Decimal]] = []
        latest_by_account: Dict[str, Decimal] = {}
        for day in sorted(values_by_date.keys()):
            for name, (value, _updated_at) in values_by_date[day].items():
                latest_by_account[name] = value
            total = sum(latest_by_account.values(), Decimal("0"))
            results.append((day, total))
        return results

    def latest_investment_value(self) -> Decimal:
        """Best-effort latest investment portfolio value."""

        snapshots = self.list_investment_snapshots_until(end=date.today())
        if not snapshots:
            return Decimal("0")
        return snapshots[-1][1]

    def _extract_snapshot_account_values(
        self,
        *,
        account_name: Optional[str],
        portfolio_value: Any,
        parsed_payload: Any,
        cleaned_payload: Any,
    ) -> Dict[str, Decimal]:
        payload: dict[str, Any] = {}
        if isinstance(cleaned_payload, dict):
            payload = cleaned_payload
        elif isinstance(parsed_payload, dict):
            payload = parsed_payload

        accounts = payload.get("accounts") if isinstance(payload, dict) else None
        if isinstance(accounts, dict):
            out: Dict[str, Decimal] = {}
            for name, value in accounts.items():
                amount = self._coerce_snapshot_amount(value)
                if amount is None:
                    continue
                out[str(name)] = amount
            return out

        if account_name and portfolio_value is not None:
            amount = self._coerce_snapshot_amount(portfolio_value)
            if amount is not None:
                return {str(account_name): amount}
        return {}

    @staticmethod
    def _coerce_snapshot_amount(value: Any) -> Optional[Decimal]:
        if value is None or value == "":
            return None
        try:
            return coerce_decimal(value)
        except (TypeError, ValueError, ArithmeticError):
            try:
                return Decimal(str(value))
            except (TypeError, ValueError, ArithmeticError):
                return None


__all__ = ["ReportingSnapshotMixin"]
