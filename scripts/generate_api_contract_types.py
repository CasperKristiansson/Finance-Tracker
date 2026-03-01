#!/usr/bin/env python3
"""Generate frontend endpoint contracts and model types from backend schemas."""

from __future__ import annotations

import importlib
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
from pathlib import Path
from types import NoneType, UnionType
from typing import Annotated, Any, ForwardRef, Literal, Union, get_args, get_origin
from uuid import UUID

import yaml
from pydantic import BaseModel

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from apps.api.contracts.http import HTTP_HANDLER_CONTRACTS, HandlerHttpContract

SERVERLESS_PATH = ROOT / "infra" / "serverless" / "serverless.yml"
OUTPUT_ROOT = ROOT / "apps" / "web" / "src" / "types" / "generated" / "contracts"
HEADER = (
    "// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.\n"
    "// Run: python3 scripts/generate_api_contract_types.py\n\n"
)

IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
PATH_PARAM_PATTERN = re.compile(r"\{([^{}]+)\}")

PRIMITIVE_MAP: dict[Any, str] = {
    str: "string",
    int: "number",
    float: "number",
    bool: "boolean",
    Decimal: "string",
    date: "string",
    datetime: "string",
    time: "string",
    UUID: "string",
    bytes: "string",
    NoneType: "null",
}

ARRAY_ORIGINS = {list, set, frozenset}
DICT_ORIGINS = {dict}


@dataclass(frozen=True)
class EndpointSpec:
    function_name: str
    handler: str
    method: str
    path: str
    auth: bool
    contract: HandlerHttpContract


def split_words(value: str) -> list[str]:
    normalized = re.sub(r"[_\-]+", " ", value)
    normalized = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", normalized)
    normalized = re.sub(r"([A-Z])([A-Z][a-z])", r"\1 \2", normalized)
    return [word for word in normalized.split() if word]


def pascal_case(value: str) -> str:
    return "".join(word.capitalize() for word in split_words(value))


def discover_http_endpoints() -> list[EndpointSpec]:
    data = yaml.safe_load(SERVERLESS_PATH.read_text(encoding="utf-8"))
    functions = data.get("functions", {}) if isinstance(data, dict) else {}
    if not isinstance(functions, dict):
        return []

    endpoints: list[EndpointSpec] = []
    missing_contracts: list[str] = []
    for function_name, function_def in sorted(functions.items()):
        if not isinstance(function_def, dict):
            continue
        handler = function_def.get("handler")
        events = function_def.get("events")
        if not isinstance(handler, str) or not isinstance(events, list):
            continue

        for event in events:
            if not isinstance(event, dict):
                continue
            http = event.get("httpApi")
            if not isinstance(http, dict):
                continue
            method = str(http.get("method") or "").upper()
            path = str(http.get("path") or "")
            if not method or not path:
                continue
            contract = HTTP_HANDLER_CONTRACTS.get(handler)
            if contract is None:
                missing_contracts.append(handler)
                contract = HandlerHttpContract()
            endpoints.append(
                EndpointSpec(
                    function_name=function_name,
                    handler=handler,
                    method=method,
                    path=path,
                    auth=bool(http.get("authorizer")),
                    contract=contract,
                )
            )

    if missing_contracts:
        deduped = sorted(set(missing_contracts))
        joined = "\n".join(f"- {handler}" for handler in deduped)
        raise RuntimeError(
            "Missing handler contracts for the following HTTP handlers:\n"
            f"{joined}\n\nAdd them to apps/api/contracts/http.py."
        )

    unused_contracts = sorted(
        set(HTTP_HANDLER_CONTRACTS.keys()) - {endpoint.handler for endpoint in endpoints}
    )
    if unused_contracts:
        joined = "\n".join(f"- {handler}" for handler in unused_contracts)
        raise RuntimeError(
            "Found handler contracts not present in infra/serverless/serverless.yml:\n"
            f"{joined}\n\nRemove or fix stale entries in apps/api/contracts/http.py."
        )

    return endpoints


