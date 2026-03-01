import { apiFetch } from "@/lib/apiClient";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import type {
  EndpointResponse,
  TotalOverviewResponse,
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
} from "@/types/contracts";
import {
  monthlyReportSchema,
  totalOverviewSchema,
  yearlyCategoryDetailSchema,
  yearlyOverviewSchema,
  yearlyReportSchema,
} from "@/types/schemas";

type TokenParam = { token: string | null };

export const fetchTotalOverview = async ({ token }: TokenParam) =>
  apiFetch<TotalOverviewResponse>(
    buildEndpointRequest("totalOverview", {
      schema: totalOverviewSchema,
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
      schema: yearlyOverviewSchema,
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
      schema: yearlyCategoryDetailSchema,
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
      schema: yearlyReportSchema,
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
      schema: monthlyReportSchema,
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
      schema: monthlyReportSchema,
      query,
      token,
    }),
  );
