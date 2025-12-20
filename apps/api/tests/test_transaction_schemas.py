from apps.api.schemas.transaction import TransactionListQuery
from apps.api.shared import TransactionType


def test_transaction_list_query_accepts_return_type() -> None:
    query = TransactionListQuery(transaction_type="return")  # type: ignore[arg-type]

    assert query.transaction_type == [TransactionType.RETURN]
