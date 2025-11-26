import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setTransactionFilters,
  setTransactions,
  setTransactionsError,
  setTransactionsLoading,
  type TransactionFilters,
} from "@/features/transactions/transactionsSlice";
import type { TransactionListResponse } from "@/types/api";

export const FetchTransactions = createAction<TransactionFilters | undefined>(
  "transactions/fetch",
);

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

export function* TransactionsSaga() {
  yield takeLatest(FetchTransactions.type, handleFetchTransactions);
}
