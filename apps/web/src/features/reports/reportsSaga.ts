import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setMonthlyError,
  setMonthlyFilters,
  setMonthlyLoading,
  setMonthlyReport,
  setTotalError,
  setTotalFilters,
  setTotalLoading,
  setTotalReport,
  setYearlyError,
  setYearlyFilters,
  setYearlyLoading,
  setYearlyReport,
  type ReportFilters,
} from "@/features/reports/reportsSlice";
import type {
  MonthlyReportEntry,
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

const toCsv = (values?: string[]) => {
  if (!values || values.length === 0) return undefined;
  return values.join(",");
};

function* handleFetchMonthly(action: ReturnType<typeof FetchMonthlyReport>) {
  const filters = action.payload ?? {};
  yield put(setMonthlyLoading(true));
  if (action.payload) {
    yield put(setMonthlyFilters(action.payload));
  }

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

    yield put(setMonthlyReport(response.results));
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
  yield put(setYearlyLoading(true));
  if (action.payload) {
    yield put(setYearlyFilters(action.payload));
  }

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

    yield put(setYearlyReport(response.results));
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
  yield put(setTotalLoading(true));
  if (action.payload) {
    yield put(setTotalFilters(action.payload));
  }

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

    yield put(setTotalReport(response));
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

export function* ReportsSaga() {
  yield takeLatest(FetchMonthlyReport.type, handleFetchMonthly);
  yield takeLatest(FetchYearlyReport.type, handleFetchYearly);
  yield takeLatest(FetchTotalReport.type, handleFetchTotal);
}
