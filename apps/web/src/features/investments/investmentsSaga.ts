import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setInvestmentsError,
  setInvestmentsLoading,
  setTransactions,
  setMetrics,
  setOverview,
} from "@/features/investments/investmentsSlice";
import type {
  InvestmentMetricsResponse,
  InvestmentOverviewResponse,
  InvestmentTransactionListResponse,
} from "@/types/api";
import {
  investmentMetricsResponseSchema,
  investmentOverviewResponseSchema,
  investmentTransactionListSchema,
} from "@/types/schemas";

export const FetchInvestmentTransactions = createAction(
  "investments/fetchTransactions",
);
export const FetchInvestmentMetrics = createAction("investments/fetchMetrics");
export const FetchInvestmentOverview = createAction(
  "investments/fetchOverview",
);

function* handleFetchTransactions(): Generator {
  try {
    const response: InvestmentTransactionListResponse = yield call(
      callApiWithAuth,
      {
        path: "/investments/transactions",
        query: { limit: 500 },
        schema: investmentTransactionListSchema,
      },
      { loadingKey: "investments", silent: true },
    );
    if (response?.transactions) {
      yield put(setTransactions(response.transactions));
    }
  } catch (error) {
    yield put(
      setInvestmentsError(
        error instanceof Error
          ? error.message
          : "Unable to load investment transactions.",
      ),
    );
  }
}

function* handleFetchMetrics(): Generator {
  try {
    const response: InvestmentMetricsResponse = yield call(
      callApiWithAuth,
      {
        path: "/investments/metrics",
        schema: investmentMetricsResponseSchema,
      },
      { loadingKey: "investments", silent: true },
    );
    yield put(setMetrics(response.performance));
    yield put(setTransactions(response.transactions));
  } catch (error) {
    yield put(
      setInvestmentsError(
        error instanceof Error ? error.message : "Unable to load metrics.",
      ),
    );
  }
}

function* handleFetchOverview(): Generator {
  yield put(setInvestmentsLoading(true));
  try {
    const response: InvestmentOverviewResponse = yield call(
      callApiWithAuth,
      {
        path: "/investments/overview",
        schema: investmentOverviewResponseSchema,
      },
      { loadingKey: "investments", silent: true },
    );
    yield put(setOverview(response));
  } catch (error) {
    yield put(
      setInvestmentsError(
        error instanceof Error
          ? error.message
          : "Unable to load investment overview.",
      ),
    );
  } finally {
    yield put(setInvestmentsLoading(false));
  }
}

export function* InvestmentsSaga() {
  yield takeLatest(FetchInvestmentTransactions.type, handleFetchTransactions);
  yield takeLatest(FetchInvestmentMetrics.type, handleFetchMetrics);
  yield takeLatest(FetchInvestmentOverview.type, handleFetchOverview);
}
