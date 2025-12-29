import {
  demoGoals,
  demoSubscriptions,
  demoTaxEvents,
  demoTaxTotalSummary,
  demoTransactionsResponse,
  getDemoCashflowForecast,
  getDemoMonthlyReport,
  getDemoNetWorthProjection,
  getDemoQuarterlyReport,
  getDemoTaxSummary,
  getDemoTotalOverview,
  getDemoYearlyCategoryDetail,
  getDemoYearlyOverview,
  getDemoYearlyReport,
} from "@/data/demoPayloads";
import { TransactionType } from "@/types/api";

export type DemoApiRequest = {
  path: string;
  method?: string;
  query?: Record<
    string,
    | string
    | number
    | boolean
    | Array<string | number | boolean>
    | null
    | undefined
  >;
  body?: unknown;
};

const getNumber = (value: unknown, fallback: number) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
};

const getStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "string") {
    if (!value) return [];
    return value.split(",").map((item) => item.trim());
  }
  return [];
};

export const resolveDemoRequest = (request: DemoApiRequest) => {
  const method = (request.method ?? "GET").toUpperCase();
  const path = request.path.startsWith("/") ? request.path : `/${request.path}`;

  if (method === "GET") {
    switch (path) {
      case "/reports/monthly": {
        const year = getNumber(request.query?.year, new Date().getFullYear());
        return { results: getDemoMonthlyReport(year) };
      }
      case "/reports/quarterly": {
        const year = getNumber(request.query?.year, new Date().getFullYear());
        return { results: getDemoQuarterlyReport(year) };
      }
      case "/reports/yearly": {
        return { results: getDemoYearlyReport() };
      }
      case "/reports/yearly-overview": {
        const year = getNumber(request.query?.year, new Date().getFullYear());
        return getDemoYearlyOverview(year);
      }
      case "/reports/total-overview": {
        return getDemoTotalOverview();
      }
      case "/reports/custom": {
        const year = new Date().getFullYear();
        return { results: getDemoMonthlyReport(year) };
      }
      case "/reports/yearly-category-detail": {
        const year = getNumber(request.query?.year, new Date().getFullYear());
        const categoryId = String(request.query?.category_id ?? "");
        const flow = request.query?.flow === "income" ? "income" : "expense";
        return getDemoYearlyCategoryDetail(year, categoryId, flow);
      }
      case "/reports/forecast/cashflow": {
        const days = getNumber(request.query?.days, 60);
        const lookback = getNumber(request.query?.lookback_days, 180);
        const model =
          typeof request.query?.model === "string"
            ? request.query?.model
            : "ensemble";
        return getDemoCashflowForecast(days, lookback, model);
      }
      case "/reports/forecast/net-worth": {
        const months = getNumber(request.query?.months, 36);
        return getDemoNetWorthProjection(months);
      }
      case "/transactions": {
        const accountIds = getStringArray(request.query?.account_ids);
        const categoryIds = getStringArray(request.query?.category_ids);
        const limit = getNumber(request.query?.limit, 100);
        const offset = getNumber(request.query?.offset, 0);
        const transactionTypes = getStringArray(
          request.query?.transaction_types ?? request.query?.transaction_type,
        );
        const subscriptionIds = getStringArray(request.query?.subscription_ids);
        const startDate = request.query?.start_date
          ? new Date(String(request.query.start_date))
          : null;
        const endDate = request.query?.end_date
          ? new Date(String(request.query.end_date))
          : null;
        const minAmount = request.query?.min_amount
          ? Number(request.query.min_amount)
          : null;
        const maxAmount = request.query?.max_amount
          ? Number(request.query.max_amount)
          : null;
        const hasMinAmount =
          typeof minAmount === "number" && Number.isFinite(minAmount);
        const hasMaxAmount =
          typeof maxAmount === "number" && Number.isFinite(maxAmount);
        const search =
          typeof request.query?.search === "string"
            ? request.query.search.toLowerCase()
            : null;
        const transactions = demoTransactionsResponse.transactions.filter(
          (tx) => {
            if (accountIds.length) {
              const match = tx.legs.some((leg) =>
                accountIds.includes(leg.account_id),
              );
              if (!match) return false;
            }
            if (
              categoryIds.length &&
              !categoryIds.includes(tx.category_id ?? "")
            ) {
              return false;
            }
            if (
              subscriptionIds.length &&
              !subscriptionIds.includes(tx.subscription_id ?? "")
            ) {
              return false;
            }
            if (transactionTypes.length) {
              return transactionTypes.includes(tx.transaction_type);
            }
            if (startDate && new Date(tx.occurred_at) < startDate) {
              return false;
            }
            if (endDate && new Date(tx.occurred_at) > endDate) {
              return false;
            }
            if (hasMinAmount || hasMaxAmount) {
              const total = tx.legs.reduce(
                (sum, leg) => sum + Number(leg.amount),
                0,
              );
              if (hasMinAmount && minAmount !== null && total < minAmount) {
                return false;
              }
              if (hasMaxAmount && maxAmount !== null && total > maxAmount) {
                return false;
              }
            }
            if (search) {
              const description = tx.description?.toLowerCase() ?? "";
              if (!description.includes(search)) {
                return false;
              }
            }
            return true;
          },
        );
        const sliced = limit
          ? transactions.slice(offset, offset + limit)
          : transactions.slice(offset);
        return {
          transactions: sliced,
          running_balances: demoTransactionsResponse.running_balances,
        };
      }
      case "/subscriptions/summary": {
        return demoSubscriptions;
      }
      case "/goals": {
        return demoGoals;
      }
      case "/tax/summary": {
        const year = getNumber(request.query?.year, new Date().getFullYear());
        return getDemoTaxSummary(year);
      }
      case "/tax/summary/total": {
        return demoTaxTotalSummary;
      }
      case "/tax/events": {
        const limit = getNumber(request.query?.limit, 200);
        const offset = getNumber(request.query?.offset, 0);
        return {
          events: demoTaxEvents.events.slice(offset, offset + limit),
        };
      }
      default:
        return null;
    }
  }

  if (method === "POST" && path === "/transactions") {
    return {
      id: `demo-tx-${Date.now()}`,
      category_id: null,
      subscription_id: null,
      transaction_type: TransactionType.EXPENSE,
      description: "Demo transaction",
      notes: null,
      external_id: null,
      occurred_at: new Date().toISOString(),
      posted_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      legs: [],
    };
  }

  return null;
};
