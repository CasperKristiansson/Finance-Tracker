"""Transaction and materialized-view methods for reporting repository."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Iterable, List, Optional, cast
from uuid import UUID

from sqlalchemy import SQLColumnExpression, Table, case, func
from sqlalchemy import select as sa_select
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from ..models import Category, Transaction, TransactionLeg
from ..shared import TransactionType, coerce_decimal
from .reporting_core_mixin import ReportingCoreMixin
from .reporting_types import TransactionAmountRow


class ReportingTransactionMixin(ReportingCoreMixin):
    """Transaction aggregation and materialized-view operations."""

    def fetch_transaction_amounts(
        self,
        *,
        start: datetime,
        end: datetime,
        account_ids: Optional[Iterable[UUID]] = None,
    ) -> List[TransactionAmountRow]:
        transaction_table = cast(Table, getattr(Transaction, "__table__"))
        leg_table = cast(Table, getattr(TransactionLeg, "__table__"))
        category_table = cast(Table, getattr(Category, "__table__"))
        start_value = self._normalize_datetime(start)
        end_value = self._normalize_datetime(end)

        amount_expr = cast(SQLColumnExpression[Any], leg_table.c.amount)

        columns: list[Any] = [
            cast(Any, transaction_table.c.id).label("id"),
            cast(Any, transaction_table.c.occurred_at).label("occurred_at"),
            cast(Any, transaction_table.c.transaction_type).label("transaction_type"),
            cast(Any, transaction_table.c.description).label("description"),
            cast(Any, transaction_table.c.notes).label("notes"),
            cast(Any, transaction_table.c.category_id).label("category_id"),
            cast(Any, category_table.c.name).label("category_name"),
            cast(Any, category_table.c.icon).label("category_icon"),
            cast(Any, category_table.c.color_hex).label("category_color_hex"),
            func.sum(leg_table.c.amount).label("amount"),
            func.coalesce(
                func.sum(
                    case(
                        (amount_expr > 0, amount_expr),
                        else_=0,
                    )
                ),
                0,
            ).label("inflow"),
            func.coalesce(
                func.sum(
                    case(
                        (amount_expr < 0, -amount_expr),
                        else_=0,
                    )
                ),
                0,
            ).label("outflow"),
        ]

        statement: Any = sa_select(*columns)
        statement = (
            statement.join_from(
                leg_table, transaction_table, leg_table.c.transaction_id == transaction_table.c.id
            )
            .join(
                category_table,
                category_table.c.id == transaction_table.c.category_id,
                isouter=True,
            )
            .where(transaction_table.c.occurred_at >= start_value)
            .where(transaction_table.c.occurred_at < end_value)
            .group_by(
                transaction_table.c.id,
                transaction_table.c.occurred_at,
                transaction_table.c.transaction_type,
                transaction_table.c.description,
                transaction_table.c.notes,
                transaction_table.c.category_id,
                category_table.c.name,
                category_table.c.icon,
                category_table.c.color_hex,
            )
            .order_by(transaction_table.c.occurred_at.asc())
        )

        statement = statement.where(transaction_table.c.user_id == self.user_id)
        statement = statement.where(leg_table.c.user_id == self.user_id)

        if account_ids:
            statement = statement.where(leg_table.c.account_id.in_(list(account_ids)))
        elif self._excluded_account_ids:
            statement = statement.where(
                ~leg_table.c.account_id.in_(list(self._excluded_account_ids))
            )

        rows = self.session.exec(statement).all()
        result: List[TransactionAmountRow] = []
        for (
            tx_id,
            occurred_at,
            tx_type,
            description,
            notes,
            category_id,
            category_name,
            category_icon,
            category_color_hex,
            amount,
            inflow,
            outflow,
        ) in rows:
            result.append(
                TransactionAmountRow(
                    id=cast(UUID, tx_id),
                    occurred_at=cast(datetime, occurred_at),
                    transaction_type=TransactionType(str(tx_type)),
                    description=cast(Optional[str], description),
                    notes=cast(Optional[str], notes),
                    category_id=cast(Optional[UUID], category_id),
                    category_name=cast(Optional[str], category_name),
                    category_icon=cast(Optional[str], category_icon),
                    category_color_hex=cast(Optional[str], category_color_hex),
                    amount=coerce_decimal(amount),
                    inflow=coerce_decimal(inflow),
                    outflow=coerce_decimal(outflow),
                )
            )
        return result

    def refresh_materialized_views(
        self,
        view_names: Iterable[str],
        *,
        concurrently: bool = False,
    ) -> None:
        """Refresh materialized views when supported by the database."""

        bind = self.session.get_bind()
        dialect = getattr(bind, "dialect", None)
        if dialect is None or getattr(dialect, "name", "") != "postgresql":
            # SQLite (tests) and other engines simply skip refresh logic.
            return

        keyword = " CONCURRENTLY" if concurrently else ""
        for view_name in view_names:
            statement = text(f"REFRESH MATERIALIZED VIEW{keyword} {view_name}")
            try:
                self.session.execute(statement)
                self.session.commit()
            except SQLAlchemyError:
                self.session.rollback()
                raise


__all__ = ["ReportingTransactionMixin"]
