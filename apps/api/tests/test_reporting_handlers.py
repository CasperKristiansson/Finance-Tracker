from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from decimal import Decimal
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, select

from apps.api.handlers import (
    cashflow_forecast,
    date_range_report,
    export_report,
    monthly_report,
    net_worth_history,
    net_worth_projection,
    quarterly_report,
    reset_reporting_handler_state,
    total_overview,
    total_report,
    yearly_category_detail,
    yearly_overview,
    yearly_report,
)
from apps.api.models import Account, Category, Transaction, TransactionLeg
from apps.api.services import TransactionService
from apps.api.shared import (
    AccountType,
    CategoryType,
    TransactionType,
    configure_engine,
    get_default_user_id,
    get_engine,
    scope_session_to_user,
)


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_reporting_handler_state()
    configure_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    engine = get_engine()
    SQLModel.metadata.create_all(engine)
    try:
        yield
    finally:
        SQLModel.metadata.drop_all(engine)


def _json_body(response: dict) -> dict:
    return json.loads(response["body"])


def _create_account(session: Session, account_type: AccountType = AccountType.NORMAL) -> Account:
    account = Account(account_type=account_type)
    session.add(account)
    session.commit()
    session.refresh(account)
    session.expunge(account)
    return account


def _seed_transactions(engine, account: Account, balancing: Account) -> None:
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        service = TransactionService(session)

        income_category = Category(name="Salary", category_type=CategoryType.INCOME)
        expense_category = Category(name="Food", category_type=CategoryType.EXPENSE)
        session.add(income_category)
        session.add(expense_category)
        session.commit()
        session.refresh(income_category)
        session.refresh(expense_category)

        occurred_income = datetime(2024, 1, 10, tzinfo=timezone.utc)
        income_tx = Transaction(
            transaction_type=TransactionType.INCOME,
            occurred_at=occurred_income,
            posted_at=occurred_income,
            category_id=income_category.id,
        )
        income_legs = [
            TransactionLeg(account_id=account.id, amount=Decimal("500.00")),
            TransactionLeg(account_id=balancing.id, amount=Decimal("-500.00")),
        ]
        service.create_transaction(income_tx, income_legs)

        occurred_expense = datetime(2024, 1, 20, tzinfo=timezone.utc)
        expense_tx = Transaction(
            transaction_type=TransactionType.EXPENSE,
            occurred_at=occurred_expense,
            posted_at=occurred_expense,
            description="COOP ODENPLAN",
            category_id=expense_category.id,
        )
        expense_legs = [
            TransactionLeg(account_id=account.id, amount=Decimal("-200.00")),
            TransactionLeg(account_id=balancing.id, amount=Decimal("200.00")),
        ]
        service.create_transaction(expense_tx, expense_legs)


def _seed_income_expense_with_category(engine, account: Account, balancing: Account) -> Category:
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        income_category = Category(name="Salary", category_type=CategoryType.INCOME)
        expense_category = Category(name="Food", category_type=CategoryType.EXPENSE)
        session.add(income_category)
        session.add(expense_category)
        session.commit()
        session.refresh(income_category)
        session.refresh(expense_category)
        session.expunge(income_category)
        session.expunge(expense_category)

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        service = TransactionService(session)

        occurred_income = datetime(2024, 1, 10, tzinfo=timezone.utc)
        income_tx = Transaction(
            transaction_type=TransactionType.INCOME,
            occurred_at=occurred_income,
            posted_at=occurred_income,
            description="Salary",
            category_id=income_category.id,
        )
        income_legs = [
            TransactionLeg(account_id=account.id, amount=Decimal("500.00")),
            TransactionLeg(account_id=balancing.id, amount=Decimal("-500.00")),
        ]
        service.create_transaction(income_tx, income_legs)

        occurred_expense = datetime(2024, 1, 20, tzinfo=timezone.utc)
        expense_tx = Transaction(
            transaction_type=TransactionType.EXPENSE,
            occurred_at=occurred_expense,
            posted_at=occurred_expense,
            description="COOP ODENPLAN",
            category_id=expense_category.id,
        )
        expense_legs = [
            TransactionLeg(account_id=account.id, amount=Decimal("-200.00")),
            TransactionLeg(account_id=balancing.id, amount=Decimal("200.00")),
        ]
        service.create_transaction(expense_tx, expense_legs)

    return expense_category


