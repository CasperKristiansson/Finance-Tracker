from __future__ import annotations

from decimal import Decimal

COVERS_SERVERLESS_FUNCTION = "taxSummary"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/tax/summary"
COVERS_ROUTE = None


def test_taxSummary_integration(integration_context) -> None:
    context = integration_context
    data = context.create_tax_event()
    year = data["occurred"].year
    body = context.call("GET", f"/tax/summary?year={year}", None, expected=200)
    assert body.get("year") == year


def test_taxSummary_totals_increase_after_payment_event(integration_context) -> None:
    context = integration_context
    year = context.create_tax_event()["occurred"].year
    before = context.call("GET", f"/tax/summary?year={year}", None, expected=200)
    before_ytd = Decimal(str(before["totals"]["net_tax_paid_ytd"]))

    context.create_tax_event()
    after = context.call("GET", f"/tax/summary?year={year}", None, expected=200)
    after_ytd = Decimal(str(after["totals"]["net_tax_paid_ytd"]))

    assert after_ytd > before_ytd
