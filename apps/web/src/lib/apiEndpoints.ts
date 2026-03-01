import type { ApiRequest } from "@/lib/apiClient";
import {
  endpoints,
  type EndpointName,
  type EndpointPathParams,
  type EndpointQuery,
  type EndpointRequest as EndpointRequestBody,
} from "@/types/contracts";

const PATH_PARAM_REGEX = /\{([^{}]+)\}/g;
const UNRESOLVED_PATH_PARAM_REGEX = /\{[^{}]+\}/;

type PathParamValue = string | number | boolean;

type EndpointRequestOptions<N extends EndpointName> = Omit<
  ApiRequest,
  "path" | "method" | "query" | "body"
> & {
  pathParams?: EndpointPathParams<N> extends void
    ? undefined
    : Record<string, PathParamValue>;
  query?: EndpointQuery<N> extends void
    ? ApiRequest["query"]
    : ApiRequest["query"];
  body?: EndpointRequestBody<N> extends void
    ? undefined
    : EndpointRequestBody<N>;
};

const interpolatePath = (
  template: string,
  params?: Record<string, PathParamValue>,
): string => {
  const provided = params ?? {};
  const rendered = template.replace(PATH_PARAM_REGEX, (full, key: string) => {
    if (!(key in provided)) {
      throw new Error(`Missing path param '${key}' for endpoint '${template}'`);
    }
    return encodeURIComponent(String(provided[key]));
  });

  if (UNRESOLVED_PATH_PARAM_REGEX.test(rendered)) {
    throw new Error(`Unresolved path params for endpoint '${template}'`);
  }

  return rendered;
};

export const buildEndpointRequest = <N extends EndpointName>(
  endpointName: N,
  options: EndpointRequestOptions<N> = {},
): ApiRequest => {
  const endpoint = endpoints[endpointName];
  const { pathParams, query, body, ...rest } = options;
  return {
    ...rest,
    path: interpolatePath(
      endpoint.path,
      pathParams as Record<string, PathParamValue> | undefined,
    ),
    method: endpoint.method,
    query: query as ApiRequest["query"],
    body,
  };
};
