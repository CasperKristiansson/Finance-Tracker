from __future__ import annotations

from datetime import date
from uuid import uuid4

import pytest
from pydantic import ValidationError

from apps.api.schemas.account import AccountCreate, AccountUpdate
from apps.api.schemas.category import CategoryUpdate
from apps.api.schemas.imports import ImportCommitFile
from apps.api.schemas.loan import LoanUpdate
from apps.api.schemas.reporting import (
    DateRangeReportQuery,
    ExportReportRequest,
    MonthlyReportQuery,
    NetWorthHistoryQuery,
    TotalOverviewQuery,
    YearlyReportQuery,
)
from apps.api.schemas.transaction import TransactionListQuery, TransactionUpdate
from apps.api.shared import AccountType, CategoryType


def test_import_commit_file_rejects_invalid_base64() -> None:
    with pytest.raises(ValidationError):
        ImportCommitFile(
            id=uuid4(),
            filename="statement.xlsx",
            account_id=uuid4(),
            row_count=1,
            error_count=0,
            content_base64="not-base64",
        )


def test_loan_update_requires_at_least_one_field() -> None:
    with pytest.raises(ValidationError):
        LoanUpdate()


def test_transaction_list_query_parses_category_ids_and_types() -> None:
    category_id = uuid4()
    parsed = TransactionListQuery.model_validate(
        {
            "category_ids": str(category_id),
            "transaction_type": "expense,transfer",
        }
    )
    assert parsed.category_ids == [category_id]
    assert [tx_type.value for tx_type in parsed.transaction_type or []] == ["expense", "transfer"]


def test_transaction_update_requires_fields() -> None:
    with pytest.raises(ValidationError):
        TransactionUpdate()


def test_account_and_category_schema_guards() -> None:
    with pytest.raises(ValidationError):
        AccountCreate(account_type=AccountType.DEBT)

    with pytest.raises(ValidationError):
        AccountCreate(
            account_type=AccountType.NORMAL,
            loan={
                "origin_principal": "100",
                "current_principal": "100",
                "interest_rate_annual": "0.05",
                "interest_compound": "monthly",
            },
        )

    created = AccountCreate(name="  Primary  ", account_type=AccountType.NORMAL)
    assert created.name == "Primary"
    unnamed = AccountCreate(name="   ", account_type=AccountType.NORMAL)
    assert unnamed.name == "Account"

    with pytest.raises(ValidationError):
        AccountUpdate()
    with pytest.raises(ValidationError):
        AccountUpdate(name="   ")
    assert AccountUpdate(name="  Savings ").name == "Savings"

    with pytest.raises(ValidationError):
        CategoryUpdate()
    assert CategoryUpdate(category_type=CategoryType.EXPENSE).category_type == CategoryType.EXPENSE


def test_reporting_query_parsing_and_export_payload() -> None:
    a_id = uuid4()
    b_id = uuid4()
    c_id = uuid4()

    monthly = MonthlyReportQuery.model_validate(
        {"year": 2026, "account_ids": [a_id, b_id], "category_ids": str(c_id)}
    )
    assert monthly.account_ids == [a_id, b_id]
    assert monthly.category_ids == [c_id]

    yearly = YearlyReportQuery.model_validate({"account_ids": f"{a_id},{b_id}"})
    assert yearly.account_ids == [a_id, b_id]
    assert TotalOverviewQuery.model_validate({"account_ids": ""}).account_ids is None

    ranged = DateRangeReportQuery.model_validate(
        {
            "start_date": date(2026, 1, 1),
            "end_date": date(2026, 2, 1),
            "account_ids": "",
            "category_ids": [c_id],
        }
    )
    assert ranged.account_ids is None
    assert ranged.category_ids == [c_id]

    with pytest.raises(Exception):
        MonthlyReportQuery._parse_uuid_list(123)  # pylint: disable=protected-access

    export = ExportReportRequest.from_payload(
        {
            "granularity": "monthly",
            "format": "csv",
            "year": 2026,
            "account_ids": [a_id],
            "category_ids": f"{b_id},{c_id}",
        }
    )
    assert list(export.account_ids or []) == [a_id]
    assert list(export.category_ids or []) == [b_id, c_id]

    export_none = ExportReportRequest.from_payload(
        {
            "granularity": "monthly",
            "format": "csv",
            "account_ids": [],
            "category_ids": 123,
        }
    )
    assert export_none.account_ids is None
    assert export_none.category_ids is None

    nw = NetWorthHistoryQuery.model_validate({"account_ids": str(a_id)})
    assert nw.account_ids == [a_id]


def test_reporting_and_transaction_schema_additional_split_branches() -> None:
    a_id = uuid4()
    c_id = uuid4()

    monthly_no_lists = MonthlyReportQuery.model_validate({"year": 2026})
    assert monthly_no_lists.year == 2026

    yearly_category = YearlyReportQuery.model_validate({"category_ids": str(c_id)})
    assert yearly_category.category_ids == [c_id]

    ranged_no_lists = DateRangeReportQuery.model_validate(
        {"start_date": date(2026, 1, 1), "end_date": date(2026, 1, 2)}
    )
    assert ranged_no_lists.account_ids is None
    assert ranged_no_lists.category_ids is None

    assert TotalOverviewQuery.model_validate({}).account_ids is None
    assert NetWorthHistoryQuery.model_validate({}).account_ids is None

    assert MonthlyReportQuery._split_lists("raw") == "raw"  # pylint: disable=protected-access
    assert YearlyReportQuery._split_lists("raw") == "raw"  # pylint: disable=protected-access
    assert DateRangeReportQuery._split_lists("raw") == "raw"  # pylint: disable=protected-access

    tx_query = TransactionListQuery.model_validate(
        {"account_ids": [a_id], "category_ids": [c_id], "transaction_type": "income"}
    )
    assert tx_query.account_ids == [a_id]
    assert tx_query.category_ids == [c_id]
