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
} from "@/features/reports/reportsSlice";
import type {
  MonthlyReportEntry,
  NetWorthHistoryResponse,
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

const toCsv = (values?: string[]) => {
  if (!values || values.length === 0) return undefined;
  return values.join(",");
};

const buildKey = (filters: ReportFilters | undefined): string =>
  JSON.stringify({
    year: filters?.year ?? null,
    accountIds: [...(filters?.accountIds ?? [])].sort(),
    categoryIds: [...(filters?.categoryIds ?? [])].sort(),
  });

function* handleFetchMonthly(action: ReturnType<typeof FetchMonthlyReport>) {
  const filters = action.payload ?? {};
  const key = buildKey(filters);
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
  const key = buildKey(filters);
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
  const key = buildKey(filters);
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
  const key = buildKey(filters);
  yield put(setNetWorthCurrentKey(key));
  yield put(setNetWorthLoading(true));

  try {
    const query = {
      ...(toCsv(filters.accountIds)
        ? { account_ids: toCsv(filters.accountIds) }
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

export function* ReportsSaga() {
  yield takeLatest(FetchMonthlyReport.type, handleFetchMonthly);
  yield takeLatest(FetchYearlyReport.type, handleFetchYearly);
  yield takeLatest(FetchTotalReport.type, handleFetchTotal);
  yield takeLatest(FetchNetWorthHistory.type, handleFetchNetWorth);
}
