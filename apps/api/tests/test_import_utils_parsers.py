from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from openpyxl import Workbook

from apps.api.services.imports.parsers.circle_k_mastercard import parse_circle_k_mastercard
from apps.api.services.imports.parsers.seb import parse_seb
from apps.api.services.imports.parsers.swedbank import parse_swedbank
from apps.api.services.imports.suggestions import RuleMatch, suggest_categories
from apps.api.services.imports.transfers import match_transfers
from apps.api.services.imports.utils import (
    clean_header,
    clean_value,
    is_date_like,
    is_decimal,
    parse_decimal_value,
    parse_iso_date,
    safe_decimal,
)


def _sheet(rows: list[list[object]]):
    wb = Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    return ws


def _parse_date(value: str):
    if value in {"bad", ""}:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def test_import_utils_branch_coverage() -> None:
    assert parse_iso_date("") is None
    assert parse_iso_date("bad") is None
    assert parse_iso_date("2024-01-01T10:00:00Z") == datetime(2024, 1, 1, 10, 0, 0)

    assert clean_header(None) == ""
    assert clean_header("  My Header ") == "my_header"
    assert clean_value(None) == ""
    assert clean_value(3.5) == "3.5"
    assert clean_value("  x ") == "x"

    assert parse_decimal_value(None) is None
    assert parse_decimal_value(Decimal("1.25")) == Decimal("1.25")
    assert parse_decimal_value(5) == Decimal("5")
    assert parse_decimal_value("  ") is None
    assert parse_decimal_value("abc") is None
    assert parse_decimal_value("1,234.50") == Decimal("1234.50")
    assert parse_decimal_value("1.234,50") == Decimal("1234.50")
    assert parse_decimal_value("−1 234,50") == Decimal("-1234.50")

    assert is_decimal("x") is False
    assert is_decimal("10.5") is True
    assert safe_decimal(object()) is None
    assert safe_decimal("3.4") == Decimal("3.4")
    assert is_date_like("") is False
    assert is_date_like("bad-date") is False
    assert is_date_like("2024-01-01T10:00:00") is True


def test_import_parsers_cover_error_and_fallback_paths() -> None:
    circle_rows, circle_errors = parse_circle_k_mastercard(
        _sheet(
            [
                ["preamble"],
                ["Datum", "Bokfört", "Specifikation", "Ort", "Valuta", "Utl. belopp", "Belopp"],
                ["datum", None, None, None, None, None, None],
                ["bad", "", "Desc", "", "", "", "10"],
                ["2024-01-02T00:00:00", "", "Desc", "City", "", "", ""],
                ["2024-01-03T00:00:00", "", "Desc", "", "", "", "not-an-amount"],
                ["2024-01-04T00:00:00", "", "Desc", "", "", "", "12.5"],
            ]
        ),
        parse_date=_parse_date,
    )
    assert circle_rows and circle_rows[-1]["amount"] == "-12.5"
    assert circle_errors

    seb_rows, seb_errors = parse_seb(
        _sheet(
            [
                ["Bokförd", "x", "Text", "Typ", "x", "Insättningar/uttag"],
                ["bad", "", "", "Fallback typ", "", "10"],
                ["2024-01-02T00:00:00", "", "", "Used as description", "", "11"],
                ["2024-01-03T00:00:00", "", "Text description", "", "", "bad"],
            ]
        ),
        parse_date=_parse_date,
    )
    assert seb_rows
    assert seb_rows[0]["description"] == "Used as description"
    assert seb_errors

    swed_rows, swed_errors = parse_swedbank(
        _sheet(
            [
                ["Bokföringsdag", "x", "x", "x", "Referens", "Beskrivning", "Belopp"],
                ["bad", "", "", "", "R", "D", "10"],
                ["2024-01-02T00:00:00", "", "", "", "R2", "", "11"],
                ["2024-01-03T00:00:00", "", "", "", "", "D3", "bad"],
            ]
        ),
        parse_date=_parse_date,
    )
    assert swed_rows and swed_rows[0]["description"] == "R2"
    assert swed_errors

    # Missing-header and blank-row branches.
    _rows, header_errors = parse_circle_k_mastercard(_sheet([["x"]]), parse_date=_parse_date)
    assert header_errors

    _rows, seb_missing_header = parse_seb(
        _sheet([["x"], [""], [None]]),
        parse_date=_parse_date,
    )
    assert seb_missing_header

    seb_blank_row_rows, _seb_blank_row_errors = parse_seb(
        _sheet(
            [
                ["Bokförd", "x", "Text", "Typ", "x", "Insättningar/uttag"],
                ["", "", "", "", "", ""],
                ["2024-01-05T00:00:00", "", "Valid", "", "", "5"],
            ]
        ),
        parse_date=_parse_date,
    )
    assert len(seb_blank_row_rows) == 1

    swed_rows_blank, _swed_errors_blank = parse_swedbank(
        _sheet(
            [
                ["Bokföringsdag", "x", "x", "x", "Referens", "Beskrivning", "Belopp"],
                ["", "", "", "", "", "", ""],
            ]
        ),
        parse_date=_parse_date,
    )
    assert swed_rows_blank == []


def test_detect_transfers_branch_paths() -> None:
    assert match_transfers(rows=[{"amount": "10"}], column_map={"date": "date"}) == {}

    rows = [
        {"amount": "bad", "date": "2024-01-01"},
        {"amount": "10", "date": "2024-01-01"},
        {"amount": "-10", "date": "2024-01-10"},
        {"amount": "-10", "date": "2024-01-02"},
    ]
    matches = match_transfers(
        rows=rows,
        column_map={"amount": "amount", "date": "date"},
    )
    assert 1 in matches
    assert 3 in matches
    assert 2 not in matches

    no_date_matches = match_transfers(
        rows=[
            {"amount": "15", "date": ""},
            {"amount": "-15", "date": "2024-01-20"},
        ],
        column_map={"amount": "amount", "date": "date"},
    )
    assert no_date_matches[0]["paired_with"] == 2


def test_suggest_categories_rule_match_without_category_name() -> None:
    suggestions = suggest_categories(
        rows=[{"description": "monthly rent", "amount": "-100"}],
        column_map={"description": "description", "amount": "amount"},
        rule_matches={
            0: RuleMatch(
                rule_id=None,  # type: ignore[arg-type]
                category_id=None,
                category_name=None,
                summary="rule",
                score=1.0,
                rule_type="category",
            )
        },
    )
    assert 0 in suggestions
    assert suggestions[0].confidence == 0.65
