import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setMonthlyError,
  setMonthlyCurrentKey,
  setMonthlyLoading,
  setMonthlyReport,
  setNetWorthCurrentKey,
  setNetWorthError,
  setNetWorthHistory,
  setNetWorthLoading,
  setTotalError,
  setTotalCurrentKey,
  setTotalLoading,
  setTotalReport,
  setYearlyError,
  setYearlyCurrentKey,
  setYearlyLoading,
  setYearlyReport,
  type ReportFilters,
  setQuarterlyCurrentKey,
  setQuarterlyError,
  setQuarterlyLoading,
  setQuarterlyReport,
  setCustomCurrentKey,
  setCustomError,
  setCustomLoading,
  setCustomReport,
  setExportError,
  setExportLoading,
} from "@/features/reports/reportsSlice";
import { buildReportKey } from "@/features/reports/reportsSlice";
import type {
  MonthlyReportEntry,
  NetWorthHistoryResponse,
  QuarterlyReportEntry,
  TotalReportRead,
  YearlyReportEntry,
} from "@/types/api";

export const FetchMonthlyReport = createAction<ReportFilters | undefined>(
  "reports/fetchMonthly",
);
export const FetchYearlyReport = createAction<
  Omit<ReportFilters, "year"> | undefined
>("reports/fetchYearly");
export const FetchTotalReport = createAction<
  Omit<ReportFilters, "year"> | undefined
>("reports/fetchTotal");
export const FetchNetWorthHistory = createAction<
  Omit<ReportFilters, "year" | "categoryIds"> | undefined
>("reports/fetchNetWorth");
export const FetchQuarterlyReport = createAction<ReportFilters | undefined>(
  "reports/fetchQuarterly",
);
export const FetchCustomReport = createAction<{
  start_date: string;
  end_date: string;
  accountIds?: string[];
  categoryIds?: string[];
  subscriptionIds?: string[];
}>("reports/fetchCustom");
export const ExportReport = createAction<{
  granularity: "monthly" | "yearly" | "quarterly" | "total" | "net_worth";
  format?: "csv" | "xlsx";
  year?: number;
  start_date?: string;
  end_date?: string;
  accountIds?: string[];
  categoryIds?: string[];
  subscriptionIds?: string[];
}>("reports/export");

const toCsv = (values?: string[]) => {
  if (!values || values.length === 0) return undefined;
  return values.join(",");
};

function* handleFetchMonthly(action: ReturnType<typeof FetchMonthlyReport>) {
  const filters = action.payload ?? {};
  const key = buildReportKey(filters);
  yield put(setMonthlyCurrentKey(key));
  yield put(setMonthlyLoading(true));

  try {
    const query = {
      ...(filters.year ? { year: filters.year } : {}),
      ...(toCsv(filters.accountIds)
        ? { account_ids: toCsv(filters.accountIds) }
        : {}),
      ...(toCsv(filters.categoryIds)
        ? { category_ids: toCsv(filters.categoryIds) }
        : {}),
      ...(toCsv(filters.subscriptionIds)
        ? { subscription_ids: toCsv(filters.subscriptionIds) }
        : {}),
    };

    const response: { results: MonthlyReportEntry[] } = yield call(
      callApiWithAuth,
      { path: "/reports/monthly", query },
      { loadingKey: "report-monthly" },
    );

    yield put(setMonthlyReport({ key, data: response.results }));
  } catch (error) {
    yield put(
      setMonthlyError(
        error instanceof Error
          ? error.message
          : "Failed to load monthly report",
      ),
    );
  } finally {
    yield put(setMonthlyLoading(false));
  }
}

function* handleFetchYearly(action: ReturnType<typeof FetchYearlyReport>) {
  const filters = action.payload ?? {};
  const key = buildReportKey(filters);
  yield put(setYearlyCurrentKey(key));
  yield put(setYearlyLoading(true));

  try {
    const query = {
      ...(toCsv(filters.accountIds)
        ? { account_ids: toCsv(filters.accountIds) }
        : {}),
      ...(toCsv(filters.categoryIds)
        ? { category_ids: toCsv(filters.categoryIds) }
        : {}),
      ...(toCsv(filters.subscriptionIds)
        ? { subscription_ids: toCsv(filters.subscriptionIds) }
        : {}),
    };

    const response: { results: YearlyReportEntry[] } = yield call(
      callApiWithAuth,
      { path: "/reports/yearly", query },
      { loadingKey: "report-yearly" },
    );

    yield put(setYearlyReport({ key, data: response.results }));
  } catch (error) {
    yield put(
      setYearlyError(
        error instanceof Error ? error.message : "Failed to load yearly report",
      ),
    );
  } finally {
    yield put(setYearlyLoading(false));
  }
}

function* handleFetchTotal(action: ReturnType<typeof FetchTotalReport>) {
  const filters = action.payload ?? {};
  const key = buildReportKey(filters);
  yield put(setTotalCurrentKey(key));
  yield put(setTotalLoading(true));

  try {
    const query = {
      ...(toCsv(filters.accountIds)
        ? { account_ids: toCsv(filters.accountIds) }
        : {}),
      ...(toCsv(filters.categoryIds)
        ? { category_ids: toCsv(filters.categoryIds) }
        : {}),
      ...(toCsv(filters.subscriptionIds)
        ? { subscription_ids: toCsv(filters.subscriptionIds) }
        : {}),
    };

    const response: TotalReportRead = yield call(
      callApiWithAuth,
      { path: "/reports/total", query },
      { loadingKey: "report-total" },
    );

    yield put(setTotalReport({ key, data: response }));
  } catch (error) {
    yield put(
      setTotalError(
        error instanceof Error ? error.message : "Failed to load totals",
      ),
    );
  } finally {
    yield put(setTotalLoading(false));
  }
}

