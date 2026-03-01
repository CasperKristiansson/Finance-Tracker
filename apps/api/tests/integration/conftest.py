from __future__ import annotations

import base64
import json
import os
from collections.abc import Generator
from datetime import datetime, timezone
from typing import Callable, Literal, Sequence
from urllib import error, request
from uuid import uuid4

import boto3
import pytest

from apps.api.tests.integration.helpers import (
    CleanupRegistry,
    IntegrationExerciseContext,
)

# pylint: disable=redefined-outer-name,too-many-positional-arguments


ExplicitAuthFlow = Literal[
    "ADMIN_NO_SRP_AUTH",
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
    "ALLOW_CUSTOM_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "CUSTOM_AUTH_FLOW_ONLY",
    "USER_PASSWORD_AUTH",
]


@pytest.fixture
def json_body() -> Callable[[dict], dict]:
    def _inner(response: dict) -> dict:
        return json.loads(response["body"])

    return _inner


@pytest.fixture
def make_account_event() -> Callable[[str], dict]:
    def _inner(account_type: str = "normal") -> dict:
        payload = {
            "name": f"{account_type.title()} Account",
            "account_type": account_type,
            "is_active": True,
        }
        return {"body": payload}

    return _inner


@pytest.fixture
def make_transaction_event() -> Callable[[list[dict[str, str]], datetime], dict]:
    def _inner(legs: list[dict[str, str]], occurred: datetime) -> dict:
        payload = {
            "occurred_at": occurred.isoformat(),
            "posted_at": occurred.isoformat(),
            "legs": legs,
        }
        return {"body": payload}

    return _inner


@pytest.fixture(scope="session")
def lambda_client():
    region = os.getenv("AWS_REGION", "eu-north-1")
    profile = os.getenv("AWS_PROFILE", "Personal")
    session = boto3.Session(profile_name=profile)
    return session.client("lambda", region_name=region)


def _lambda_name(function: str) -> str:
    stage = os.getenv("INTEGRATION_STAGE") or os.getenv("ENV") or "default"
    service = os.getenv("INTEGRATION_SERVICE_NAME", "finance-tracker-api")
    return f"{service}-{stage}-{function}"


@pytest.fixture
def lambda_name() -> Callable[[str], str]:
    return _lambda_name


def _discover_api_base_url() -> str:
    explicit = os.getenv("INTEGRATION_API_BASE")
    if explicit:
        return explicit.rstrip("/")
    stack_name = os.getenv("INTEGRATION_STACK_NAME", "finance-tracker-api-default")
    profile = os.getenv("AWS_PROFILE", "Personal")
    region = os.getenv("AWS_REGION", "eu-north-1")
    session = boto3.Session(profile_name=profile)
    cf = session.client("cloudformation", region_name=region)
    stack = cf.describe_stacks(StackName=stack_name)["Stacks"][0]
    outputs = {o["OutputKey"]: o["OutputValue"] for o in stack.get("Outputs", [])}
    base = (
        outputs.get("HttpApiUrl")
        or outputs.get("ServiceEndpoint")
        or outputs.get("HttpApiEndpoint")
    )
    if not base:
        raise RuntimeError("Could not determine API base URL; set INTEGRATION_API_BASE")
    return base.rstrip("/")


@pytest.fixture(scope="session")
def api_base_url() -> str:
    return _discover_api_base_url()


def _get_cognito_params() -> tuple[str, str]:
    profile = os.getenv("AWS_PROFILE", "Personal")
    region = os.getenv("AWS_REGION", "eu-north-1")
    stage = os.getenv("INTEGRATION_STAGE") or os.getenv("ENV") or "default"
    session = boto3.Session(profile_name=profile)
    ssm = session.client("ssm", region_name=region)
    base = f"/finance-tracker/{stage}/auth"
    params = ssm.get_parameters(Names=[f"{base}/user_pool_id", f"{base}/user_pool_client_id"])[
        "Parameters"
    ]
    mapping = {p["Name"].split("/")[-1]: p["Value"] for p in params}
    return mapping["user_pool_id"], mapping["user_pool_client_id"]


def _ensure_test_user(
    user_pool_id: str,
    _client_id: str,
    *,
    username: str,
    password: str,
) -> tuple[str, str]:
    approval_attribute = os.getenv("INTEGRATION_APPROVAL_ATTRIBUTE", "custom:approved")
    approval_value = os.getenv("INTEGRATION_APPROVAL_VALUE", "true")
    profile = os.getenv("AWS_PROFILE", "Personal")
    region = os.getenv("AWS_REGION", "eu-north-1")
    session = boto3.Session(profile_name=profile)
    idp = session.client("cognito-idp", region_name=region)
    try:
        idp.admin_get_user(UserPoolId=user_pool_id, Username=username)
    except idp.exceptions.UserNotFoundException:
        idp.admin_create_user(
            UserPoolId=user_pool_id,
            Username=username,
            TemporaryPassword=password,
            MessageAction="SUPPRESS",
            UserAttributes=[
                {"Name": "email", "Value": username},
                {"Name": "email_verified", "Value": "true"},
            ],
        )
    # Ensure password is permanent
    idp.admin_set_user_password(
        UserPoolId=user_pool_id,
        Username=username,
        Password=password,
        Permanent=True,
    )
    # Pre-token lambda requires explicit user approval.
    idp.admin_update_user_attributes(
        UserPoolId=user_pool_id,
        Username=username,
        UserAttributes=[
            {"Name": "email_verified", "Value": "true"},
            {"Name": approval_attribute, "Value": approval_value},
        ],
    )
    return username, password


