from __future__ import annotations

COVERS_SERVERLESS_FUNCTION = "listLoanPortfolioSeries"
COVERS_EVENT_TYPE = "httpApi"
COVERS_HTTP_METHOD = "GET"
COVERS_HTTP_PATH = "/loans/events/series"
COVERS_ROUTE = None


def test_listLoanPortfolioSeries_integration(integration_context) -> None:
    context = integration_context
    context.create_loan()
    body = context.call("GET", "/loans/events/series", None, expected=200)
    assert "series" in body
