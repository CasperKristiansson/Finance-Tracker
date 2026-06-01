from __future__ import annotations

import json
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from apps.api.handlers.ventures import (
    create_venture_company,
    get_venture_company,
    reset_handler_state,
    update_venture_company,
    ventures_overview,
)
from apps.api.shared import configure_engine, get_engine


@pytest.fixture(autouse=True)
def configure_sqlite(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    reset_handler_state()
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


def _body(response) -> dict:
    return json.loads(response["body"])


def test_venture_company_handler_flow() -> None:
    create_response = create_venture_company(
        {
            "body": json.dumps(
                {
                    "name": "Handler Co",
                    "status": "ongoing",
                    "initial_valuation": {
                        "event_date": "2026-01-01",
                        "label": "Initial",
                        "paper_value_sek": "500000",
                        "haircut_percentage": "50",
                        "valuation_source": "founder_estimate",
                    },
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert create_response["statusCode"] == 201
    created = _body(create_response)
    company_id = created["summary"]["company"]["id"]
    assert created["summary"]["risk_adjusted_value_sek"] == "250000.00"

    overview_response = ventures_overview({}, None)
    assert overview_response["statusCode"] == 200
    overview = _body(overview_response)
    assert overview["kpis"]["total_paper_value_sek"] == "500000.00"

    update_response = update_venture_company(
        {
            "pathParameters": {"companyId": company_id},
            "body": json.dumps({"status": "stale"}),
            "isBase64Encoded": False,
        },
        None,
    )
    assert update_response["statusCode"] == 200
    assert _body(update_response)["summary"]["company"]["status"] == "stale"

    get_response = get_venture_company({"pathParameters": {"companyId": company_id}}, None)
    assert get_response["statusCode"] == 200
    assert _body(get_response)["summary"]["company"]["name"] == "Handler Co"

    null_status = update_venture_company(
        {
            "pathParameters": {"companyId": company_id},
            "body": json.dumps({"status": None}),
            "isBase64Encoded": False,
        },
        None,
    )
    assert null_status["statusCode"] == 400


def test_venture_handler_validation_errors() -> None:
    bad_create = create_venture_company(
        {"body": json.dumps({"status": "archived"}), "isBase64Encoded": False},
        None,
    )
    assert bad_create["statusCode"] == 400

    missing_id = get_venture_company({"pathParameters": {}}, None)
    assert missing_id["statusCode"] == 400
