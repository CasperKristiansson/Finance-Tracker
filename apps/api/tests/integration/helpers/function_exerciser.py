from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable
from urllib.parse import urlparse
from uuid import UUID, uuid4

from .cleanup import CleanupRegistry
from .import_fixtures import XLSX_CONTENT_TYPE, build_seb_workbook_base64

# pylint: disable=broad-exception-caught,protected-access


ApiCall = Callable[[str, str, dict | None], dict]
JsonBody = Callable[[dict], dict]
InvokeLambda = Callable[[str, dict], dict]
LambdaName = Callable[[str], str]


@dataclass
class IntegrationExerciseContext:
    api_call: ApiCall
    json_body: JsonBody
    invoke_lambda: InvokeLambda
    lambda_name: LambdaName
    run_namespace: str
    api_base_url: str
    cleanup_registry: CleanupRegistry

    def _assert_status(self, response: dict, expected: int, *, message: str) -> None:
        actual = int(response.get("statusCode", -1))
        assert (
            actual == expected
        ), f"{message}: expected {expected}, got {actual}, body={response.get('body')}"

    def _json_or_empty(self, response: dict) -> dict:
        body = response.get("body")
        if isinstance(body, dict):
            return body
        if isinstance(body, str) and body.strip():
            return json.loads(body)
        return {}

    def assert_status(self, response: dict, expected: int, *, message: str) -> None:
        self._assert_status(response, expected, message=message)

    def json_or_empty(self, response: dict) -> dict:
        return self._json_or_empty(response)

    def unique(self, prefix: str) -> str:
        return f"{prefix}-{self.run_namespace}-{uuid4().hex[:6]}"

    def call(self, method: str, path: str, payload: dict | None = None, *, expected: int) -> dict:
        response = self.api_call(method, path, payload)
        self._assert_status(response, expected, message=f"{method} {path}")
        return self._json_or_empty(response)

    def call_raw(self, method: str, path: str, payload: dict | None = None) -> dict:
        return self.api_call(method, path, payload)

    def invoke(self, function_name: str, event: dict, *, expected: int) -> dict:
        response = self.invoke_lambda(self.lambda_name(function_name), event)
        actual = int(response.get("statusCode", -1))
        assert actual == expected, (
            f"invoke {function_name}: expected {expected}, got {actual}, " f"payload={response}"
        )
        return response

    def invoke_raw(self, function_name: str, event: dict) -> dict:
        return self.invoke_lambda(self.lambda_name(function_name), event)

    def _safe_call(self, method: str, path: str, payload: dict | None = None) -> None:
        try:
            self.api_call(method, path, payload)
        except Exception:
            pass

    def create_account(
        self,
        *,
        account_type: str = "normal",
        bank_import_type: str | None = None,
        loan: dict | None = None,
    ) -> dict:
        payload: dict[str, object] = {
            "name": self.unique(account_type),
            "account_type": account_type,
            "is_active": True,
        }
        if bank_import_type is not None:
            payload["bank_import_type"] = bank_import_type
        if loan is not None:
            payload["loan"] = loan

        account = self.call("POST", "/accounts", payload, expected=201)
        account_id = account["id"]
        self.cleanup_registry.add(
            self._safe_call,
            "PATCH",
            f"/accounts/{account_id}",
            {"is_active": False, "name": f"cleanup-{self.run_namespace}"},
        )
        return account

    def create_category(self, *, category_type: str = "expense") -> dict:
        category = self.call(
            "POST",
            "/categories",
            {
                "name": self.unique("cat"),
                "category_type": category_type,
                "color_hex": "#2451a8",
                "icon": "wallet",
            },
            expected=201,
        )
        category_id = category["id"]
        self.cleanup_registry.add(
            self._safe_call,
            "PATCH",
            f"/categories/{category_id}",
            {"is_archived": True, "name": f"cleanup-{self.run_namespace}"},
        )
        return category

    def create_goal(self) -> dict:
        category = self.create_category(category_type="expense")
        account = self.create_account(account_type="normal")
        goal = self.call(
            "POST",
            "/goals",
            {
                "name": self.unique("goal"),
                "target_amount": "1000.00",
                "category_id": category["id"],
                "account_id": account["id"],
                "note": "integration",
            },
            expected=201,
        )
        self.cleanup_registry.add(self._safe_call, "DELETE", f"/goals/{goal['id']}", None)
        return goal

    def create_transfer(self, *, category_id: str | None = None) -> dict:
        source = self.create_account(account_type="normal")
        target = self.create_account(account_type="normal")
        occurred = datetime.now(timezone.utc).replace(microsecond=0)

        payload: dict[str, object] = {
            "occurred_at": occurred.isoformat(),
            "posted_at": occurred.isoformat(),
            "description": self.unique("transfer"),
            "legs": [
                {"account_id": source["id"], "amount": "-120.00"},
                {"account_id": target["id"], "amount": "120.00"},
            ],
        }
        if category_id is not None:
            payload["category_id"] = category_id

        transaction = self.call("POST", "/transactions", payload, expected=201)
        self.cleanup_registry.add(
            self._safe_call,
            "DELETE",
            f"/transactions/{transaction['id']}",
            None,
        )

        return {
            "source": source,
            "target": target,
            "transaction": transaction,
            "occurred": occurred,
        }

    def create_loan(self) -> dict:
        loan_payload = {
            "origin_principal": "10000.00",
            "current_principal": "10000.00",
            "interest_rate_annual": "0.035",
            "interest_compound": "monthly",
            "minimum_payment": "500.00",
        }
        account = self.create_account(
            account_type="debt",
            loan=loan_payload,
        )
        return {"account": account, "loan": account.get("loan") or loan_payload}

    def create_tax_event(self) -> dict:
        account = self.create_account(account_type="normal")
        occurred = datetime.now(timezone.utc).replace(microsecond=0)
        event = self.call(
            "POST",
            "/tax/events",
            {
                "account_id": account["id"],
                "occurred_at": occurred.isoformat(),
                "posted_at": occurred.isoformat(),
                "amount": "345.00",
                "event_type": "payment",
                "description": self.unique("tax"),
                "authority": "Skatteverket",
            },
            expected=201,
        )
        return {"account": account, "tax_event": event, "occurred": occurred}

    def create_import_preview(self) -> dict:
        account = self.create_account(account_type="normal", bank_import_type="seb")
        workbook_b64 = build_seb_workbook_base64(
            description=self.unique("import"),
            amount="100.00",
            when=datetime.now(timezone.utc),
        )
        preview = self.call(
            "POST",
            "/imports/preview",
            {
                "files": [
                    {
                        "filename": f"{self.unique('import')}.xlsx",
                        "content_base64": workbook_b64,
                        "account_id": account["id"],
                    }
                ],
                "note": self.unique("note"),
            },
            expected=200,
        )

        assert preview["files"], "preview response should include files"
        assert preview["rows"], "preview response should include rows"
        return {"account": account, "preview": preview, "workbook_b64": workbook_b64}

    def commit_import(self, *, include_files: bool) -> dict:
        data = self.create_import_preview()
        preview = data["preview"]
        row = preview["rows"][0]
        preview_file = preview["files"][0]

        payload: dict[str, object] = {
            "import_batch_id": preview["import_batch_id"],
            "note": self.unique("commit"),
            "rows": [
                {
                    "id": row["id"],
                    "file_id": row["file_id"],
                    "account_id": row["account_id"],
                    "occurred_at": row["occurred_at"],
                    "amount": row["amount"],
                    "description": row["description"],
                    "category_id": row.get("suggested_category_id"),
                    "transfer_account_id": None,
                    "tax_event_type": None,
                    "delete": False,
                }
            ],
        }

        if include_files:
            payload["files"] = [
                {
                    "id": preview_file["id"],
                    "filename": preview_file["filename"],
                    "account_id": preview_file["account_id"],
                    "row_count": preview_file["row_count"],
                    "error_count": preview_file["error_count"],
                    "bank_import_type": "seb",
                    "content_base64": data["workbook_b64"],
                    "content_type": XLSX_CONTENT_TYPE,
                }
            ]

        commit = self.call("POST", "/imports/commit", payload, expected=200)
        assert commit["transaction_ids"], "commit should create transactions"
        return {"preview": preview, "commit": commit, "data": data}

    def _ws_context(self, connection_id: str) -> dict:
        parsed = urlparse(self.api_base_url)
        stage_from_url = parsed.path.strip("/").split("/")[0] if parsed.path.strip("/") else ""
        stage = stage_from_url or os.getenv("INTEGRATION_STAGE") or os.getenv("ENV") or "default"
        return {
            "connectionId": connection_id,
            "domainName": parsed.netloc,
            "stage": stage,
        }

    def ws_connect(self, *, client_id: UUID, client_token: str, connection_id: str) -> dict:
        return self.invoke(
            "importSuggestionsConnect",
            {
                "queryStringParameters": {
                    "client_id": str(client_id),
                    "token": client_token,
                },
                "requestContext": self._ws_context(connection_id),
            },
            expected=200,
        )

    def ws_disconnect(self, *, connection_id: str) -> dict:
        return self.invoke(
            "importSuggestionsDisconnect",
            {
                "requestContext": self._ws_context(connection_id),
            },
            expected=200,
        )


__all__ = ["IntegrationExerciseContext"]
