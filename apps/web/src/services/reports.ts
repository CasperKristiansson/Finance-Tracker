import { apiFetch } from "@/lib/apiClient";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import type {
  EndpointResponse,
  TotalOverviewResponse,
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
} from "@/types/contracts";

type TokenParam = { token: string | null };

export const fetchTotalOverview = async ({ token }: TokenParam) =>
  apiFetch<TotalOverviewResponse>(
    buildEndpointRequest("totalOverview", {
      token,
    }),
  );

export const fetchYearlyOverview = async ({
  year,
  token,
  accountIds,
}: TokenParam & { year: number; accountIds?: string | string[] }) =>
  apiFetch<YearlyOverviewResponse>(
    buildEndpointRequest("yearlyOverview", {
      query: {
        year,
        ...(accountIds ? { account_ids: accountIds } : {}),
      },
      token,
    }),
  );

export const fetchYearlyCategoryDetail = async ({
  year,
  categoryId,
  flow,
  token,
}: TokenParam & {
  year: number;
  categoryId: string;
  flow: "expense" | "income";
}) =>
  apiFetch<YearlyCategoryDetailResponse>(
    buildEndpointRequest("yearlyCategoryDetail", {
      query: {
        year,
        category_id: categoryId,
        flow,
      },
      token,
    }),
  );

export const fetchYearlyReport = async ({
  year,
  accountIds,
  token,
}: TokenParam & { year?: number; accountIds?: string | string[] }) =>
  apiFetch<EndpointResponse<"yearlyReport">>(
    buildEndpointRequest("yearlyReport", {
      query: {
        ...(typeof year === "number" ? { year } : {}),
        ...(accountIds ? { account_ids: accountIds } : {}),
      },
      token,
    }),
  );

export const fetchMonthlyReport = async ({
  year,
  accountIds,
  token,
}: TokenParam & { year: number; accountIds?: string[] }) =>
  apiFetch<EndpointResponse<"monthlyReport">>(
    buildEndpointRequest("monthlyReport", {
      query: {
        year,
        ...(accountIds?.length ? { account_ids: accountIds } : {}),
      },
      token,
    }),
  );

export const fetchCustomReport = async ({
  token,
  query,
}: TokenParam & {
  query: Record<string, string | number | string[]>;
}) =>
  apiFetch<EndpointResponse<"dateRangeReport">>(
    buildEndpointRequest("dateRangeReport", {
      query,
      token,
    }),
  );