def test_monthly_report_returns_income_and_expense():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
            "year": "2024",
        }
    }

    response = monthly_report(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    results = body["results"]
    assert len(results) == 1
    entry = results[0]
    assert entry["period"] == "2024-01-01"
    assert Decimal(entry["income"]) == Decimal("500.00")
    assert Decimal(entry["expense"]) == Decimal("200.00")
    assert Decimal(entry["net"]) == Decimal("300.00")


def test_yearly_report_supports_account_filter():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
        }
    }

    response = yearly_report(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    results = body["results"]
    assert len(results) == 1
    entry = results[0]
    assert entry["year"] == 2024
    assert Decimal(entry["net"]) == Decimal("300.00")


def test_total_report_returns_zero_when_empty():
    response = total_report({"queryStringParameters": None}, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert Decimal(body["income"]) == Decimal("0")
    assert Decimal(body["expense"]) == Decimal("0")
    assert Decimal(body["net"]) == Decimal("0")
    assert "generated_at" in body


def test_total_report_respects_filters():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        secondary = _create_account(session)
    _seed_transactions(engine, tracked, secondary)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
        }
    }
    response = total_report(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert Decimal(body["net"]) == Decimal("300.00")


def test_total_overview_returns_expected_shape():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_income_expense_with_category(engine, tracked, balancing)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
        }
    }
    response = total_overview(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert "as_of" in body
    assert "kpis" in body
    assert "net_worth_series" in body
    assert "monthly_income_expense" in body
    assert "yearly" in body
    assert "expense_categories_lifetime" in body
    assert "income_categories_lifetime" in body
    assert "expense_category_heatmap_by_year" in body
    assert "income_category_heatmap_by_year" in body
    assert "accounts" in body
    assert "debt" in body


def test_monthly_report_excludes_transfers():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        service = TransactionService(session)
        occurred = datetime(2024, 1, 15, tzinfo=timezone.utc)
        transfer_tx = Transaction(
            transaction_type=TransactionType.TRANSFER,
            occurred_at=occurred,
            posted_at=occurred,
        )
        transfer_legs = [
            TransactionLeg(account_id=tracked.id, amount=Decimal("-999.00")),
            TransactionLeg(account_id=balancing.id, amount=Decimal("999.00")),
        ]
        service.create_transaction(transfer_tx, transfer_legs)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
            "year": "2024",
        }
    }
    response = monthly_report(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    results = body["results"]
    assert len(results) == 1
    entry = results[0]
    assert entry["period"] == "2024-01-01"
    assert Decimal(entry["income"]) == Decimal("500.00")
    assert Decimal(entry["expense"]) == Decimal("200.00")
    assert Decimal(entry["net"]) == Decimal("300.00")


def test_net_worth_history_returns_running_balance():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
        }
    }
    response = net_worth_history(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    points = body["points"]
    assert len(points) == 2
    assert points[0]["period"] == "2024-01-10"
    assert Decimal(points[0]["net_worth"]) == Decimal("500.00")
    assert Decimal(points[1]["net_worth"]) == Decimal("300.00")


def test_yearly_overview_returns_income_expense_excluding_transfers():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_income_expense_with_category(engine, tracked, balancing)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
            "year": "2024",
        }
    }
    response = yearly_overview(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["year"] == 2024
    assert "investments_summary" in body
    assert "debt_overview" in body
    assert "account_flows" in body
    assert "income_sources" in body
    assert "expense_sources" in body
    monthly = body["monthly"]
    assert len(monthly) == 12
    jan = next(item for item in monthly if item["month"] == 1)
    assert Decimal(jan["income"]) == Decimal("500.00")
    assert Decimal(jan["expense"]) == Decimal("200.00")
    assert Decimal(jan["net"]) == Decimal("300.00")


def test_yearly_category_detail_returns_monthly_and_merchants():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    category = _seed_income_expense_with_category(engine, tracked, balancing)

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
            "year": "2024",
            "category_id": str(category.id),
        }
    }
    response = yearly_category_detail(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["category_id"] == str(category.id)
    monthly = body["monthly"]
    assert len(monthly) == 12
    jan = next(item for item in monthly if item["month"] == 1)
    assert Decimal(jan["amount"]) == Decimal("200.00")
    merchants = body["top_merchants"]
    assert merchants and merchants[0]["merchant"] == "COOP ODENPLAN"


def test_yearly_category_detail_supports_income_flow():
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_income_expense_with_category(engine, tracked, balancing)

    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        income_category = session.exec(select(Category).where(Category.name == "Salary")).one()

    params = {
        "queryStringParameters": {
            "account_ids": str(tracked.id),
            "year": "2024",
            "category_id": str(income_category.id),
            "flow": "income",
        }
    }
    response = yearly_category_detail(params, None)
    assert response["statusCode"] == 200
    body = _json_body(response)
    jan = next(item for item in body["monthly"] if item["month"] == 1)
    assert Decimal(jan["amount"]) == Decimal("500.00")
    merchants = body["top_merchants"]
    assert merchants and merchants[0]["merchant"] == "Salary"


def test_quarterly_report_returns_results() -> None:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    response = quarterly_report(
        {"queryStringParameters": {"account_ids": str(tracked.id), "year": "2024"}},
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert body["results"]
    assert body["results"][0]["quarter"] == 1


def test_date_range_report_supports_source_filter() -> None:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    response = date_range_report(
        {
            "queryStringParameters": {
                "account_ids": str(tracked.id),
                "start_date": "2024-01-01",
                "end_date": "2024-01-31",
                "source": "COOP ODENPLAN",
            }
        },
        None,
    )
    assert response["statusCode"] == 200
    body = _json_body(response)
    assert len(body["results"]) == 1
    assert Decimal(body["results"][0]["income"]) == Decimal("0")
    assert Decimal(body["results"][0]["expense"]) == Decimal("200")


def test_cashflow_forecast_and_projection_endpoints() -> None:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    forecast_response = cashflow_forecast(
        {"queryStringParameters": {"account_ids": str(tracked.id), "days": "7", "model": "simple"}},
        None,
    )
    assert forecast_response["statusCode"] == 200
    forecast = _json_body(forecast_response)
    assert forecast["model"] == "simple"
    assert len(forecast["points"]) == 7

    projection_response = net_worth_projection(
        {"queryStringParameters": {"account_ids": str(tracked.id), "months": "6"}},
        None,
    )
    assert projection_response["statusCode"] == 200
    projection = _json_body(projection_response)
    assert "current" in projection
    assert "points" in projection


def test_export_report_supports_csv_and_xlsx() -> None:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    csv_response = export_report(
        {
            "body": json.dumps(
                {
                    "granularity": "monthly",
                    "format": "csv",
                    "year": 2024,
                    "account_ids": [str(tracked.id)],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert csv_response["statusCode"] == 200
    csv_body = _json_body(csv_response)
    assert csv_body["filename"].endswith(".csv")
    csv_data = base64.b64decode(csv_body["data_base64"]).decode("utf-8")
    assert "period,income,expense,net" in csv_data

    xlsx_response = export_report(
        {
            "body": json.dumps(
                {
                    "granularity": "yearly",
                    "format": "xlsx",
                    "account_ids": [str(tracked.id)],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert xlsx_response["statusCode"] == 200
    xlsx_body = _json_body(xlsx_response)
    assert xlsx_body["filename"].endswith(".xlsx")
    xlsx_data = base64.b64decode(xlsx_body["data_base64"])
    assert len(xlsx_data) > 100


def test_export_report_other_granularities_and_workbook_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = get_engine()
    with Session(engine) as session:
        scope_session_to_user(session, get_default_user_id())
        tracked = _create_account(session)
        balancing = _create_account(session)
    _seed_transactions(engine, tracked, balancing)

    for granularity in ("quarterly", "total", "net_worth"):
        response = export_report(
            {
                "body": json.dumps(
                    {
                        "granularity": granularity,
                        "format": "csv",
                        "year": 2024,
                        "account_ids": [str(tracked.id)],
                    }
                ),
                "isBase64Encoded": False,
            },
            None,
        )
        assert response["statusCode"] == 200
        body = _json_body(response)
        decoded = base64.b64decode(body["data_base64"]).decode("utf-8")
        assert decoded

    class _WorkbookWithoutSheet:
        def __init__(self) -> None:
            self.active = None

        def save(self, _stream) -> None:
            return None

    monkeypatch.setattr("openpyxl.Workbook", _WorkbookWithoutSheet)
    error_response = export_report(
        {
            "body": json.dumps(
                {
                    "granularity": "monthly",
                    "format": "xlsx",
                    "year": 2024,
                    "account_ids": [str(tracked.id)],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert error_response["statusCode"] == 500


@pytest.mark.parametrize(
    ("handler", "event"),
    [
        (monthly_report, {"queryStringParameters": {"account_ids": "not-a-uuid"}}),
        (yearly_report, {"queryStringParameters": {"account_ids": "not-a-uuid"}}),
        (total_report, {"queryStringParameters": {"account_ids": "not-a-uuid"}}),
        (quarterly_report, {"queryStringParameters": {"account_ids": "not-a-uuid"}}),
        (date_range_report, {"queryStringParameters": {"start_date": "bad", "end_date": "bad"}}),
        (net_worth_history, {"queryStringParameters": {"account_ids": "not-a-uuid"}}),
        (cashflow_forecast, {"queryStringParameters": {"days": "0"}}),
        (net_worth_projection, {"queryStringParameters": {"months": "0"}}),
        (yearly_overview, {"queryStringParameters": {"year": "1899"}}),
        (
            yearly_category_detail,
            {"queryStringParameters": {"year": "2024", "category_id": "not-a-uuid"}},
        ),
        (total_overview, {"queryStringParameters": {"account_ids": "not-a-uuid"}}),
    ],
)
def test_reporting_handlers_return_400_on_invalid_query(
    handler, event: dict[str, dict[str, str]]
) -> None:
    response = handler(event, None)
    assert response["statusCode"] == 400
    assert "error" in _json_body(response)


def test_export_report_invalid_payload_returns_400() -> None:
    response = export_report(
        {
            "body": json.dumps({"granularity": "not-supported", "format": "csv"}),
            "isBase64Encoded": False,
        },
        None,
    )
    assert response["statusCode"] == 400
    body = _json_body(response)
    assert "error" in body
