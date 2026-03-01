// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
// Run: python3 scripts/generate_api_contract_types.py

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS";
export type EndpointSpec<TRequest, TResponse, TQuery = void, TPath = void> = {
  path: string;
  method: HttpMethod;
  handler: string;
  auth: boolean;
  __types?: {
    request: TRequest;
    response: TResponse;
    query: TQuery;
    path: TPath;
  };
};
export const defineEndpoint = <
  TRequest,
  TResponse,
  TQuery = void,
  TPath = void,
>(
  spec: Omit<EndpointSpec<TRequest, TResponse, TQuery, TPath>, "__types">,
) => spec as EndpointSpec<TRequest, TResponse, TQuery, TPath>;
