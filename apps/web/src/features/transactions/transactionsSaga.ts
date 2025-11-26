import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setTransactionFilters,
  setTransactions,
  setTransactionsError,
  setTransactionsLoading,
  setRecentTransactions,
  setRecentError,
  setRecentLoading,
  setRecentLimit,
  type TransactionFilters,
} from "@/features/transactions/transactionsSlice";
import type { TransactionListResponse } from "@/types/api";

export const FetchTransactions = createAction<TransactionFilters | undefined>(
  "transactions/fetch",
);
export const FetchRecentTransactions = createAction<{
  limit?: number;
  accountIds?: string[];
}>("transactions/fetchRecent");

const serializeAccounts = (ids?: string[]) => {
  if (!ids || ids.length === 0) return undefined;
  return ids.join(",");
};

function* handleFetchTransactions(
  action: ReturnType<typeof FetchTransactions>,
) {
  const filters = action.payload ?? {};
  yield put(setTransactionsLoading(true));
  if (action.payload) {
    yield put(setTransactionFilters(action.payload));
  }

  try {
    const query = {
      ...(filters.startDate ? { start_date: filters.startDate } : {}),
      ...(filters.endDate ? { end_date: filters.endDate } : {}),
      ...(serializeAccounts(filters.accountIds)
        ? { account_ids: serializeAccounts(filters.accountIds) }
        : {}),
    };

    const response: TransactionListResponse = yield call(
      callApiWithAuth,
      { path: "/transactions", query },
      { loadingKey: "transactions" },
    );

    yield put(setTransactions(response.transactions));
  } catch (error) {
    yield put(
      setTransactionsError(
        error instanceof Error ? error.message : "Failed to load transactions",
      ),
    );
  } finally {
    yield put(setTransactionsLoading(false));
  }
}

function* handleFetchRecentTransactions(
  action: ReturnType<typeof FetchRecentTransactions>,
) {
  const limit = action.payload?.limit ?? 5;
  yield put(setRecentLimit(limit));
  yield put(setRecentLoading(true));

  try {
    const query = {
      limit,
      ...(serializeAccounts(action.payload?.accountIds)
        ? { account_ids: serializeAccounts(action.payload?.accountIds) }
        : {}),
    };

    const response: TransactionListResponse = yield call(
      callApiWithAuth,
      { path: "/transactions", query },
      { loadingKey: "transactions-recent" },
    );

    const trimmed = response.transactions.slice(0, limit);
    yield put(setRecentTransactions(trimmed));
  } catch (error) {
    yield put(
      setRecentError(
        error instanceof Error
          ? error.message
          : "Failed to load recent transactions",
      ),
    );
  } finally {
    yield put(setRecentLoading(false));
  }
}

export function* TransactionsSaga() {
  yield takeLatest(FetchTransactions.type, handleFetchTransactions);
  yield takeLatest(FetchRecentTransactions.type, handleFetchRecentTransactions);
}
