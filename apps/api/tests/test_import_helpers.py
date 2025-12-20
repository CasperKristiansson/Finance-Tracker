from __future__ import annotations

import io
from decimal import Decimal
from uuid import uuid4

from openpyxl import Workbook

from apps.api.models import Subscription
from apps.api.services.imports.parsers import parse_bank_rows
from apps.api.services.imports.suggestions import (
    RuleMatch,
    suggest_categories,
    suggest_category_heuristic,
    suggest_subscriptions,
)
from apps.api.services.imports.transfers import match_transfers
from apps.api.shared import BankImportType


def _workbook_bytes(builder) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    builder(sheet)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def test_parse_bank_rows_requires_supported_extension():
    rows, errors = parse_bank_rows(
        filename="transactions.csv", content=b"not-used", bank_type=BankImportType.SWEDBANK
    )
    assert not rows
    assert errors and "unsupported file type" in errors[0][1].lower()


def test_parse_bank_rows_reports_missing_headers():
    content = _workbook_bytes(lambda sheet: sheet.append(["Only", "Two", "Columns"]))
    rows, errors = parse_bank_rows(
        filename="swedbank.xlsx",
        content=content,
        bank_type=BankImportType.SWEDBANK,
    )
    assert not rows
    assert any("missing" in message.lower() for _, message in errors)


def test_parse_circle_k_adds_location_and_negates_amounts():
    def build(sheet):
        sheet.append(["Transaktionsexport"])
        sheet.append([])
        sheet.append(
            ["Datum", "Bokfört", "Specifikation", "Ort", "Valuta", "Utl. belopp", "Belopp"]
        )
        sheet.append(["2024-02-01", "2024-02-02", "Groceries", "Stockholm", "SEK", "", "250"])

    rows, errors = parse_bank_rows(
        filename="circle.xlsx",
        content=_workbook_bytes(build),
        bank_type=BankImportType.CIRCLE_K_MASTERCARD,
    )
    assert not errors
    assert rows
    first = rows[0]
    assert "stockholm" in first["description"].lower()
    assert Decimal(first["amount"]) < 0


def test_category_suggestion_prefers_rule_match():
    rows = [{"description": "Rent for apartment", "amount": "1200"}]
    column_map = {"description": "description", "amount": "amount"}
    rule = RuleMatch(
        rule_id=uuid4(),
        category_id=uuid4(),
        category_name="Rent",
        subscription_id=None,
        subscription_name=None,
        summary="matched rent keyword",
        score=0.9,
        rule_type="category",
    )

    suggestions = suggest_categories(rows, column_map, {0: rule})
    assert suggestions[0].category == "Rent"
    assert suggestions[0].reason == "matched rent keyword"


def test_category_heuristic_maps_keywords():
    column_map = {"description": "description", "amount": "amount"}
    suggestion = suggest_category_heuristic(
        {"description": "Uber trip downtown", "amount": "-22.00"},
        column_map,
    )
    assert suggestion.category == "Transport"
    assert suggestion.confidence == 0.65


def test_suggest_subscriptions_uses_amount_tolerance():
    subscription = Subscription(
        name="Spotify",
        matcher_text="spotify",
        matcher_amount_tolerance=Decimal("1.00"),
        matcher_day_of_month=1,
    )
    rows = [{"description": "Spotify AB", "amount": "99.00", "date": "2024-03-01"}]
    column_map = {"description": "description", "amount": "amount", "date": "date"}

    suggestions = suggest_subscriptions(
        rows, column_map, [subscription], {subscription.id: Decimal("99.50")}
    )
    assert 0 in suggestions
    assert suggestions[0].subscription_name == "Spotify"

    high_delta_rows = [{"description": "Spotify AB", "amount": "120.00", "date": "2024-03-01"}]
    no_match = suggest_subscriptions(
        high_delta_rows, column_map, [subscription], {subscription.id: Decimal("99.50")}
    )
    assert not no_match


def test_suggest_subscriptions_respects_rule_lock():
    subscription = Subscription(
        name="Gym",
        matcher_text="gym",
        matcher_amount_tolerance=None,
        matcher_day_of_month=None,
    )
    column_map = {"description": "description", "amount": "amount", "date": "date"}
    rows = [{"description": "Gym monthly", "amount": "50.00", "date": "2024-02-01"}]
    rule = RuleMatch(
        rule_id=uuid4(),
        category_id=None,
        category_name=None,
        subscription_id=subscription.id,
        subscription_name="Gym",
        summary="rule hit",
        score=0.99,
        rule_type="subscription",
    )

    suggestions = suggest_subscriptions(rows, column_map, [subscription], {}, {0: rule})
    assert suggestions[0].subscription_id == subscription.id
    assert suggestions[0].reason == "rule hit"


def test_match_transfers_pairs_opposite_amounts_and_dates():
    rows = [
        {"amount": "100.00", "date": "2024-01-02"},
        {"amount": "-100.00", "date": "2024-01-01"},
    ]
    matches = match_transfers(rows, {"amount": "amount", "date": "date"})
    assert matches[0]["paired_with"] == 2
    assert matches[1]["paired_with"] == 1


def test_match_transfers_ignores_far_apart_dates():
    rows = [
        {"amount": "50.00", "date": "2024-01-01"},
        {"amount": "-50.00", "date": "2024-01-10"},
    ]
    matches = match_transfers(rows, {"amount": "amount", "date": "date"})
    assert not matches
