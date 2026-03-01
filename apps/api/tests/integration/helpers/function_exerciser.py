from __future__ import annotations

import json
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
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


def _exercise_database_backup(context: IntegrationExerciseContext) -> None:
    response = context.invoke("databaseBackup", {}, expected=200)
    body = context._json_or_empty(response)
    assert body.get("manifest_key"), "database backup should return manifest key"
    assert isinstance(body.get("tables"), list), "database backup should return tables"


def _exercise_run_transactions_backup(context: IntegrationExerciseContext) -> None:
    body = context.call("POST", "/backups/transactions", {}, expected=200)
    assert body.get("manifest_key"), "transactions backup should return manifest key"


def _exercise_warm_database(context: IntegrationExerciseContext) -> None:
    body = context.call("GET", "/warmup", None, expected=200)
    assert body.get("status") in {"ready", "starting"}


def _exercise_list_accounts(context: IntegrationExerciseContext) -> None:
    created = context.create_account()
    body = context.call("GET", "/accounts", None, expected=200)
    account_ids = {account["id"] for account in body.get("accounts", [])}
    assert created["id"] in account_ids


def _exercise_create_account(context: IntegrationExerciseContext) -> None:
    account = context.create_account()
    assert account["id"]


def _exercise_update_account(context: IntegrationExerciseContext) -> None:
    account = context.create_account()
    body = context.call(
        "PATCH",
        f"/accounts/{account['id']}",
        {"name": context.unique("updated"), "is_active": False},
        expected=200,
    )
    assert body["is_active"] is False


def _exercise_reconcile_account(context: IntegrationExerciseContext) -> None:
    account = context.create_account()
    captured = datetime.now(timezone.utc).replace(microsecond=0)
    body = context.call(
        "POST",
        f"/accounts/{account['id']}/reconcile",
        {
            "captured_at": captured.isoformat(),
            "reported_balance": "150.00",
            "description": context.unique("reconcile"),
        },
        expected=201,
    )
    assert body.get("transaction_id")


def _exercise_preview_imports(context: IntegrationExerciseContext) -> None:
    data = context.create_import_preview()
    preview = data["preview"]
    assert preview["import_batch_id"]


def _exercise_commit_imports(context: IntegrationExerciseContext) -> None:
    data = context.commit_import(include_files=False)
    assert data["commit"]["import_batch_id"]


def _exercise_list_import_drafts(context: IntegrationExerciseContext) -> None:
    preview = context.create_import_preview()["preview"]
    body = context.call("GET", "/imports/drafts", None, expected=200)
    batch_ids = {draft["import_batch_id"] for draft in body.get("drafts", [])}
    assert preview["import_batch_id"] in batch_ids


def _exercise_get_import_draft(context: IntegrationExerciseContext) -> None:
    preview = context.create_import_preview()["preview"]
    body = context.call("GET", f"/imports/{preview['import_batch_id']}", None, expected=200)
    assert body["import_batch_id"] == preview["import_batch_id"]


def _exercise_save_import_draft(context: IntegrationExerciseContext) -> None:
    preview = context.create_import_preview()["preview"]
    row = preview["rows"][0]
    body = context.call(
        "POST",
        f"/imports/{preview['import_batch_id']}/draft",
        {
            "rows": [
                {
                    "id": row["id"],
                    "file_id": row["file_id"],
                    "account_id": row["account_id"],
                    "occurred_at": row["occurred_at"],
                    "amount": row["amount"],
                    "description": f"{row['description']} updated",
                    "category_id": row.get("suggested_category_id"),
                    "transfer_account_id": None,
                    "tax_event_type": None,
                    "delete": False,
                }
            ]
        },
        expected=200,
    )
    assert body["import_batch_id"] == preview["import_batch_id"]


def _exercise_list_import_files(context: IntegrationExerciseContext) -> None:
    data = context.commit_import(include_files=True)
    preview_file = data["preview"]["files"][0]
    body = context.call("GET", "/import-files", None, expected=200)
    file_ids = {item["id"] for item in body.get("files", [])}
    assert preview_file["id"] in file_ids


def _exercise_download_import_file(context: IntegrationExerciseContext) -> None:
    data = context.commit_import(include_files=True)
    preview_file = data["preview"]["files"][0]
    body = context.call(
        "POST",
        "/import-files/download",
        {"file_id": preview_file["id"]},
        expected=200,
    )
    assert body.get("url")


