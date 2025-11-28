from __future__ import annotations

import base64
from datetime import datetime
from typing import List
from uuid import UUID

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


def _make_file_payload(filename: str = "import.xlsx", amount: str = "100.00") -> dict:
    b64_content = _build_seb_workbook(
        rows=[(datetime(2025, 1, 5).date().isoformat(), "Test Row", "Card", amount)]
    )
    return {
        "filename": filename,
        "content_base64": b64_content,
        "bank_type": "seb",
    }


def test_imports_flow(api_call, json_body) -> None:
    # Create batch with one file
    create_payload = {"files": [_make_file_payload()], "note": "integration"}
    create_resp = api_call("POST", "/imports", create_payload)
    assert create_resp["statusCode"] == 201
    create_body = json_body(create_resp)
    batch = create_body["imports"][0]
    batch_id = batch["id"]
    assert batch["file_count"] == 1
    assert batch["status"] in {"ready", "empty", "error"}

    # List batches should include the created batch
    list_resp = api_call("GET", "/imports")
    assert list_resp["statusCode"] == 200
    list_body = json_body(list_resp)
    assert any(UUID(item["id"]) == UUID(batch_id) for item in list_body["imports"])

    # Fetch session by id
    session_resp = api_call("GET", f"/imports/{batch_id}")
    assert session_resp["statusCode"] == 200
    session_body = json_body(session_resp)
    assert session_body["import_session"]["id"] == batch_id

    # Append another file to the session
    append_payload = {"files": [_make_file_payload(filename="append.xlsx", amount="50.00")]}
    append_resp = api_call("POST", f"/imports/{batch_id}/files", append_payload)
    assert append_resp["statusCode"] == 200

    # Commit the session with no overrides
    commit_resp = api_call("POST", f"/imports/{batch_id}/commit", {"rows": []})
    assert commit_resp["statusCode"] == 200
