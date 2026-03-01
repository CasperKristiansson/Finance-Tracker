from __future__ import annotations

from pathlib import Path
import sys

from apps.api.tests.integration.coverage_checker import (
    load_integration_test_declarations,
    load_serverless_function_catalog,
    validate_function_coverage,
)


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    integration_root = repo_root / "apps" / "api" / "tests" / "integration"

    try:
        catalog = load_serverless_function_catalog(repo_root)
        declarations = load_integration_test_declarations(integration_root)
        errors = validate_function_coverage(catalog, declarations)
    except Exception as exc:  # pylint: disable=broad-exception-caught
        print(f"[integration-coverage] Failed to evaluate coverage: {exc}", file=sys.stderr)
        return 2

    if errors:
        print("[integration-coverage] Missing or invalid integration declarations:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    print("[integration-coverage] OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
