from __future__ import annotations

import io
import json
from uuid import UUID

import pytest

from apps.api.handlers import bedrock_suggestions as bs
from apps.api.handlers.bedrock_suggestions import (
    SuggestionConnection,
    SuggestionError,
    connect_import_suggestions,
    disconnect_import_suggestions,
    enqueue_import_category_suggestions,
    process_import_category_suggestions,
    suggest_import_categories,
)
from apps.api.schemas import ImportCategorySuggestionRead

# pylint: disable=protected-access


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


def test_suggest_import_categories_validation_and_error(monkeypatch: pytest.MonkeyPatch) -> None:
    invalid = suggest_import_categories({"body": "{}", "isBase64Encoded": False}, None)
    assert invalid["statusCode"] == 400

    monkeypatch.setattr(
        bs,
        "_suggest_with_bedrock",
        lambda _request: (_ for _ in ()).throw(SuggestionError("boom", status_code=503)),
    )
    event = {
        "body": json.dumps(
            {
                "categories": [{"id": str(UUID(int=1)), "name": "A", "category_type": "expense"}],
                "history": [],
                "transactions": [{"id": str(UUID(int=2)), "description": "x"}],
            }
        ),
        "isBase64Encoded": False,
    }
    response = suggest_import_categories(event, None)
    assert response["statusCode"] == 503
    assert _json_body(response)["error"] == "boom"


def test_connect_import_suggestions_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    missing = connect_import_suggestions({"queryStringParameters": {}}, None)
    assert missing["statusCode"] == 400

    invalid_context = connect_import_suggestions(
        {
            "queryStringParameters": {"client_id": "abc", "token": "tok"},
            "requestContext": {},
        },
        None,
    )
    assert invalid_context["statusCode"] == 400

    monkeypatch.setattr(bs, "_store_connection", lambda **_kwargs: False)
    unavailable = connect_import_suggestions(
        {
            "queryStringParameters": {"client_id": "abc", "token": "tok"},
            "requestContext": {"connectionId": "c1", "domainName": "d.example", "stage": "prod"},
        },
        None,
    )
    assert unavailable["statusCode"] == 503

    captured: dict[str, str] = {}

    def _store_connection(**kwargs):
        captured.update(kwargs)
        return True

    monkeypatch.setattr(bs, "_store_connection", _store_connection)
    ok = connect_import_suggestions(
        {
            "queryStringParameters": {"client_id": "abc", "token": "tok"},
            "requestContext": {"connectionId": "c1", "domainName": "d.example", "stage": "prod"},
        },
        None,
    )
    assert ok["statusCode"] == 200
    assert captured["endpoint"] == "https://d.example/prod"


def test_disconnect_import_suggestions_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    missing = disconnect_import_suggestions({"requestContext": {}}, None)
    assert missing["statusCode"] == 400

    removed: list[str] = []

    def _remove_connection(connection_id: str) -> None:
        removed.append(connection_id)

    monkeypatch.setattr(bs, "_remove_connection", _remove_connection)
    ok = disconnect_import_suggestions({"requestContext": {"connectionId": "conn-1"}}, None)
    assert ok["statusCode"] == 200
    assert removed == ["conn-1"]


