from __future__ import annotations

import base64
from datetime import datetime
from typing import List

import openpyxl


def _build_seb_workbook(rows: List[tuple[str, str, str, str]]) -> str:
    """Create a minimal SEB-style XLSX file and return base64-encoded bytes."""

    from io import BytesIO

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(
        [
            "Bokförd",
            "Valutadatum",
            "Text",
            "Typ",
            "Saldo",
            "Insättningar/Uttag",
        ]
    )
    for date_text, text, type_text, amount in rows:
        ws.append([date_text, date_text, text, type_text, 0, amount])
    buf = BytesIO()
    wb.save(buf)
    return base64.b64encode(buf.getvalue()).decode()


def test_imports_preview_and_commit_flow(api_call, json_body) -> None:
    account_payload = {"account_type": "normal", "bank_import_type": "seb", "is_active": True}
    account_resp = api_call("POST", "/accounts", account_payload)
    assert account_resp["statusCode"] in {200, 201}
    account = json_body(account_resp)
    account_id = account["id"]

    b64_content = _build_seb_workbook(
        rows=[(datetime(2025, 1, 5).date().isoformat(), "Test Row", "Card", "100.00")]
    )

    preview_resp = api_call(
        "POST",
        "/imports/preview",
        {
            "files": [
                {
                    "filename": "import.xlsx",
                    "content_base64": b64_content,
                    "account_id": account_id,
                }
            ],
            "note": "integration",
        },
    )
    assert preview_resp["statusCode"] == 200
    preview = json_body(preview_resp)
    assert preview["files"][0]["bank_import_type"] == "seb"
    assert preview["rows"]

    row = preview["rows"][0]
    commit_resp = api_call(
        "POST",
        "/imports/commit",
        {
            "note": "integration commit",
            "rows": [
                {
                    "id": row["id"],
                    "account_id": row["account_id"],
                    "occurred_at": row["occurred_at"],
                    "amount": row["amount"],
                    "description": row["description"],
                    "category_id": None,
                    "subscription_id": None,
                    "transfer_account_id": None,
                    "tax_event_type": None,
                    "delete": False,
                }
            ],
        },
    )
    assert commit_resp["statusCode"] == 200
    commit = json_body(commit_resp)
    assert commit["import_batch_id"]
    assert commit["transaction_ids"]
