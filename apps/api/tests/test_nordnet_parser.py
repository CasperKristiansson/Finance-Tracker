from __future__ import annotations

from decimal import Decimal, InvalidOperation

import pytest

from apps.api.services.nordnet_parser import NordnetPreParser

# pylint: disable=protected-access


def test_parse_requires_raw_text() -> None:
    parser = NordnetPreParser()
    with pytest.raises(ValueError, match="raw_text is required"):
        parser.parse("   ")


def test_parse_routes_to_portfolio_and_transactions(monkeypatch: pytest.MonkeyPatch) -> None:
    parser = NordnetPreParser()
    monkeypatch.setattr(parser, "_parse_portfolio_report", lambda _text: {"kind": "portfolio"})
    monkeypatch.setattr(parser, "_parse_transactions", lambda _text: {"kind": "transactions"})

    assert parser.parse("Portföljrapport Innehav") == {"kind": "portfolio"}
    assert parser.parse("Kontoutdrag transaktion") == {"kind": "transactions"}
    assert parser.parse("Unknown content") == {"kind": "portfolio"}


def test_parse_portfolio_report_extracts_core_fields() -> None:
    parser = NordnetPreParser()
    raw = "\n".join(
        [
            "Portföljrapport",
            "2026-01-15",
            "Marknadsvärde total 200 SEK",
            "Innehav",
            "Apple Inc",
            "100 SEK",
            "90",
            "2",
            "200 SEK",
            "10 SEK",
            "50%",
        ]
    )
    payload = parser.parse(raw)

    assert payload["report_type"] == "portfolio_report"
    assert payload["snapshot_date"] == "2026-01-15"
    assert payload["portfolio_value"] == Decimal("200")
    assert payload["holdings"][0]["name"] == "Apple Inc"
    assert payload["holdings"][0]["allocation_pct"] == 50.0


def test_parse_transactions_extracts_rows() -> None:
    parser = NordnetPreParser()
    raw = "\n".join(
        [
            "Transaktioner",
            "2026-02-01",
            "Investeringssparkonto",
            "Köp",
            "Bolag AB",
            "10",
            "100 SEK",
            "2026-02-03",
            "Investeringssparkonto",
            "Utdelning",
            "Bolag AB",
            "20 SEK",
        ]
    )

    payload = parser.parse(raw)
    assert payload["report_type"] == "transactions"
    assert payload["snapshot_date"] == "2026-02-03"
    assert len(payload["rows"]) == 2
    assert payload["rows"][0]["transaction_type"] == "Köp"
    assert payload["rows"][0]["quantity"] == Decimal("10")


def test_split_sections_extracts_known_headings() -> None:
    parser = NordnetPreParser()
    sections = parser._split_sections(
        [
            "Resultat",
            "",
            "line 1",
            "Innehav",
            "holding line",
            "Fördelning",
            "allocation line",
        ]
    )
    assert sections["resultat"] == ["line 1"]
    assert sections["innehav"] == ["holding line"]
    assert sections["fördelning"] == ["allocation line"]


def test_date_and_decimal_helpers() -> None:
    parser = NordnetPreParser()
    assert parser._parse_date("date 2026-01-10") is not None
    assert parser._parse_date("bad date") is None
    assert parser._extract_latest_date(["2026-01-01", "2026-01-05"]) is not None
    assert parser._extract_latest_date(["x", "y"]) is None

    assert parser._parse_decimal("1 234,50") == Decimal("1234.50")
    assert parser._parse_decimal("−15,2") == Decimal("-15.2")
    assert parser._parse_decimal("no-number") is None
    assert parser._parse_percent("12,5%") == 12.5
    assert parser._parse_percent("") is None

    money, currency = parser._parse_money("123,45 SEK")
    assert money == Decimal("123.45")
    assert currency == "SEK"
    assert parser._parse_money("")[0] is None


def test_name_detection_and_holding_builder() -> None:
    parser = NordnetPreParser()
    assert parser._looks_like_name("Apple Inc")
    assert not parser._looks_like_name("100 SEK")
    assert not parser._looks_like_name("Fördelning")
    assert not parser._looks_like_name("12%")
    assert not parser._looks_like_name("")

    built = parser._build_holding(
        "Apple Inc",
        ["100 SEK", "90", "2", "200 SEK", "10 SEK", "50%"],
    )
    assert built is not None
    assert built["market_price"] == Decimal("100")
    assert built["average_price"] == Decimal("90")
    assert built["quantity"] == Decimal("2")
    assert built["market_value_sek"] == Decimal("200")
    assert built["unrealized_result"] == Decimal("10")
    assert built["currency"] == "SEK"

    assert parser._build_holding("Empty", []) is None


def test_number_and_line_search_helpers() -> None:
    parser = NordnetPreParser()
    lines = ["foo", "marknadsvärde 300", "bar", "100 SEK"]

    assert parser._find_number_after_keywords(lines, {"marknadsvärde"}) == Decimal("300")
    assert parser._find_number_after_keywords(lines, {"missing"}) is None

    sections = {"resultat": ["x", "500"], "innehav": ["line"]}
    assert parser._find_number_in_section(sections, {"resultat"}) == Decimal("500")
    assert parser._find_number_in_section(sections, {"risk"}) is None

    amount_line, idx = parser._find_amount_line(lines, start=0)
    assert amount_line == "100 SEK"
    assert idx == 3
    assert parser._find_amount_line(["x"], start=0) == (None, None)

    quantity = parser._parse_quantity_between(["x", "10", "100 SEK"], 0, 2)
    assert quantity == Decimal("10")
    assert parser._parse_quantity_between(["x"], 0, None) is None
    assert parser._next_nonempty(["", "", "abc"], 0) == "abc"
    assert parser._next_nonempty(["", ""], 0) is None


def test_parse_holdings_ignores_lines_until_innehav() -> None:
    parser = NordnetPreParser()
    holdings = parser._parse_holdings(
        [
            "Portföljrapport",
            "Foo",
            "Innehav",
            "Fund A",
            "10 SEK",
        ]
    )
    assert len(holdings) == 1
    assert holdings[0]["name"] == "Fund A"


def test_nordnet_parser_additional_edge_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    parser = NordnetPreParser()
    assert parser._parse_date("2026-13-40") is None
    assert parser._parse_decimal(None) is None

    holdings = parser._parse_holdings(
        [
            "Innehav",
            "",
            "Fund A",
            "10 SEK",
            "Fund B",
            "20 SEK",
        ]
    )
    assert len(holdings) == 2

    assert parser._find_number_after_keywords(["marknadsvärde x"], {"marknadsvärde"}) is None

    def _raise_decimal(_value):
        raise InvalidOperation()

    monkeypatch.setattr("apps.api.services.nordnet_parser.Decimal", _raise_decimal)
    assert parser._parse_decimal("123") is None


def test_parse_holdings_branch_paths_for_missing_records(monkeypatch: pytest.MonkeyPatch) -> None:
    parser = NordnetPreParser()

    monkeypatch.setattr(parser, "_build_holding", lambda *_args, **_kwargs: None)
    holdings = parser._parse_holdings(["Innehav", "Fund A", "10 SEK", "Fund B", "20 SEK"])
    assert holdings == []

    no_name_holdings = parser._parse_holdings(["Innehav", "10 SEK", "20 SEK"])
    assert no_name_holdings == []