def _exercise_suggest_import_categories(context: IntegrationExerciseContext) -> None:
    category = context.create_category()
    payload = {
        "categories": [
            {
                "id": category["id"],
                "name": category["name"],
                "category_type": category["category_type"],
            }
        ],
        "history": [{"description": "Coffee", "category_id": category["id"]}],
        "transactions": [
            {
                "id": str(uuid4()),
                "description": "Coffee shop",
                "amount": "45.00",
                "occurred_at": datetime.now(timezone.utc).isoformat(),
            }
        ],
    }
    body = context.call("POST", "/imports/suggest-categories", payload, expected=200)
    assert "suggestions" in body


def _exercise_import_suggestions_connect(context: IntegrationExerciseContext) -> None:
    client_id = uuid4()
    token = f"token-{uuid4().hex}"
    connection_id = f"{context.run_namespace}-connect"
    context.ws_connect(client_id=client_id, client_token=token, connection_id=connection_id)
    context.ws_disconnect(connection_id=connection_id)


def _exercise_import_suggestions_disconnect(context: IntegrationExerciseContext) -> None:
    client_id = uuid4()
    token = f"token-{uuid4().hex}"
    connection_id = f"{context.run_namespace}-disconnect"
    context.ws_connect(client_id=client_id, client_token=token, connection_id=connection_id)
    context.ws_disconnect(connection_id=connection_id)


def _exercise_suggest_import_categories_job(context: IntegrationExerciseContext) -> None:
    client_id = uuid4()
    token = f"token-{uuid4().hex}"
    connection_id = f"{context.run_namespace}-job"
    context.ws_connect(client_id=client_id, client_token=token, connection_id=connection_id)
    context.cleanup_registry.add(context.ws_disconnect, connection_id=connection_id)

    category = context.create_category()
    body = context.call(
        "POST",
        "/imports/suggest-categories/jobs",
        {
            "client_id": str(client_id),
            "client_token": token,
            "categories": [
                {
                    "id": category["id"],
                    "name": category["name"],
                    "category_type": category["category_type"],
                }
            ],
            "history": [],
            "transactions": [
                {
                    "id": str(uuid4()),
                    "description": "Queued suggestion",
                    "amount": "20.00",
                    "occurred_at": datetime.now(timezone.utc).isoformat(),
                }
            ],
        },
        expected=202,
    )
    assert body.get("job_id")


def _exercise_import_suggestions_worker(context: IntegrationExerciseContext) -> None:
    event = {
        "Records": [
            {
                "body": json.dumps(
                    {
                        "client_id": str(uuid4()),
                        "client_token": f"token-{uuid4().hex}",
                        "categories": [],
                        "history": [],
                        "transactions": [
                            {
                                "id": str(uuid4()),
                                "description": "Worker payload",
                                "amount": "1.00",
                                "occurred_at": datetime.now(timezone.utc).isoformat(),
                            }
                        ],
                    }
                )
            }
        ]
    }
    response = context.invoke_raw("importSuggestionsWorker", event)
    assert response.get("batchItemFailures") == []


def _exercise_get_settings(context: IntegrationExerciseContext) -> None:
    body = context.call("GET", "/settings", None, expected=200)
    assert set(body.get("settings", {}).keys()) == {"first_name", "last_name"}


def _exercise_save_settings(context: IntegrationExerciseContext) -> None:
    body = context.call(
        "PUT",
        "/settings",
        {"settings": {"first_name": "Ada", "last_name": "Lovelace"}},
        expected=200,
    )
    assert body.get("settings", {}).get("first_name") == "Ada"


def _exercise_list_categories(context: IntegrationExerciseContext) -> None:
    category = context.create_category()
    body = context.call("GET", "/categories", None, expected=200)
    ids = {item["id"] for item in body.get("categories", [])}
    assert category["id"] in ids


def _exercise_create_category(context: IntegrationExerciseContext) -> None:
    category = context.create_category()
    assert category["id"]


def _exercise_update_category(context: IntegrationExerciseContext) -> None:
    category = context.create_category()
    updated_name = context.unique("updated-cat")
    body = context.call(
        "PATCH",
        f"/categories/{category['id']}",
        {"name": updated_name, "is_archived": True, "color_hex": "#123123"},
        expected=200,
    )
    assert body["name"] == updated_name