def resolve_forward_ref(ref: ForwardRef, module_name: str) -> Any:
    try:
        module = importlib.import_module(module_name)
        return eval(ref.__forward_arg__, vars(module))
    except Exception:  # pragma: no cover - defensive fallback
        return Any


def maybe_model(annotation: Any) -> type[BaseModel] | None:
    if isinstance(annotation, type) and issubclass(annotation, BaseModel):
        return annotation
    return None


def maybe_enum(annotation: Any) -> type[Enum] | None:
    if isinstance(annotation, type) and issubclass(annotation, Enum):
        return annotation
    return None


def collect_dependencies(
    annotation: Any,
    *,
    module_name: str,
    models: set[type[BaseModel]],
    enums: set[type[Enum]],
) -> None:
    if annotation is Any:
        return

    if isinstance(annotation, ForwardRef):
        resolved = resolve_forward_ref(annotation, module_name)
        collect_dependencies(
            resolved,
            module_name=module_name,
            models=models,
            enums=enums,
        )
        return

    enum_type = maybe_enum(annotation)
    if enum_type is not None:
        enums.add(enum_type)
        return

    model_type = maybe_model(annotation)
    if model_type is not None:
        if model_type in models:
            return
        model_type.model_rebuild(force=True)
        models.add(model_type)
        for field in model_type.model_fields.values():
            collect_dependencies(
                field.annotation,
                module_name=model_type.__module__,
                models=models,
                enums=enums,
            )
        return

    origin = get_origin(annotation)
    args = get_args(annotation)
    if origin is Annotated and args:
        collect_dependencies(
            args[0],
            module_name=module_name,
            models=models,
            enums=enums,
        )
        return

    for arg in args:
        collect_dependencies(
            arg,
            module_name=module_name,
            models=models,
            enums=enums,
        )


def render_literal(value: Any) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    escaped = str(value).replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


def dedupe_union(parts: list[str]) -> list[str]:
    seen: set[str] = set()
    output: list[str] = []
    for part in parts:
        if part in seen:
            continue
        output.append(part)
        seen.add(part)
    return output


def type_to_ts(annotation: Any, *, module_name: str, names: dict[Any, str]) -> str:
    if annotation is Any or annotation is object:
        return "JsonValue"

    if isinstance(annotation, ForwardRef):
        resolved = resolve_forward_ref(annotation, module_name)
        return type_to_ts(resolved, module_name=module_name, names=names)

    if annotation in PRIMITIVE_MAP:
        return PRIMITIVE_MAP[annotation]

    enum_type = maybe_enum(annotation)
    if enum_type is not None:
        return names[enum_type]

    model_type = maybe_model(annotation)
    if model_type is not None:
        return names[model_type]

    origin = get_origin(annotation)
    args = get_args(annotation)

    if origin is Annotated and args:
        return type_to_ts(args[0], module_name=module_name, names=names)

    if origin in {Union, UnionType}:
        parts = [
            type_to_ts(arg, module_name=module_name, names=names)
            for arg in args
            if arg is not NoneType
        ]
        if any(arg is NoneType for arg in args):
            parts.append("null")
        parts = dedupe_union(parts)
        return " | ".join(parts) if parts else "unknown"

    if origin is Literal:
        parts = [render_literal(value) for value in args]
        parts = dedupe_union(parts)
        return " | ".join(parts) if parts else "unknown"

    if origin in ARRAY_ORIGINS:
        inner = "JsonValue"
        if args:
            inner = type_to_ts(args[0], module_name=module_name, names=names)
        if " | " in inner:
            inner = f"({inner})"
        return f"{inner}[]"

    if origin in DICT_ORIGINS:
        value_type = "JsonValue"
        if len(args) >= 2:
            value_type = type_to_ts(args[1], module_name=module_name, names=names)
        return f"Record<string, {value_type}>"

    if origin is tuple:
        if len(args) == 2 and args[1] is Ellipsis:
            inner = type_to_ts(args[0], module_name=module_name, names=names)
            if " | " in inner:
                inner = f"({inner})"
            return f"{inner}[]"
        parts = [type_to_ts(arg, module_name=module_name, names=names) for arg in args]
        return f"[{', '.join(parts)}]" if parts else "JsonValue[]"

    if origin is not None and args:
        rendered = [type_to_ts(arg, module_name=module_name, names=names) for arg in args]
        if origin.__module__ == "typing":
            origin_name = getattr(origin, "__name__", str(origin))
            if origin_name in {"Sequence", "MutableSequence", "Collection", "Iterable"}:
                inner = rendered[0] if rendered else "JsonValue"
                if " | " in inner:
                    inner = f"({inner})"
                return f"{inner}[]"
            if origin_name in {"Mapping", "MutableMapping"}:
                value = rendered[1] if len(rendered) > 1 else "JsonValue"
                return f"Record<string, {value}>"

    return "unknown"


