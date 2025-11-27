import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setTransactionFilters,
  setTransactions,
  setTransactionsError,
  setTransactionsLoading,
  setPagination,
  upsertTransaction,
  removeTransaction,
  setRecentTransactions,
  setRecentError,
  setRecentLoading,
  setRecentLimit,
  setRunningBalances,
  selectTransactions,
  type TransactionFilters,
} from "@/features/transactions/transactionsSlice";
import { selectTransactionFilters } from "@/features/transactions/transactionsSlice";
import type {
  TransactionCreate,
  TransactionListResponse,
  TransactionRead,
  TransactionStatus,
  TransactionUpdateRequest,
} from "@/types/api";

export const FetchTransactions = createAction<TransactionFilters | undefined>(
  "transactions/fetch",
);
export const FetchRecentTransactions = createAction<{
  limit?: number;
  accountIds?: string[];
}>("transactions/fetchRecent");
export const CreateTransaction = createAction<TransactionCreate>(
  "transactions/create",
);
export const UpdateTransaction = createAction<{
  id: string;
  data: TransactionUpdateRequest;
}>("transactions/update");
export const UpdateTransactionStatus = createAction<{
  id: string;
  status: TransactionStatus;
}>("transactions/updateStatus");
export const DeleteTransaction = createAction<string>("transactions/delete");

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

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;

  try {
    const query = {
      ...(filters.startDate ? { start_date: filters.startDate } : {}),
      ...(filters.endDate ? { end_date: filters.endDate } : {}),
      ...(serializeAccounts(filters.accountIds)
        ? { account_ids: serializeAccounts(filters.accountIds) }
        : {}),
      ...(filters.categoryIds?.length
        ? { category_ids: filters.categoryIds.join(",") }
        : {}),
      ...(filters.status?.length ? { status: filters.status.join(",") } : {}),
      ...(filters.minAmount ? { min_amount: filters.minAmount } : {}),
      ...(filters.maxAmount ? { max_amount: filters.maxAmount } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      limit,
      offset,
    };

    const response: TransactionListResponse = yield call(
      callApiWithAuth,
      { path: "/transactions", query },
      { loadingKey: "transactions" },
    );

    const existing: TransactionRead[] = yield select(selectTransactions);
    const combined =
      offset > 0
        ? [...existing, ...response.transactions]
        : response.transactions;
    yield put(setTransactions(combined));
    if (response.running_balances) {
      yield put(setRunningBalances(response.running_balances));
    }
    yield put(
      setPagination({
        limit,
        offset,
        hasMore: response.transactions.length >= limit,
      }),
    );
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

function* handleCreateTransaction(
  action: ReturnType<typeof CreateTransaction>,
) {
  try {
    const response: TransactionRead = yield call(
      callApiWithAuth,
      { path: "/transactions", method: "POST", body: action.payload },
      { loadingKey: "transaction-create" },
    );
    yield put(upsertTransaction(response));
    const filters: TransactionFilters = yield select(selectTransactionFilters);
    yield call(handleFetchTransactions, FetchTransactions(filters));
  } catch (error) {
    yield put(
      setTransactionsError(
        error instanceof Error ? error.message : "Failed to create transaction",
      ),
    );
  }
}

function* handleUpdateTransaction(
  action: ReturnType<typeof UpdateTransaction>,
) {
  try {
    const response: TransactionRead = yield call(
      callApiWithAuth,
      {
        path: `/transactions/${action.payload.id}`,
        method: "PATCH",
        body: action.payload.data,
      },
      { loadingKey: "transaction-update" },
    );
    yield put(upsertTransaction(response));
  } catch (error) {
    yield put(
      setTransactionsError(
        error instanceof Error ? error.message : "Failed to update transaction",
      ),
    );
  }
}

function* handleUpdateTransactionStatus(
  action: ReturnType<typeof UpdateTransactionStatus>,
) {
  try {
    const response: TransactionRead = yield call(
      callApiWithAuth,
      {
        path: `/transactions/${action.payload.id}`,
        method: "PATCH",
        body: { status: action.payload.status },
      },
      { loadingKey: "transaction-status" },
    );
    yield put(upsertTransaction(response));
  } catch (error) {
    yield put(
      setTransactionsError(
        error instanceof Error ? error.message : "Failed to update status",
      ),
    );
  }
}

function* handleDeleteTransaction(
  action: ReturnType<typeof DeleteTransaction>,
) {
  try {
    yield call(
      callApiWithAuth,
      { path: `/transactions/${action.payload}`, method: "DELETE" },
      { loadingKey: "transaction-delete" },
    );
    yield put(removeTransaction(action.payload));
  } catch (error) {
    yield put(
      setTransactionsError(
        error instanceof Error ? error.message : "Failed to delete transaction",
      ),
    );
  }
}

export function* TransactionsSaga() {
  yield takeLatest(FetchTransactions.type, handleFetchTransactions);
  yield takeLatest(FetchRecentTransactions.type, handleFetchRecentTransactions);
  yield takeLatest(CreateTransaction.type, handleCreateTransaction);
  yield takeLatest(UpdateTransaction.type, handleUpdateTransaction);
  yield takeLatest(UpdateTransactionStatus.type, handleUpdateTransactionStatus);
  yield takeLatest(DeleteTransaction.type, handleDeleteTransaction);
}