def _exercise_merge_categories(context: IntegrationExerciseContext) -> None:
    source = context.create_category()
    target = context.create_category()
    merged_name = context.unique("merged")
    body = context.call(
        "POST",
        "/categories/merge",
        {
            "source_category_id": source["id"],
            "target_category_id": target["id"],
            "rename_target_to": merged_name,
        },
        expected=200,
    )
    assert body["id"] == target["id"]


def _exercise_list_goals(context: IntegrationExerciseContext) -> None:
    goal = context.create_goal()
    body = context.call("GET", "/goals", None, expected=200)
    goal_ids = {item["id"] for item in body.get("goals", [])}
    assert goal["id"] in goal_ids


def _exercise_create_goal(context: IntegrationExerciseContext) -> None:
    goal = context.create_goal()
    assert goal["id"]


def _exercise_update_goal(context: IntegrationExerciseContext) -> None:
    goal = context.create_goal()
    body = context.call(
        "PATCH",
        f"/goals/{goal['id']}",
        {"target_amount": "1500.00", "note": context.unique("goal-note")},
        expected=200,
    )
    assert Decimal(body["target_amount"]) == Decimal("1500.00")


def _exercise_delete_goal(context: IntegrationExerciseContext) -> None:
    goal = context.create_goal()
    response = context.call_raw("DELETE", f"/goals/{goal['id']}", None)
    context._assert_status(response, 204, message="DELETE goal")


def _exercise_list_transactions(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    source_id = data["source"]["id"]
    target_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/transactions?account_ids={source_id},{target_id}",
        None,
        expected=200,
    )
    assert body.get("transactions")


