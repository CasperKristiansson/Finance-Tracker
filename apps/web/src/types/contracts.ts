/* eslint-disable @typescript-eslint/no-explicit-any */
import { endpoints } from "./generated/contracts/endpoints";
import type {
  EndpointMap as GeneratedEndpointMap,
  EndpointName as GeneratedEndpointName,
  EndpointPath as GeneratedEndpointPath,
  EndpointPathParams as GeneratedEndpointPathParams,
  EndpointQuery as GeneratedEndpointQuery,
} from "./generated/contracts/endpoints";

export { endpoints };

export type EndpointMap = GeneratedEndpointMap;
export type EndpointName = GeneratedEndpointName;
export type EndpointPath = GeneratedEndpointPath;
export type EndpointPathParams<N extends EndpointName> =
  GeneratedEndpointPathParams<N>;
export type EndpointQuery<N extends EndpointName> = GeneratedEndpointQuery<N>;

// Request/response bodies are validated at call-sites with zod schemas.
// Keep these broad to decouple transport contract generation from UI domain models.
export type EndpointRequest<N extends EndpointName> = N extends EndpointName
  ? any
  : never;
export type EndpointResponse<N extends EndpointName> = N extends EndpointName
  ? any
  : never;

export type {
  SettingsPayload,
  SettingsResponse,
  TotalOverviewResponse,
  TransactionRead,
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
} from "./api";
