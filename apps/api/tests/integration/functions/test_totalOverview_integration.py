from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

COVERS_SERVERLESS_FUNCTION = "totalOverview"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/reports/total-overview"
COVERS_ROUTE = None


def test_totalOverview_integration(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    account_id = data["target"]["id"]
    body = context.call(
        "GET",
        f"/reports/total-overview?account_ids={account_id}",
        None,
        expected=200,
    )
    assert body.get("kpis")


def test_report_totals_are_consistent_for_same_account_scope(integration_context) -> None:
    context = integration_context
    data = context.create_transfer()
    account_id = data["source"]["id"]
    occurred = data["occurred"]
    start = (occurred - timedelta(days=1)).date().isoformat()
    end = (occurred + timedelta(days=1)).date().isoformat()

    total = context.call("GET", f"/reports/total?account_ids={account_id}", None, expected=200)
    overview = context.call(
        "GET",
        f"/reports/total-overview?account_ids={account_id}",
        None,
        expected=200,
    )
    custom = context.call(
        "GET",
        f"/reports/custom?account_ids={account_id}&start_date={start}&end_date={end}",
        None,
        expected=200,
    )

    def dec(value: object) -> Decimal:
        return Decimal(str(value))

    custom_income = sum(dec(item["income"]) for item in custom.get("results", []))
    custom_expense = sum(dec(item["expense"]) for item in custom.get("results", []))
    custom_net = sum(dec(item["net"]) for item in custom.get("results", []))

    assert custom_income == dec(total["income"])
    assert custom_expense == dec(total["expense"])
    assert custom_net == dec(total["net"])

    kpis = overview["kpis"]
    assert dec(kpis["lifetime_income"]) == dec(total["income"])
    assert dec(kpis["lifetime_expense"]) == dec(total["expense"])
    assert dec(kpis["lifetime_saved"]) == dec(total["net"])