def _exercise_create_transaction(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    assert data["transaction"]["id"]


def _exercise_update_transaction(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    transaction_id = data["transaction"]["id"]
    description = context.unique("updated-tx")
    body = context.call(
        "PATCH",
        f"/transactions/{transaction_id}",
        {"description": description},
        expected=200,
    )
    assert body["description"] == description


def _exercise_delete_transaction(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    transaction_id = data["transaction"]["id"]
    response = context.call_raw("DELETE", f"/transactions/{transaction_id}", None)
    context._assert_status(response, 204, message="DELETE transaction")


def _exercise_list_tax_events(context: IntegrationExerciseContext) -> None:
    context.create_tax_event()
    body = context.call("GET", "/tax/events", None, expected=200)
    assert isinstance(body.get("events"), list)


def _exercise_create_tax_event(context: IntegrationExerciseContext) -> None:
    tax_event = context.create_tax_event()["tax_event"]
    assert tax_event.get("tax_event", {}).get("id")


def _exercise_tax_summary(context: IntegrationExerciseContext) -> None:
    data = context.create_tax_event()
    year = data["occurred"].year
    body = context.call("GET", f"/tax/summary?year={year}", None, expected=200)
    assert body.get("year") == year


def _exercise_tax_total_summary(context: IntegrationExerciseContext) -> None:
    context.create_tax_event()
    body = context.call("GET", "/tax/summary/total", None, expected=200)
    assert "totals" in body


def _exercise_create_loan(context: IntegrationExerciseContext) -> None:
    data = context.create_loan()
    account_id = data["account"]["id"]
    response = context.call_raw(
        "POST",
        "/loans",
        {
            "account_id": account_id,
            "origin_principal": "9000.00",
            "current_principal": "9000.00",
            "interest_rate_annual": "0.031",
            "interest_compound": "monthly",
            "minimum_payment": "400.00",
        },
    )
    context._assert_status(response, 400, message="POST /loans")
    body = context._json_or_empty(response)
    assert "already has a linked loan" in str(body.get("error", "")).lower()


def _exercise_update_loan(context: IntegrationExerciseContext) -> None:
    data = context.create_loan()
    account_id = data["account"]["id"]
    body = context.call(
        "PATCH",
        f"/loans/{account_id}",
        {"interest_rate_annual": "0.04", "minimum_payment": "650.00"},
        expected=200,
    )
    assert Decimal(body["interest_rate_annual"]) == Decimal("0.04")


def _exercise_list_loan_events(context: IntegrationExerciseContext) -> None:
    data = context.create_loan()
    account_id = data["account"]["id"]
    body = context.call("GET", f"/loans/{account_id}/events", None, expected=200)
    assert "events" in body


def _exercise_list_loan_portfolio_series(context: IntegrationExerciseContext) -> None:
    context.create_loan()
    body = context.call("GET", "/loans/events/series", None, expected=200)
    assert "series" in body


def _exercise_get_loan_schedule(context: IntegrationExerciseContext) -> None:
    data = context.create_loan()
    account_id = data["account"]["id"]
    body = context.call("GET", f"/loans/{account_id}/schedule", None, expected=200)
    assert "schedule" in body


def _exercise_monthly_report(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    year = data["occurred"].year
    account_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/monthly?account_ids={account_id}&year={year}",
        None,
        expected=200,
    )
    assert isinstance(body.get("results"), list)


def _exercise_yearly_report(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    account_id = data["target"]["id"]
    body = context.call("GET", f"/reports/yearly?account_ids={account_id}", None, expected=200)
    assert isinstance(body.get("results"), list)


def _exercise_yearly_overview(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    year = data["occurred"].year
    account_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/yearly-overview?account_ids={account_id}&year={year}",
        None,
        expected=200,
    )
    assert body.get("stats")


def _exercise_yearly_category_detail(context: IntegrationExerciseContext) -> None:
    category = context.create_category(category_type="expense")
    data = context.create_transfer(category_id=category["id"])
    year = data["occurred"].year
    account_id = data["source"]["id"]
    body = context.call(
        "GET",
        (
            f"/reports/yearly-category-detail?year={year}&category_id={category['id']}"
            f"&flow=expense&account_ids={account_id}"
        ),
        None,
        expected=200,
    )
    assert "monthly" in body


def _exercise_quarterly_report(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    account_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/quarterly?account_ids={account_id}",
        None,
        expected=200,
    )
    assert isinstance(body.get("results"), list)


def _exercise_date_range_report(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    account_id = data["target"]["id"]
    occurred = data["occurred"]
    start = (occurred - timedelta(days=1)).date().isoformat()
    end = (occurred + timedelta(days=1)).date().isoformat()
    body = context.call(
        "GET",
        f"/reports/custom?account_ids={account_id}&start_date={start}&end_date={end}",
        None,
        expected=200,
    )
    assert isinstance(body.get("results"), list)


def _exercise_total_report(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    source_id = data["source"]["id"]
    target_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/total?account_ids={source_id},{target_id}",
        None,
        expected=200,
    )
    assert "net" in body


def _exercise_total_overview(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    account_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/total-overview?account_ids={account_id}",
        None,
        expected=200,
    )
    assert body.get("kpis")


def _exercise_net_worth_history(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    source_id = data["source"]["id"]
    target_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/net-worth?account_ids={source_id},{target_id}",
        None,
        expected=200,
    )
    assert isinstance(body.get("points"), list)


def _exercise_cashflow_forecast(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    account_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/forecast/cashflow?account_ids={account_id}",
        None,
        expected=200,
    )
    assert body.get("points") or body.get("forecasts")


def _exercise_net_worth_projection(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    account_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/forecast/net-worth?account_ids={account_id}",
        None,
        expected=200,
    )
    assert body.get("points") or body.get("forecasts")


def _exercise_export_report(context: IntegrationExerciseContext) -> None:
    data = context.create_transfer()
    source_id = data["source"]["id"]
    target_id = data["target"]["id"]
    year = data["occurred"].year
    body = context.call(
        "POST",
        "/reports/export",
        {
            "account_ids": [source_id, target_id],
            "start_date": f"{year}-01-01T00:00:00Z",
            "end_date": f"{year}-12-31T00:00:00Z",
            "granularity": "monthly",
            "format": "csv",
            "year": year,
        },
        expected=200,
    )
    assert body.get("data_base64")


def _exercise_list_investment_transactions(context: IntegrationExerciseContext) -> None:
    body = context.call("GET", "/investments/transactions", None, expected=200)
    assert "transactions" in body


def _exercise_investment_overview(context: IntegrationExerciseContext) -> None:
    body = context.call("GET", "/investments/overview", None, expected=200)
    assert "portfolio" in body


def _exercise_create_investment_snapshot(context: IntegrationExerciseContext) -> None:
    account = context.create_account(account_type="investment")
    snapshot_date = datetime.now(timezone.utc).date().isoformat()
    body = context.call(
        "POST",
        "/investments/snapshots",
        {
            "account_id": account["id"],
            "snapshot_date": snapshot_date,
            "balance": "25000.00",
            "notes": context.unique("snapshot"),
        },
        expected=201,
    )
    assert body.get("snapshot_id")


_SCENARIOS: dict[str, Callable[[IntegrationExerciseContext], None]] = {
    "databaseBackup": _exercise_database_backup,
    "runTransactionsBackup": _exercise_run_transactions_backup,
    "warmDatabase": _exercise_warm_database,
    "listAccounts": _exercise_list_accounts,
    "createAccount": _exercise_create_account,
    "updateAccount": _exercise_update_account,
    "reconcileAccount": _exercise_reconcile_account,
    "previewImports": _exercise_preview_imports,
    "commitImports": _exercise_commit_imports,
    "listImportDrafts": _exercise_list_import_drafts,
    "getImportDraft": _exercise_get_import_draft,
    "saveImportDraft": _exercise_save_import_draft,
    "listImportFiles": _exercise_list_import_files,
    "downloadImportFile": _exercise_download_import_file,
    "suggestImportCategories": _exercise_suggest_import_categories,
    "importSuggestionsConnect": _exercise_import_suggestions_connect,
    "importSuggestionsDisconnect": _exercise_import_suggestions_disconnect,
    "suggestImportCategoriesJob": _exercise_suggest_import_categories_job,
    "importSuggestionsWorker": _exercise_import_suggestions_worker,
    "getSettings": _exercise_get_settings,
    "saveSettings": _exercise_save_settings,
    "listCategories": _exercise_list_categories,
    "createCategory": _exercise_create_category,
    "updateCategory": _exercise_update_category,
    "mergeCategories": _exercise_merge_categories,
    "listGoals": _exercise_list_goals,
    "createGoal": _exercise_create_goal,
    "updateGoal": _exercise_update_goal,
    "deleteGoal": _exercise_delete_goal,
    "listTransactions": _exercise_list_transactions,
    "createTransaction": _exercise_create_transaction,
    "updateTransaction": _exercise_update_transaction,
    "deleteTransaction": _exercise_delete_transaction,
    "listTaxEvents": _exercise_list_tax_events,
    "createTaxEvent": _exercise_create_tax_event,
    "taxSummary": _exercise_tax_summary,
    "taxTotalSummary": _exercise_tax_total_summary,
    "createLoan": _exercise_create_loan,
    "updateLoan": _exercise_update_loan,
    "listLoanEvents": _exercise_list_loan_events,
    "listLoanPortfolioSeries": _exercise_list_loan_portfolio_series,
    "getLoanSchedule": _exercise_get_loan_schedule,
    "monthlyReport": _exercise_monthly_report,
    "yearlyReport": _exercise_yearly_report,
    "yearlyOverview": _exercise_yearly_overview,
    "yearlyCategoryDetail": _exercise_yearly_category_detail,
    "quarterlyReport": _exercise_quarterly_report,
    "dateRangeReport": _exercise_date_range_report,
    "totalReport": _exercise_total_report,
    "totalOverview": _exercise_total_overview,
    "netWorthHistory": _exercise_net_worth_history,
    "cashflowForecast": _exercise_cashflow_forecast,
    "netWorthProjection": _exercise_net_worth_projection,
    "exportReport": _exercise_export_report,
    "listInvestmentTransactions": _exercise_list_investment_transactions,
    "investmentOverview": _exercise_investment_overview,
    "createInvestmentSnapshot": _exercise_create_investment_snapshot,
}


def exercise_serverless_function(
    function_name: str,
    *,
    api_call: ApiCall,
    json_body: JsonBody,
    invoke_lambda: InvokeLambda,
    lambda_name: LambdaName,
    run_namespace: str,
    api_base_url: str,
    cleanup_registry: CleanupRegistry,
) -> None:
    scenario = _SCENARIOS.get(function_name)
    assert scenario is not None, f"No scenario registered for function: {function_name}"

    context = IntegrationExerciseContext(
        api_call=api_call,
        json_body=json_body,
        invoke_lambda=invoke_lambda,
        lambda_name=lambda_name,
        run_namespace=run_namespace,
        api_base_url=api_base_url,
        cleanup_registry=cleanup_registry,
    )
    scenario(context)
