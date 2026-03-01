from __future__ import annotations

from pathlib import Path

import pytest

from apps.api.tests.integration.coverage_checker import (
    load_integration_test_declarations,
    load_serverless_function_catalog,
    validate_function_coverage,
)


def test_integration_function_coverage() -> None:
    repo_root = Path(__file__).resolve().parents[3]
    integration_root = Path(__file__).resolve().parent / "integration"

    catalog = load_serverless_function_catalog(repo_root)
    declarations = load_integration_test_declarations(integration_root)

    errors = validate_function_coverage(catalog, declarations)
    if errors:
        pytest.fail("\n".join(errors))
