from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Callable, Literal, Sequence
from urllib import error, request

import boto3
import pytest

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
    keys = ["user_pool_id", "user_pool_client_id"]
    params = ssm.get_parameters(Names=[f"{base}/user_pool_id", f"{base}/user_pool_client_id"])[
        "Parameters"
    ]
    mapping = {p["Name"].split("/")[-1]: p["Value"] for p in params}
    return mapping["user_pool_id"], mapping["user_pool_client_id"]


def _ensure_test_user(user_pool_id: str, client_id: str) -> tuple[str, str]:
    username = os.getenv("INTEGRATION_USERNAME", "integration-tester@example.com")
    password = os.getenv("INTEGRATION_PASSWORD", "ItestP@ssw0rd!")
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
    return username, password


@pytest.fixture(scope="session")
def auth_token() -> str:
    user_pool_id, client_id = _get_cognito_params()
    username, password = _ensure_test_user(user_pool_id, client_id)
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
def api_call(api_base_url: str, api_headers: dict[str, str]):
    def _inner(method: str, path: str, json_body: dict | None = None) -> dict:
        url = f"{api_base_url}/{path.lstrip('/')}"
        data = json.dumps(json_body).encode() if json_body is not None else None
        headers = dict(api_headers)
        req = request.Request(url, data=data, method=method, headers=headers)
        try:
            with request.urlopen(req, timeout=90) as resp:
                body = resp.read().decode()
                status = resp.getcode()
        except error.HTTPError as exc:
            body = exc.read().decode()
            status = exc.code
        return {"statusCode": status, "body": body}

    return _inner


@pytest.fixture(autouse=True)
def warm_api(api_call):
    # Ensure DB is awake before tests
    api_call("GET", "/warmup")