def test_enqueue_import_category_suggestions_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    invalid = enqueue_import_category_suggestions({"body": "{}", "isBase64Encoded": False}, None)
    assert invalid["statusCode"] == 400

    monkeypatch.delenv(bs._SUGGESTIONS_QUEUE_ENV, raising=False)
    missing_queue = enqueue_import_category_suggestions(
        {
            "body": json.dumps(
                {
                    "client_id": str(UUID(int=1)),
                    "client_token": "token-1234567890",
                    "categories": [
                        {"id": str(UUID(int=2)), "name": "Groceries", "category_type": "expense"}
                    ],
                    "history": [],
                    "transactions": [{"id": str(UUID(int=3)), "description": "x"}],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert missing_queue["statusCode"] == 503

    monkeypatch.setenv(bs._SUGGESTIONS_QUEUE_ENV, "https://sqs.example/queue")
    monkeypatch.setattr(bs, "_fetch_connection_by_client", lambda _client_id: None)
    missing_conn = enqueue_import_category_suggestions(
        {
            "body": json.dumps(
                {
                    "client_id": str(UUID(int=1)),
                    "client_token": "token-1234567890",
                    "categories": [
                        {"id": str(UUID(int=2)), "name": "Groceries", "category_type": "expense"}
                    ],
                    "history": [],
                    "transactions": [{"id": str(UUID(int=3)), "description": "x"}],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert missing_conn["statusCode"] == 409

    monkeypatch.setattr(
        bs,
        "_fetch_connection_by_client",
        lambda _client_id: SuggestionConnection("c1", "https://endpoint", "other-token-value"),
    )
    mismatch = enqueue_import_category_suggestions(
        {
            "body": json.dumps(
                {
                    "client_id": str(UUID(int=1)),
                    "client_token": "token-1234567890",
                    "categories": [
                        {"id": str(UUID(int=2)), "name": "Groceries", "category_type": "expense"}
                    ],
                    "history": [],
                    "transactions": [{"id": str(UUID(int=3)), "description": "x"}],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert mismatch["statusCode"] == 403

    sent: dict[str, str] = {}

    class _SqsClient:
        def send_message(self, **kwargs):
            sent.update(kwargs)

    monkeypatch.setattr(
        bs,
        "_fetch_connection_by_client",
        lambda _client_id: SuggestionConnection("c1", "https://endpoint", "token-1234567890"),
    )
    monkeypatch.setattr(bs.boto3, "client", lambda *_args, **_kwargs: _SqsClient())
    ok = enqueue_import_category_suggestions(
        {
            "body": json.dumps(
                {
                    "client_id": str(UUID(int=1)),
                    "client_token": "token-1234567890",
                    "categories": [
                        {"id": str(UUID(int=2)), "name": "Groceries", "category_type": "expense"}
                    ],
                    "history": [],
                    "transactions": [{"id": str(UUID(int=3)), "description": "x"}],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert ok["statusCode"] == 202
    assert sent["QueueUrl"] == "https://sqs.example/queue"


def test_enqueue_import_category_suggestions_batch_state_paths(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv(bs._SUGGESTIONS_QUEUE_ENV, "https://sqs.example/queue")
    monkeypatch.setattr(
        bs,
        "_fetch_connection_by_client",
        lambda _client_id: SuggestionConnection("c1", "https://endpoint", "token-1234567890"),
    )
    monkeypatch.setattr(
        bs,
        "load_import_suggestions_state",
        lambda _batch_id, user_id: {"status": "running"},
    )

    duplicate = enqueue_import_category_suggestions(
        {
            "body": json.dumps(
                {
                    "client_id": str(UUID(int=1)),
                    "client_token": "token-1234567890",
                    "import_batch_id": str(UUID(int=4)),
                    "categories": [
                        {"id": str(UUID(int=2)), "name": "Groceries", "category_type": "expense"}
                    ],
                    "history": [],
                    "transactions": [{"id": str(UUID(int=3)), "description": "x"}],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert duplicate["statusCode"] == 409

    monkeypatch.setattr(bs, "load_import_suggestions_state", lambda _batch_id, user_id: None)
    monkeypatch.setattr(bs, "save_import_suggestions_state", lambda **_kwargs: False)
    unavailable = enqueue_import_category_suggestions(
        {
            "body": json.dumps(
                {
                    "client_id": str(UUID(int=1)),
                    "client_token": "token-1234567890",
                    "import_batch_id": str(UUID(int=4)),
                    "categories": [
                        {"id": str(UUID(int=2)), "name": "Groceries", "category_type": "expense"}
                    ],
                    "history": [],
                    "transactions": [{"id": str(UUID(int=3)), "description": "x"}],
                }
            ),
            "isBase64Encoded": False,
        },
        None,
    )
    assert unavailable["statusCode"] == 503


def test_process_import_category_suggestions_success_and_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    sent_payloads: list[dict[str, object]] = []
    monkeypatch.setattr(
        bs,
        "_send_to_client",
        lambda _client_id, _client_token, payload: sent_payloads.append(payload),
    )

    monkeypatch.setattr(
        bs,
        "_suggest_with_bedrock",
        lambda _request: [
            ImportCategorySuggestionRead(
                id=UUID(int=3),
                category_id=UUID(int=2),
                confidence=0.9,
                reason="ok",
            )
        ],
    )
    event = {
        "Records": [
            {"body": "not-json"},
            {
                "body": json.dumps(
                    {
                        "job_id": "job-1",
                        "client_id": str(UUID(int=1)),
                        "client_token": "token-1234567890",
                        "categories": [
                            {"id": str(UUID(int=2)), "name": "A", "category_type": "expense"}
                        ],
                        "history": [],
                        "transactions": [{"id": str(UUID(int=3)), "description": "x"}],
                    }
                )
            },
        ]
    }
    response = process_import_category_suggestions(event, None)
    assert response == {"batchItemFailures": []}
    assert sent_payloads and sent_payloads[0]["type"] == "import_suggestions"

    monkeypatch.setattr(
        bs,
        "_suggest_with_bedrock",
        lambda _request: (_ for _ in ()).throw(SuggestionError("fail")),
    )
    process_import_category_suggestions(event, None)
    assert sent_payloads[-1]["type"] == "import_suggestions_error"
