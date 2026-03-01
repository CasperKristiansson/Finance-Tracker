from __future__ import annotations

from uuid import uuid4

COVERS_SERVERLESS_FUNCTION = "importSuggestionsConnect"
COVERS_EVENT_TYPE = "websocket"
COVERS_HTTP_METHOD = None
COVERS_HTTP_PATH = None
COVERS_ROUTE = "$connect"


def test_importSuggestionsConnect_integration(integration_context) -> None:
    context = integration_context
    client_id = uuid4()
    token = f"token-{uuid4().hex}"
    connection_id = f"{context.run_namespace}-connect"
    context.ws_connect(client_id=client_id, client_token=token, connection_id=connection_id)
    context.ws_disconnect(connection_id=connection_id)
