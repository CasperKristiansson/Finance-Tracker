from __future__ import annotations

import io
import json
from typing import Iterator

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

from apps.api.handlers.investments import (
    create_nordnet_snapshot,
    list_nordnet_snapshots,
    parse_nordnet_export,
    reset_handler_state,
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


def _json_body(response: dict) -> dict:
    return json.loads(response["body"])


def test_create_snapshot_and_list():
    raw_text = "\n".join(
        [
            "Portföljrapport",
            "2024-11-30",
            "Innehav",
            "iShares Core MSCI World UCITS ETF USD (Acc)",
            "109,57 EUR",
            "108,80",
            "10",
            "32 688,70 SEK",
            "2,10%",
        ]
    )

    event = {
        "body": json.dumps(
            {
                "raw_text": raw_text,
            }
        ),
        "isBase64Encoded": False,
    }

    create_response = create_nordnet_snapshot(event, None)
    assert create_response["statusCode"] == 201
    created = _json_body(create_response)["snapshot"]
    assert created["provider"] == "nordnet"
    assert created["report_type"] == "portfolio_report"
    assert created["parsed_payload"]["holdings"][0]["name"].startswith("iShares Core MSCI World")
    # holdings persisted
    assert created["holdings"][0]["name"].startswith("iShares Core MSCI World")

    list_response = list_nordnet_snapshots({"queryStringParameters": None}, None)
    assert list_response["statusCode"] == 200
    listed = _json_body(list_response)["snapshots"]
    assert len(listed) == 1
    assert listed[0]["snapshot_date"] == "2024-11-30"


def test_create_snapshot_with_bedrock(monkeypatch: pytest.MonkeyPatch):
    class FakeBedrock:
        def invoke_model(self, **kwargs):
            assert kwargs.get("modelId") == "anthropic.sonnet-test"
            body = {
                "output_text": json.dumps(
                    {
                        "cleaned_rows": [{"name": "ETF A", "type": "etf"}],
                        "notes": "normalized",
                    }
                )
            }
            return {"body": io.BytesIO(json.dumps(body).encode())}

    monkeypatch.setattr(
        "apps.api.services.investments.InvestmentSnapshotService._get_bedrock_client",
        lambda self: FakeBedrock(),
    )

    event = {
        "body": json.dumps(
            {
                "use_bedrock": True,
                "snapshot_date": "2024-12-31",
                "raw_text": "2024-12-31 Nordnet export text with ETFs",
                "parsed_payload": {"holdings": [{"name": "ETF A", "value_sek": 5000}]},
                "bedrock_model_id": "anthropic.sonnet-test",
                "bedrock_max_tokens": 320,
            }
        ),
        "isBase64Encoded": False,
    }

    response = create_nordnet_snapshot(event, None)
    assert response["statusCode"] == 201
    snapshot = _json_body(response)["snapshot"]
    assert snapshot["cleaned_payload"]["cleaned_rows"][0]["name"] == "ETF A"
    assert snapshot["bedrock_metadata"]["model_id"]


def test_parse_nordnet_export_endpoint():
    raw_text = "\n".join(
        [
            "Transaktioner",
            "2025-10-28",
            "Kristiansson Casper Ove · 39370408",
            "Insättning",
            "FRPAOMA 972391",
            "- 200,00 SEK",
        ]
    )

    event = {"body": json.dumps({"raw_text": raw_text}), "isBase64Encoded": False}
    response = parse_nordnet_export(event, None)
    assert response["statusCode"] == 200
    parsed = _json_body(response)
    assert parsed["parsed_payload"]["report_type"] == "transactions"
    assert parsed["parsed_payload"]["rows"][0]["amount"] == -200.0
