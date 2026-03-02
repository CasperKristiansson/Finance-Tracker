import { endpoints } from "./generated/contracts/endpoints";
import type {
  EndpointMap as GeneratedEndpointMap,
  EndpointName as GeneratedEndpointName,
  EndpointPath as GeneratedEndpointPath,
  EndpointPathParams as GeneratedEndpointPathParams,
  EndpointQuery as GeneratedEndpointQuery,
  EndpointRequest as GeneratedEndpointRequest,
  EndpointResponse as GeneratedEndpointResponse,
} from "./generated/contracts/endpoints";

export { endpoints };

export type EndpointMap = GeneratedEndpointMap;
export type EndpointName = GeneratedEndpointName;
export type EndpointPath = GeneratedEndpointPath;
export type EndpointPathParams<N extends EndpointName> =
  GeneratedEndpointPathParams<N>;
export type EndpointQuery<N extends EndpointName> = GeneratedEndpointQuery<N>;
export type EndpointRequest<N extends EndpointName> =
  GeneratedEndpointRequest<N>;
export type EndpointResponse<N extends EndpointName> =
  GeneratedEndpointResponse<N>;

export type {
  SettingsPayload,
  SettingsResponse,
  TotalOverviewResponse,
  TransactionRead,
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
} from "./api";
