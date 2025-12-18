from __future__ import annotations

import io
import json
from uuid import UUID

import pytest

from apps.api.handlers.bedrock_suggestions import suggest_import_categories


def _json_body(response: dict) -> dict:
    return json.loads(response["body"])


def test_suggest_import_categories_returns_suggestions(monkeypatch: pytest.MonkeyPatch):
    groceries_id = UUID(int=1)
    tx_id = UUID(int=2)

    class FakeBedrock:
        def invoke_model(self, **kwargs):
            assert kwargs.get("modelId") == "anthropic.sonnet-test"
            body = {
                "output_text": json.dumps(
                    {
                        "suggestions": [
                            {
                                "id": str(tx_id),
                                "category_id": str(groceries_id),
                                "confidence": 0.9,
                                "reason": "Recurring groceries merchant",
                            }
                        ]
                    }
                )
            }
            return {"body": io.BytesIO(json.dumps(body).encode())}

    def fake_get_client():
        return FakeBedrock()

    monkeypatch.setattr(
        "apps.api.handlers.bedrock_suggestions._get_bedrock_client",
        fake_get_client,
    )

    event = {
        "body": json.dumps(
            {
                "categories": [
                    {"id": str(groceries_id), "name": "Groceries", "category_type": "expense"}
                ],
                "history": [{"description": "ICA supermarket", "category_id": str(groceries_id)}],
                "transactions": [
                    {"id": str(tx_id), "description": "ICA supermarket", "amount": "-99.00"}
                ],
                "model_id": "anthropic.sonnet-test",
                "max_tokens": 320,
            }
        ),
        "isBase64Encoded": False,
    }

    response = suggest_import_categories(event, None)
    assert response["statusCode"] == 200
    payload = _json_body(response)
    assert payload["suggestions"][0]["id"] == str(tx_id)
    assert payload["suggestions"][0]["category_id"] == str(groceries_id)


def test_suggest_import_categories_accepts_array_output(monkeypatch: pytest.MonkeyPatch):
    groceries_id = UUID(int=1)
    tx_id = UUID(int=2)

    class FakeBedrock:
        def invoke_model(self, **_kwargs):
            body = {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            [
                                {
                                    "id": str(tx_id),
                                    "category_id": str(groceries_id),
                                    "confidence": 0.9,
                                    "reason": "Recurring groceries merchant",
                                }
                            ]
                        ),
                    }
                ]
            }
            return {"body": io.BytesIO(json.dumps(body).encode())}

    def fake_get_client():
        return FakeBedrock()

    monkeypatch.setattr(
        "apps.api.handlers.bedrock_suggestions._get_bedrock_client",
        fake_get_client,
    )

    event = {
        "body": json.dumps(
            {
                "categories": [
                    {"id": str(groceries_id), "name": "Groceries", "category_type": "expense"}
                ],
                "history": [],
                "transactions": [
                    {"id": str(tx_id), "description": "ICA supermarket", "amount": "-99.00"}
                ],
            }
        ),
        "isBase64Encoded": False,
    }

    response = suggest_import_categories(event, None)
    assert response["statusCode"] == 200
    payload = _json_body(response)
    assert payload["suggestions"][0]["id"] == str(tx_id)
    assert payload["suggestions"][0]["category_id"] == str(groceries_id)


def test_suggest_import_categories_accepts_tool_use(monkeypatch: pytest.MonkeyPatch):
    groceries_id = UUID(int=1)
    tx_id = UUID(int=2)

    class FakeBedrock:
        def invoke_model(self, **_kwargs):
            body = {
                "content": [
                    {
                        "type": "tool_use",
                        "id": "toolu_1",
                        "name": "categorize_transactions",
                        "input": {
                            "suggestions": [
                                {
                                    "id": str(tx_id),
                                    "category_id": str(groceries_id),
                                    "confidence": 0.9,
                                    "reason": "Recurring groceries merchant",
                                }
                            ]
                        },
                    }
                ]
            }
            return {"body": io.BytesIO(json.dumps(body).encode())}

    def fake_get_client():
        return FakeBedrock()

    monkeypatch.setattr(
        "apps.api.handlers.bedrock_suggestions._get_bedrock_client",
        fake_get_client,
    )

    event = {
        "body": json.dumps(
            {
                "categories": [
                    {"id": str(groceries_id), "name": "Groceries", "category_type": "expense"}
                ],
                "history": [],
                "transactions": [
                    {"id": str(tx_id), "description": "ICA supermarket", "amount": "-99.00"}
                ],
            }
        ),
        "isBase64Encoded": False,
    }

    response = suggest_import_categories(event, None)
    assert response["statusCode"] == 200
    payload = _json_body(response)
    assert payload["suggestions"][0]["id"] == str(tx_id)
    assert payload["suggestions"][0]["category_id"] == str(groceries_id)