def assign_type_names(types: list[Any]) -> dict[Any, str]:
    by_base: dict[str, list[Any]] = {}
    for type_obj in types:
        by_base.setdefault(type_obj.__name__, []).append(type_obj)

    names: dict[Any, str] = {}
    taken: set[str] = set()
    for base, group in sorted(by_base.items()):
        if len(group) == 1:
            only = group[0]
            names[only] = base
            taken.add(base)
            continue

        for index, type_obj in enumerate(sorted(group, key=lambda item: item.__module__), start=1):
            module_parts = type_obj.__module__.split(".")
            tail_parts = module_parts[2:] if module_parts[:2] == ["apps", "api"] else module_parts
            prefix = "".join(pascal_case(part) for part in tail_parts)
            candidate = f"{prefix}{base}" if prefix else base
            if candidate in taken:
                candidate = f"{candidate}{index}"
            names[type_obj] = candidate
            taken.add(candidate)

    return names


def render_property_name(name: str) -> str:
    if IDENTIFIER.match(name):
        return name
    escaped = name.replace("\\", "\\\\").replace("'", "\\'")
    return f"'{escaped}'"


def render_models(models: list[type[BaseModel]], enums: list[type[Enum]], names: dict[Any, str]) -> str:
    lines = [
        "export type JsonPrimitive = string | number | boolean | null",
        "export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }",
        "",
    ]

    for enum_type in enums:
        values = [render_literal(item.value) for item in enum_type]
        union = " | ".join(dedupe_union(values)) if values else "unknown"
        lines.append(f"export type {names[enum_type]} = {union}")
        lines.append("")

    for model_type in models:
        lines.append(f"export interface {names[model_type]} {{")
        for field_name, field in model_type.model_fields.items():
            prop_name = field.alias or field_name
            optional = "" if field.is_required() else "?"
            ts_type = type_to_ts(
                field.annotation,
                module_name=model_type.__module__,
                names=names,
            )
            lines.append(f"  {render_property_name(prop_name)}{optional}: {ts_type}")
        lines.append("}")
        lines.append("")

    return HEADER + "\n".join(lines).rstrip() + "\n"


def infer_path_params(path: str) -> list[str]:
    return PATH_PARAM_PATTERN.findall(path)


def contract_model_ref(model: type[BaseModel] | None, names: dict[Any, str]) -> str:
    if model is None:
        return "void"
    return f"Models.{names[model]}"


def render_path_type(endpoint: EndpointSpec, names: dict[Any, str]) -> str:
    if endpoint.contract.path_model is not None:
        return contract_model_ref(endpoint.contract.path_model, names)
    params = infer_path_params(endpoint.path)
    if not params:
        return "void"
    props = "; ".join(f"{render_property_name(param)}: string" for param in params)
    return "{ " + props + " }"


def render_endpoint_helpers() -> str:
    lines = [
        "export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS'",
        "export type EndpointSpec<TRequest, TResponse, TQuery = void, TPath = void> = {",
        "  path: string",
        "  method: HttpMethod",
        "  handler: string",
        "  auth: boolean",
        "  __types?: {",
        "    request: TRequest",
        "    response: TResponse",
        "    query: TQuery",
        "    path: TPath",
        "  }",
        "}",
        "export const defineEndpoint = <TRequest, TResponse, TQuery = void, TPath = void>(",
        "  spec: Omit<EndpointSpec<TRequest, TResponse, TQuery, TPath>, '__types'>",
        ") => spec as EndpointSpec<TRequest, TResponse, TQuery, TPath>",
        "",
    ]
    return HEADER + "\n".join(lines)