function* handleFetchNetWorth(action: ReturnType<typeof FetchNetWorthHistory>) {
  const filters = action.payload ?? {};
  const key = buildReportKey(filters);
  yield put(setNetWorthCurrentKey(key));
  yield put(setNetWorthLoading(true));

  try {
    const query = {
      ...(toCsv(filters.accountIds)
        ? { account_ids: toCsv(filters.accountIds) }
        : {}),
      ...(toCsv(filters.subscriptionIds)
        ? { subscription_ids: toCsv(filters.subscriptionIds) }
        : {}),
    };

    const response: NetWorthHistoryResponse = yield call(
      callApiWithAuth,
      { path: "/reports/net-worth", query },
      { loadingKey: "report-net-worth" },
    );

    yield put(setNetWorthHistory({ key, data: response.points }));
  } catch (error) {
    yield put(
      setNetWorthError(
        error instanceof Error
          ? error.message
          : "Failed to load net worth history",
      ),
    );
  } finally {
    yield put(setNetWorthLoading(false));
  }
}

function* handleFetchQuarterly(
  action: ReturnType<typeof FetchQuarterlyReport>,
) {
  const filters = action.payload ?? {};
  const key = buildReportKey(filters);
  yield put(setQuarterlyCurrentKey(key));
  yield put(setQuarterlyLoading(true));

  try {
    const query = {
      ...(filters.year ? { year: filters.year } : {}),
      ...(toCsv(filters.accountIds)
        ? { account_ids: toCsv(filters.accountIds) }
        : {}),
      ...(toCsv(filters.categoryIds)
        ? { category_ids: toCsv(filters.categoryIds) }
        : {}),
    };
    const response: { results: QuarterlyReportEntry[] } = yield call(
      callApiWithAuth,
      { path: "/reports/quarterly", query },
      { loadingKey: "report-quarterly" },
    );
    yield put(setQuarterlyReport({ key, data: response.results }));
  } catch (error) {
    yield put(
      setQuarterlyError(
        error instanceof Error
          ? error.message
          : "Failed to load quarterly report",
      ),
    );
  } finally {
    yield put(setQuarterlyLoading(false));
  }
}

function* handleFetchCustom(action: ReturnType<typeof FetchCustomReport>) {
  const params = action.payload;
  const key = JSON.stringify(params);
  yield put(setCustomCurrentKey(key));
  yield put(setCustomLoading(true));

  try {
    const query = {
      start_date: params.start_date,
      end_date: params.end_date,
      ...(toCsv(params.accountIds)
        ? { account_ids: toCsv(params.accountIds) }
        : {}),
      ...(toCsv(params.categoryIds)
        ? { category_ids: toCsv(params.categoryIds) }
        : {}),
      ...(toCsv(params.subscriptionIds)
        ? { subscription_ids: toCsv(params.subscriptionIds) }
        : {}),
    };
    const response: { results: MonthlyReportEntry[] } = yield call(
      callApiWithAuth,
      { path: "/reports/custom", query },
      { loadingKey: "report-custom" },
    );
    yield put(setCustomReport({ key, data: response.results }));
  } catch (error) {
    yield put(
      setCustomError(
        error instanceof Error ? error.message : "Failed to load custom report",
      ),
    );
  } finally {
    yield put(setCustomLoading(false));
  }
}

function* handleExportReport(action: ReturnType<typeof ExportReport>) {
  yield put(setExportLoading(true));
  try {
    const payload = {
      granularity: action.payload.granularity,
      format: action.payload.format ?? "csv",
      year: action.payload.year,
      start_date: action.payload.start_date,
      end_date: action.payload.end_date,
      ...(toCsv(action.payload.accountIds)
        ? { account_ids: toCsv(action.payload.accountIds) }
        : {}),
      ...(toCsv(action.payload.categoryIds)
        ? { category_ids: toCsv(action.payload.categoryIds) }
        : {}),
      ...(toCsv(action.payload.subscriptionIds)
        ? { subscription_ids: toCsv(action.payload.subscriptionIds) }
        : {}),
    };
    const response: {
      filename: string;
      content_type: string;
      data_base64: string;
    } = yield call(
      callApiWithAuth,
      { path: "/reports/export", method: "POST", body: payload },
      { loadingKey: "report-export" },
    );
    const link = document.createElement("a");
    link.href = `data:${response.content_type};base64,${response.data_base64}`;
    link.download = response.filename;
    link.click();
  } catch (error) {
    yield put(
      setExportError(
        error instanceof Error ? error.message : "Failed to export report",
      ),
    );
  } finally {
    yield put(setExportLoading(false));
  }
}

export function* ReportsSaga() {
  yield takeLatest(FetchMonthlyReport.type, handleFetchMonthly);
  yield takeLatest(FetchYearlyReport.type, handleFetchYearly);
  yield takeLatest(FetchTotalReport.type, handleFetchTotal);
  yield takeLatest(FetchNetWorthHistory.type, handleFetchNetWorth);
  yield takeLatest(FetchQuarterlyReport.type, handleFetchQuarterly);
  yield takeLatest(FetchCustomReport.type, handleFetchCustom);
  yield takeLatest(ExportReport.type, handleExportReport);
}
