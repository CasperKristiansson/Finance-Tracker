from __future__ import annotations

import json
from types import SimpleNamespace
from uuid import UUID

import pytest
from botocore.exceptions import ClientError

import apps.api.handlers.bedrock_suggestions as bs
from apps.api.schemas import (
    ImportCategoryHistoryItem,
    ImportCategoryOption,
    ImportCategorySuggestRequest,
    ImportCategorySuggestTransaction,
)

# pylint: disable=protected-access


def test_safe_json_and_stop_reason_helpers() -> None:
    assert bs._safe_json_loads('{"ok":true}') == {"ok": True}
    assert bs._safe_json_loads("{bad}") is None
    assert bs._extract_stop_reason({"stop_reason": "max_tokens"}) == "max_tokens"
    assert bs._extract_stop_reason({"stop_reason": 1}) is None


def test_extract_tool_input_variants() -> None:
    parsed_dict = {
        "content": [{"type": "tool_use", "name": "categorize_transactions", "input": {"a": 1}}]
    }
    parsed_list = {
        "content": [{"type": "tool_use", "name": "categorize_transactions", "input": [1, 2]}]
    }
    parsed_json_string = {
        "content": [
            {"type": "tool_use", "name": "categorize_transactions", "input": '{"suggestions":[]}'}
        ]
    }
    assert bs._extract_tool_input(parsed=parsed_dict, tool_name="categorize_transactions") == {
        "a": 1
    }
    assert bs._extract_tool_input(parsed=parsed_list, tool_name="categorize_transactions") == [1, 2]
    assert bs._extract_tool_input(
        parsed=parsed_json_string, tool_name="categorize_transactions"
    ) == {"suggestions": []}
    assert (
        bs._extract_tool_input(parsed={"content": []}, tool_name="categorize_transactions") is None
    )


def test_extract_output_text_and_json_helpers() -> None:
    assert bs._extract_output_text({"output_text": "  x  "}) == "  x  "
    assert bs._extract_output_text({"content": [{"text": "a"}, {"text": "b"}]}) == "ab"
    assert bs._extract_output_text({"completion": "done"}) == "done"
    assert bs._extract_output_text({"x": 1}) == ""

    assert bs._extract_json('{"suggestions": []}') == {"suggestions": []}
    assert bs._extract_json('```json\n{"a":1}\n```') == {"a": 1}
    assert bs._extract_json("prefix [1,2,3] suffix") == [1, 2, 3]
    assert bs._extract_json("not-json") is None


def test_signature_normalization() -> None:
    assert bs._signature("ICA #123 AB!!!") == "ica ab"
    assert bs._signature("  x   y  ") == "x y"


def test_prepare_prompt_data_and_payload_defaults() -> None:
    groceries_id = UUID(int=1)
    tx_a = UUID(int=2)
    tx_b = UUID(int=3)
    request = ImportCategorySuggestRequest(
        categories=[
            ImportCategoryOption(id=groceries_id, name="Groceries", category_type="expense")
        ],
        history=[ImportCategoryHistoryItem(description="ICA", category_id=groceries_id)],
        transactions=[
            ImportCategorySuggestTransaction(id=tx_a, description="ICA #123", amount="-10"),
            ImportCategorySuggestTransaction(id=tx_b, description="ICA #456", amount="-20"),
        ],
    )

    prompt_data, category_by_id, signature_to_ids, rep_id_to_signature = bs._prepare_prompt_data(
        request
    )
    assert list(category_by_id.keys()) == [groceries_id]
    assert len(prompt_data["transactions"]) == 1  # deduplicated by signature
    assert len(signature_to_ids) == 1
    assert rep_id_to_signature[tx_a] in signature_to_ids

    model_id, payload = bs._build_bedrock_payload(prompt_data, request)
    assert model_id == bs.BEDROCK_MODEL_ID_DEFAULT
    assert payload["tool_choice"]["name"] == "categorize_transactions"


