from __future__ import annotations

import base64
from datetime import datetime
from io import BytesIO

import openpyxl

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def build_seb_workbook_base64(
    *, description: str, amount: str, when: datetime | None = None
) -> str:
    date_value = (when or datetime.utcnow()).date().isoformat()
    workbook = openpyxl.Workbook()
    worksheet = workbook.active
    worksheet.append(
        [
            "Bokförd",
            "Valutadatum",
            "Text",
            "Typ",
            "Saldo",
            "Insättningar/Uttag",
        ]
    )
    worksheet.append([date_value, date_value, description, "Card", 0, amount])

    buffer = BytesIO()
    workbook.save(buffer)
    return base64.b64encode(buffer.getvalue()).decode("utf-8")
