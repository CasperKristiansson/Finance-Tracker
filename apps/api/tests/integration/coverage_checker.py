from __future__ import annotations

import ast
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Literal

EventType = Literal["httpApi", "websocket", "sqs", "schedule"]


@dataclass(frozen=True)
class FunctionSpec:
    function_name: str
    event_type: EventType
    http_method: str | None
    http_path: str | None
    route: str | None
    source_file: str


@dataclass(frozen=True)
class TestDeclaration:
    file_path: Path
    function_name: str | None
    event_type: str | None
    http_method: str | None
    http_path: str | None
    route: str | None
    parse_errors: tuple[str, ...] = ()


_FUNCTION_LINE_RE = re.compile(r"^\s{2}([A-Za-z][A-Za-z0-9_]*)\s*:\s*$")
_EVENT_LINE_RE = re.compile(r"^\s*-\s*(httpApi|websocket|sqs|schedule)\s*:\s*$")
_PATH_LINE_RE = re.compile(r"^\s*path\s*:\s*(\S+)\s*$")
_METHOD_LINE_RE = re.compile(r"^\s*method\s*:\s*([A-Za-z]+)\s*$")
_ROUTE_LINE_RE = re.compile(r"^\s*route\s*:\s*(\S+)\s*$")
_TEST_FILE_RE = re.compile(r"^test_([A-Za-z][A-Za-z0-9_]*)_integration\.py$")

_REQUIRED_CONSTANTS = (
    "COVERS_SERVERLESS_FUNCTION",
    "COVERS_EVENT_TYPE",
    "COVERS_HTTP_METHOD",
    "COVERS_HTTP_PATH",
    "COVERS_ROUTE",
)


def _find_manifest_files(repo_root: Path) -> list[Path]:
    names = {"serverless.yml", "service.yml", "service.yaml"}
    manifests: list[Path] = []
    for path in repo_root.rglob("*"):
        if path.is_file() and path.name in names:
            manifests.append(path)
    return sorted(manifests)


def _parse_manifest_functions(path: Path) -> dict[str, FunctionSpec]:
    lines = path.read_text(encoding="utf-8").splitlines()
    in_functions = False
    current_function: str | None = None
    catalog: dict[str, FunctionSpec] = {}

    index = 0
    while index < len(lines):
        line = lines[index]

        if not in_functions:
            if line.strip() == "functions:":
                in_functions = True
            index += 1
            continue

        function_match = _FUNCTION_LINE_RE.match(line)
        if function_match:
            current_function = function_match.group(1)
            index += 1
            continue

        event_match = _EVENT_LINE_RE.match(line)
        if current_function and event_match and current_function not in catalog:
            event_type = event_match.group(1)
            method: str | None = None
            event_path: str | None = None
            route: str | None = None

            lookahead = index + 1
            while lookahead < len(lines):
                next_line = lines[lookahead]
                if _FUNCTION_LINE_RE.match(next_line):
                    break
                if _EVENT_LINE_RE.match(next_line):
                    break
                path_match = _PATH_LINE_RE.match(next_line)
                if path_match:
                    event_path = path_match.group(1)
                method_match = _METHOD_LINE_RE.match(next_line)
                if method_match:
                    method = method_match.group(1).upper()
                route_match = _ROUTE_LINE_RE.match(next_line)
                if route_match:
                    route = route_match.group(1)
                lookahead += 1

            catalog[current_function] = FunctionSpec(
                function_name=current_function,
                event_type=event_type,  # type: ignore[arg-type]
                http_method=method if event_type == "httpApi" else None,
                http_path=event_path if event_type == "httpApi" else None,
                route=route if event_type == "websocket" else None,
                source_file=str(path),
            )
        index += 1

    return catalog


def load_serverless_function_catalog(repo_root: Path | None = None) -> dict[str, FunctionSpec]:
    root = repo_root or Path(__file__).resolve().parents[4]
    manifests = _find_manifest_files(root)
    catalog: dict[str, FunctionSpec] = {}

    for manifest in manifests:
        parsed = _parse_manifest_functions(manifest)
        for function_name, spec in parsed.items():
            if function_name in catalog:
                existing = catalog[function_name]
                raise ValueError(
                    "Duplicate serverless function name "
                    f"{function_name!r} in {existing.source_file} and {spec.source_file}"
                )
            catalog[function_name] = spec

    return catalog