def test_parse_suggestions_clamps_and_expands_duplicates() -> None:
    groceries_id = UUID(int=1)
    tx_a = UUID(int=2)
    tx_b = UUID(int=3)
    parsed_json = {
        "suggestions": [
            {
                "id": str(tx_a),
                "category_id": str(groceries_id),
                "confidence": 5,
                "reason": "x" * 300,
            }
        ]
    }
    suggestions = bs._parse_suggestions(
        parsed_json=parsed_json,
        category_by_id={groceries_id: object()},
        signature_to_ids={"ica": [tx_a, tx_b]},
        rep_id_to_signature={tx_a: "ica"},
    )
    assert len(suggestions) == 2
    assert suggestions[0].category_id == groceries_id
    assert suggestions[0].confidence == 0.99
    assert suggestions[0].reason is not None
    assert len(suggestions[0].reason) == 220


def test_connections_table_helpers(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(bs._CONNECTIONS_TABLE_ENV, raising=False)
    assert bs._get_connections_table() is None

    fake_table = SimpleNamespace()
    fake_table.put_calls = []
    fake_table.delete_calls = []
    fake_table.query_response = {"Items": []}

    def put_item(**kwargs):
        fake_table.put_calls.append(kwargs)

    def delete_item(**kwargs):
        fake_table.delete_calls.append(kwargs)

    def query(**_kwargs):
        return fake_table.query_response

    fake_table.put_item = put_item
    fake_table.delete_item = delete_item
    fake_table.query = query
    monkeypatch.setenv(bs._CONNECTIONS_TABLE_ENV, "connections")
    monkeypatch.setattr(
        bs.boto3,
        "resource",
        lambda _name: SimpleNamespace(Table=lambda _table_name: fake_table),
    )

    assert bs._store_connection(
        connection_id="c1",
        client_id="client",
        client_token="token",
        endpoint="https://endpoint",
    )
    assert fake_table.put_calls

    bs._remove_connection("c1")
    assert fake_table.delete_calls

    fake_table.query_response = {
        "Items": [{"connection_id": "c1", "endpoint": "https://e", "client_token": "token"}]
    }
    found = bs._fetch_connection_by_client(UUID(int=1))
    assert found is not None
    assert found.connection_id == "c1"

    fake_table.query_response = {"Items": [{"connection_id": "c1", "endpoint": "https://e"}]}
    assert bs._fetch_connection_by_client(UUID(int=1)) is None


def test_post_to_connection_handles_gone_exception(monkeypatch: pytest.MonkeyPatch) -> None:
    removed: list[str] = []

    def _remove_connection(connection_id: str) -> None:
        removed.append(connection_id)

    monkeypatch.setattr(bs, "_remove_connection", _remove_connection)

    class _ApiClient:
        def post_to_connection(self, **_kwargs):
            raise ClientError(
                {"Error": {"Code": "GoneException", "Message": "gone"}}, "PostToConnection"
            )

    monkeypatch.setattr(bs.boto3, "client", lambda *_args, **_kwargs: _ApiClient())
    connection = bs.SuggestionConnection("conn-1", "https://api", "token")
    bs._post_to_connection(connection, {"type": "x"})
    assert removed == ["conn-1"]


def test_send_to_client_respects_token(monkeypatch: pytest.MonkeyPatch) -> None:
    sent = {"count": 0}
    connection = bs.SuggestionConnection("conn-1", "https://api", "token-1")
    monkeypatch.setattr(bs, "_fetch_connection_by_client", lambda _client_id: connection)
    monkeypatch.setattr(
        bs, "_post_to_connection", lambda _conn, _payload: sent.__setitem__("count", 1)
    )

    bs._send_to_client(UUID(int=1), "wrong-token", {"x": 1})
    assert sent["count"] == 0

    bs._send_to_client(UUID(int=1), "token-1", {"x": 1})
    assert sent["count"] == 1


def test_suggest_with_bedrock_error_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    request = ImportCategorySuggestRequest(
        categories=[ImportCategoryOption(id=UUID(int=1), name="A", category_type="expense")],
        history=[],
        transactions=[ImportCategorySuggestTransaction(id=UUID(int=2), description="x")],
    )

    monkeypatch.setattr(bs, "_get_bedrock_client", lambda: None)
    with pytest.raises(bs.SuggestionError, match="Bedrock client unavailable"):
        bs._suggest_with_bedrock(request)

    class _ClientNoBody:
        def invoke_model(self, **_kwargs):
            return {}

    monkeypatch.setattr(bs, "_get_bedrock_client", _ClientNoBody)
    with pytest.raises(bs.SuggestionError, match="Empty Bedrock response"):
        bs._suggest_with_bedrock(request)

    class _ClientBadJson:
        def invoke_model(self, **_kwargs):
            body = {"stop_reason": "max_tokens", "output_text": "not json"}
            return {"body": SimpleNamespace(read=_json_body_reader(body))}

    monkeypatch.setattr(bs, "_get_bedrock_client", _ClientBadJson)
    with pytest.raises(bs.SuggestionError, match="truncated"):
        bs._suggest_with_bedrock(request)

    class _ClientNotJsonNoStop:
        def invoke_model(self, **_kwargs):
            body = {"stop_reason": "end_turn", "output_text": "not json"}
            return {"body": SimpleNamespace(read=_json_body_reader(body))}

    monkeypatch.setattr(bs, "_get_bedrock_client", _ClientNotJsonNoStop)
    with pytest.raises(bs.SuggestionError, match="not valid JSON"):
        bs._suggest_with_bedrock(request)


def test_bedrock_helper_additional_branch_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    assert (
        bs._parse_suggestions(
            parsed_json={"suggestions": "bad"},
            category_by_id={},
            signature_to_ids={},
            rep_id_to_signature={},
        )
        == []
    )

    parsed = {
        "suggestions": [
            "bad-item",
            {"id": 123},
            {"id": "not-uuid"},
            {"id": str(UUID(int=2)), "category_id": "bad", "confidence": "bad"},
            {"id": str(UUID(int=3)), "category_id": str(UUID(int=9)), "confidence": 0.4},
            {"id": str(UUID(int=4)), "category_id": None, "confidence": {"not": "numeric"}},
        ]
    }
    out = bs._parse_suggestions(
        parsed_json=parsed,
        category_by_id={UUID(int=1): object()},
        signature_to_ids={},
        rep_id_to_signature={},
    )
    assert len(out) == 3
    assert all(item.category_id is None for item in out)
    assert all(item.confidence >= 0 for item in out)

    monkeypatch.delenv(bs._CONNECTIONS_TABLE_ENV, raising=False)
    assert (
        bs._store_connection(
            connection_id="c1",
            client_id="cid",
            client_token="ctok",
            endpoint="https://e",
        )
        is False
    )
    bs._remove_connection("c1")
    assert bs._fetch_connection_by_client(UUID(int=1)) is None
    bs._send_to_client(UUID(int=1), "tok", {"x": 1})

    class _TableWithNoItems:
        def query(self, **_kwargs):
            return {}

    monkeypatch.setattr(bs, "_get_connections_table", lambda: _TableWithNoItems())
    assert bs._fetch_connection_by_client(UUID(int=2)) is None

    assert bs._extract_stop_reason({"stop_reason": 123}) is None
    assert bs._extract_stop_reason(["x"]) is None
    assert bs._extract_tool_input(parsed=[], tool_name="categorize_transactions") is None
    assert (
        bs._extract_tool_input(
            parsed={"content": [1, {"type": "tool_use", "name": "x"}]},
            tool_name="categorize_transactions",
        )
        is None
    )
    assert (
        bs._extract_tool_input(
            parsed={
                "content": [
                    {
                        "type": "tool_use",
                        "name": "categorize_transactions",
                        "input": "not-json",
                    }
                ]
            },
            tool_name="categorize_transactions",
        )
        is None
    )
    assert (
        bs._extract_tool_input(
            parsed={
                "content": [
                    {
                        "type": "tool_use",
                        "name": "categorize_transactions",
                        "input": 123,
                    }
                ]
            },
            tool_name="categorize_transactions",
        )
        is None
    )
    assert bs._extract_output_text(["not-a-dict"]) == ""
    assert bs._extract_output_text({"content": ["bad", {"text": ""}]}) == ""
    assert bs._extract_json('prefix {"ok": true} suffix') == {"ok": True}
    assert bs._extract_json("prefix {not-json} and [1,2] suffix") == [1, 2]

    def _raise_client(*_args, **_kwargs):
        raise ClientError({"Error": {"Code": "X", "Message": "boom"}}, "CreateClient")

    monkeypatch.setattr(bs.boto3, "client", _raise_client)
    assert bs._get_bedrock_client() is None


def _json_body_reader(body: dict[str, str]):
    def _read() -> bytes:
        return json.dumps(body).encode("utf-8")

    return _read