def render_endpoints(endpoints: list[EndpointSpec], names: dict[Any, str]) -> str:
    lines = [
        "import type * as Models from './models'",
        "import { defineEndpoint } from './endpoint'",
        "",
    ]

    for endpoint in endpoints:
        base = pascal_case(endpoint.function_name)
        request_type = contract_model_ref(endpoint.contract.request_model, names)
        response_type = contract_model_ref(endpoint.contract.response_model, names)
        query_type = contract_model_ref(endpoint.contract.query_model, names)
        path_type = render_path_type(endpoint, names)
        lines.append(f"export type {base}Request = {request_type}")
        lines.append(f"export type {base}Response = {response_type}")
        lines.append(f"export type {base}Query = {query_type}")
        lines.append(f"export type {base}Path = {path_type}")
        lines.append("")

    lines.append("export const endpoints = {")
    for endpoint in endpoints:
        base = pascal_case(endpoint.function_name)
        lines.append(
            "  "
            + f"{endpoint.function_name}: defineEndpoint<{base}Request, {base}Response, {base}Query, {base}Path>({{"
        )
        lines.append(f"    path: '{endpoint.path}',")
        lines.append(f"    method: '{endpoint.method}',")
        lines.append(f"    handler: '{endpoint.handler}',")
        lines.append(f"    auth: {'true' if endpoint.auth else 'false'},")
        lines.append("  }),")
    lines.append("} as const")
    lines.append("")
    lines.append("export type EndpointMap = typeof endpoints")
    lines.append("export type EndpointName = keyof EndpointMap")
    lines.append("export type EndpointPath = EndpointMap[EndpointName]['path']")
    lines.append(
        "export type EndpointRequest<N extends EndpointName> = NonNullable<EndpointMap[N]['__types']>['request']"
    )
    lines.append(
        "export type EndpointResponse<N extends EndpointName> = NonNullable<EndpointMap[N]['__types']>['response']"
    )
    lines.append(
        "export type EndpointQuery<N extends EndpointName> = NonNullable<EndpointMap[N]['__types']>['query']"
    )
    lines.append(
        "export type EndpointPathParams<N extends EndpointName> = NonNullable<EndpointMap[N]['__types']>['path']"
    )
    lines.append("")
    return HEADER + "\n".join(lines)


def write_file(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> None:
    endpoints = discover_http_endpoints()
    endpoints.sort(key=lambda item: item.function_name)

    model_set: set[type[BaseModel]] = set()
    enum_set: set[type[Enum]] = set()
    for endpoint in endpoints:
        for model in (
            endpoint.contract.request_model,
            endpoint.contract.response_model,
            endpoint.contract.query_model,
            endpoint.contract.path_model,
        ):
            if model is None:
                continue
            collect_dependencies(
                model,
                module_name=model.__module__,
                models=model_set,
                enums=enum_set,
            )

    all_types = sorted(
        [*model_set, *enum_set],
        key=lambda item: (item.__module__, item.__name__),
    )
    names = assign_type_names(all_types)

    models = sorted(model_set, key=lambda item: names[item])
    enums = sorted(enum_set, key=lambda item: names[item])

    write_file(OUTPUT_ROOT / "models.ts", render_models(models, enums, names))
    write_file(OUTPUT_ROOT / "endpoint.ts", render_endpoint_helpers())
    write_file(OUTPUT_ROOT / "endpoints.ts", render_endpoints(endpoints, names))
    write_file(
        OUTPUT_ROOT / "index.ts",
        HEADER
        + "\n".join(
            [
                "export * from './models'",
                "export * from './endpoint'",
                "export * from './endpoints'",
                "",
            ]
        ),
    )


if __name__ == "__main__":
    main()