def _extract_constant_values(tree: ast.AST) -> dict[str, str | None]:
    values: dict[str, str | None] = {}

    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.Assign):
            if len(node.targets) != 1 or not isinstance(node.targets[0], ast.Name):
                continue
            key = node.targets[0].id
            if key not in _REQUIRED_CONSTANTS:
                continue
            if isinstance(node.value, ast.Constant) and isinstance(
                node.value.value, (str, type(None))
            ):
                values[key] = node.value.value
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            key = node.target.id
            if key not in _REQUIRED_CONSTANTS:
                continue
            if isinstance(node.value, ast.Constant) and isinstance(
                node.value.value, (str, type(None))
            ):
                values[key] = node.value.value

    return values


def _iter_test_files(integration_root: Path) -> Iterable[Path]:
    functions_dir = integration_root / "functions"
    if not functions_dir.exists():
        return []
    return sorted(functions_dir.glob("test_*_integration.py"))


def load_integration_test_declarations(
    integration_root: Path | None = None,
) -> list[TestDeclaration]:
    root = integration_root or Path(__file__).resolve().parent
    declarations: list[TestDeclaration] = []

    for file_path in _iter_test_files(root):
        errors: list[str] = []
        filename_match = _TEST_FILE_RE.match(file_path.name)
        expected_from_filename = filename_match.group(1) if filename_match else None
        if expected_from_filename is None:
            errors.append("File name must match test_<functionName>_integration.py")

        source = file_path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(file_path))
        constant_values = _extract_constant_values(tree)

        for constant in _REQUIRED_CONSTANTS:
            if constant not in constant_values:
                errors.append(f"Missing required constant: {constant}")

        declaration = TestDeclaration(
            file_path=file_path,
            function_name=constant_values.get("COVERS_SERVERLESS_FUNCTION"),
            event_type=constant_values.get("COVERS_EVENT_TYPE"),
            http_method=constant_values.get("COVERS_HTTP_METHOD"),
            http_path=constant_values.get("COVERS_HTTP_PATH"),
            route=constant_values.get("COVERS_ROUTE"),
            parse_errors=tuple(errors),
        )
        declarations.append(declaration)

    return declarations


def validate_function_coverage(
    catalog: dict[str, FunctionSpec],
    declarations: list[TestDeclaration],
) -> list[str]:
    errors: list[str] = []
    by_function: dict[str, list[TestDeclaration]] = {}

    for declaration in declarations:
        for parse_error in declaration.parse_errors:
            errors.append(f"{declaration.file_path}: {parse_error}")

        function_name = declaration.function_name
        if not function_name:
            continue

        by_function.setdefault(function_name, []).append(declaration)

        if function_name not in catalog:
            errors.append(f"{declaration.file_path}: unknown serverless function {function_name!r}")
            continue

        expected_file_name = f"test_{function_name}_integration.py"
        if declaration.file_path.name != expected_file_name:
            errors.append(
                f"{declaration.file_path}: expected file name {expected_file_name} "
                f"for function {function_name}"
            )

        spec = catalog[function_name]
        declared_event_type = declaration.event_type
        if declared_event_type != spec.event_type:
            errors.append(
                f"{declaration.file_path}: COVERS_EVENT_TYPE={declared_event_type!r} "
                f"does not match manifest event type {spec.event_type!r}"
            )

        if spec.event_type == "httpApi":
            if declaration.http_method != spec.http_method:
                errors.append(
                    f"{declaration.file_path}: COVERS_HTTP_METHOD={declaration.http_method!r} "
                    f"does not match {spec.http_method!r}"
                )
            if declaration.http_path != spec.http_path:
                errors.append(
                    f"{declaration.file_path}: COVERS_HTTP_PATH={declaration.http_path!r} "
                    f"does not match {spec.http_path!r}"
                )
        elif spec.event_type == "websocket":
            if declaration.route != spec.route:
                errors.append(
                    f"{declaration.file_path}: COVERS_ROUTE={declaration.route!r} "
                    f"does not match {spec.route!r}"
                )

    for function_name, specs in by_function.items():
        if len(specs) > 1:
            duplicate_files = ", ".join(str(spec.file_path) for spec in specs)
            errors.append(
                f"Function {function_name!r} declared in multiple files: {duplicate_files}"
            )

    declared_functions = set(by_function.keys())
    missing_functions = sorted(set(catalog.keys()) - declared_functions)
    if missing_functions:
        errors.append(
            "Missing integration test declarations for serverless functions: "
            + ", ".join(missing_functions)
        )

    return errors


__all__ = [
    "FunctionSpec",
    "TestDeclaration",
    "load_serverless_function_catalog",
    "load_integration_test_declarations",
    "validate_function_coverage",
]
