import { apiFetch } from "@/lib/apiClient";
import type {
  TotalOverviewResponse,
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
  YearlyReportEntry,
} from "@/types/api";
import {
  monthlyReportSchema,
  totalOverviewSchema,
  yearlyCategoryDetailSchema,
  yearlyOverviewSchema,
  yearlyReportSchema,
} from "@/types/schemas";

type TokenParam = { token: string | null };

export const fetchTotalOverview = async ({ token }: TokenParam) =>
  apiFetch<TotalOverviewResponse>({
    path: "/reports/total-overview",
    schema: totalOverviewSchema,
    token,
  });

export const fetchYearlyOverview = async ({
  year,
  token,
  accountIds,
}: TokenParam & { year: number; accountIds?: string | string[] }) =>
  apiFetch<YearlyOverviewResponse>({
    path: "/reports/yearly-overview",
    schema: yearlyOverviewSchema,
    query: {
      year,
      ...(accountIds ? { account_ids: accountIds } : {}),
    },
    token,
  });

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
  apiFetch<YearlyCategoryDetailResponse>({
    path: "/reports/yearly-category-detail",
    schema: yearlyCategoryDetailSchema,
    query: {
      year,
      category_id: categoryId,
      flow,
    },
    token,
  });

export const fetchYearlyReport = async ({
  year,
  accountIds,
  token,
}: TokenParam & { year?: number; accountIds?: string | string[] }) =>
  apiFetch<{ results: YearlyReportEntry[] }>({
    path: "/reports/yearly",
    schema: yearlyReportSchema,
    query: {
      ...(typeof year === "number" ? { year } : {}),
      ...(accountIds ? { account_ids: accountIds } : {}),
    },
    token,
  });

export const fetchMonthlyReport = async ({
  year,
  accountIds,
  token,
}: TokenParam & { year: number; accountIds?: string[] }) =>
  apiFetch<{
    results: Array<{
      period: string;
      income: string;
      expense: string;
      net: string;
    }>;
  }>({
    path: "/reports/monthly",
    schema: monthlyReportSchema,
    query: {
      year,
      ...(accountIds?.length ? { account_ids: accountIds } : {}),
    },
    token,
  });

export const fetchCustomReport = async ({
  token,
  query,
}: TokenParam & {
  query: Record<string, string | number | string[]>;
}) =>
  apiFetch<{
    results: Array<{
      period: string;
      income: string;
      expense: string;
      net: string;
    }>;
  }>({
    path: "/reports/custom",
    schema: monthlyReportSchema,
    query,
    token,
  });