def _issue_auth_token(*, username: str, password: str) -> str:
    user_pool_id, client_id = _get_cognito_params()
    _ensure_test_user(user_pool_id, client_id, username=username, password=password)
    profile = os.getenv("AWS_PROFILE", "Personal")
    region = os.getenv("AWS_REGION", "eu-north-1")
    session = boto3.Session(profile_name=profile)
    idp = session.client("cognito-idp", region_name=region)
    desc = idp.describe_user_pool_client(UserPoolId=user_pool_id, ClientId=client_id)[
        "UserPoolClient"
    ]
    explicit_flows: Sequence[ExplicitAuthFlow] = desc.get("ExplicitAuthFlows") or []
    flows: set[ExplicitAuthFlow] = set(explicit_flows)
    required_flows: set[ExplicitAuthFlow] = {
        "ALLOW_ADMIN_USER_PASSWORD_AUTH",
        "ALLOW_REFRESH_TOKEN_AUTH",
        "ALLOW_USER_PASSWORD_AUTH",
    }
    if not required_flows.issubset(flows):
        updated_flows: list[ExplicitAuthFlow] = list(flows)
        updated_flows.extend(flow for flow in required_flows if flow not in flows)
        idp.update_user_pool_client(
            UserPoolId=user_pool_id,
            ClientId=client_id,
            ExplicitAuthFlows=updated_flows,
        )
    resp = idp.admin_initiate_auth(
        UserPoolId=user_pool_id,
        ClientId=client_id,
        AuthFlow="ADMIN_USER_PASSWORD_AUTH",
        AuthParameters={"USERNAME": username, "PASSWORD": password},
    )
    return resp["AuthenticationResult"]["IdToken"]


def _decode_jwt_claims(token: str) -> dict[str, str]:
    parts = token.split(".")
    if len(parts) < 2:
        return {}
    payload = parts[1]
    payload += "=" * (-len(payload) % 4)
    try:
        raw = base64.urlsafe_b64decode(payload.encode("utf-8")).decode("utf-8")
        parsed = json.loads(raw)
    except (ValueError, json.JSONDecodeError):
        return {}
    if not isinstance(parsed, dict):
        return {}
    return {str(key): str(value) for key, value in parsed.items()}


@pytest.fixture(scope="session")
def auth_token() -> str:
    username = os.getenv("INTEGRATION_USERNAME", "integration-tester@example.com")
    password = os.getenv("INTEGRATION_PASSWORD", "ItestP@ssw0rd!")
    return _issue_auth_token(username=username, password=password)


@pytest.fixture(scope="session")
def auth_user_id(auth_token: str) -> str:
    claims = _decode_jwt_claims(auth_token)
    return (
        claims.get("username") or claims.get("cognito:username") or claims.get("sub") or "default"
    )


@pytest.fixture(scope="session")
def secondary_auth_token() -> str:
    username = os.getenv("INTEGRATION_ALT_USERNAME", "integration-alt@example.com")
    password = os.getenv("INTEGRATION_ALT_PASSWORD", "ItestP@ssw0rd!")
    return _issue_auth_token(username=username, password=password)


@pytest.fixture
def api_headers(auth_token: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {auth_token}",
        "Content-Type": "application/json",
    }


@pytest.fixture
def invoke_lambda(lambda_client):
    def _inner(function_name: str, event: dict) -> dict:
        response = lambda_client.invoke(
            FunctionName=function_name,
            Payload=json.dumps(event).encode(),
        )
        payload = response["Payload"].read().decode()
        return json.loads(payload)

    return _inner


@pytest.fixture
def api_call_factory(api_base_url: str):
    def _factory(headers: dict[str, str]):
        def _inner(method: str, path: str, json_body: dict | None = None) -> dict:
            url = f"{api_base_url}/{path.lstrip('/')}"
            data = json.dumps(json_body).encode() if json_body is not None else None
            req_headers = dict(headers)
            req = request.Request(url, data=data, method=method, headers=req_headers)
            try:
                with request.urlopen(req, timeout=90) as resp:
                    body = resp.read().decode()
                    status = resp.getcode()
            except error.HTTPError as exc:
                body = exc.read().decode()
                status = exc.code
            return {"statusCode": status, "body": body}

        return _inner

    return _factory


@pytest.fixture
def api_call(api_call_factory, api_headers: dict[str, str]):
    return api_call_factory(api_headers)


@pytest.fixture
def api_call_other_user(
    api_call_factory,
    secondary_auth_token: str,
):
    return api_call_factory(
        {
            "Authorization": f"Bearer {secondary_auth_token}",
            "Content-Type": "application/json",
        }
    )


@pytest.fixture(scope="session")
def integration_run_namespace() -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    return f"it-{timestamp}-{uuid4().hex[:8]}"


@pytest.fixture
def cleanup_registry() -> Generator[CleanupRegistry, None, None]:
    registry = CleanupRegistry()
    yield registry
    registry.run()


@pytest.fixture
def integration_context(
    api_call,
    json_body,
    invoke_lambda,
    lambda_name,
    auth_user_id,
    integration_run_namespace,
    api_base_url,
    cleanup_registry,
) -> IntegrationExerciseContext:
    return IntegrationExerciseContext(
        api_call=api_call,
        json_body=json_body,
        invoke_lambda=invoke_lambda,
        lambda_name=lambda_name,
        user_id=auth_user_id,
        run_namespace=integration_run_namespace,
        api_base_url=api_base_url,
        cleanup_registry=cleanup_registry,
    )


@pytest.fixture(autouse=True)
def warm_api(api_call):
    # Ensure DB is awake before tests
    api_call("GET", "/warmup")
