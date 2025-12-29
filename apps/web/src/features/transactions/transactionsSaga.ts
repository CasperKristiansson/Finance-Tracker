import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { demoTransactionsResponse } from "@/data/demoPayloads";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectIsDemo } from "@/features/auth/authSlice";
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
  TransactionUpdateRequest,
} from "@/types/api";
import { TransactionType } from "@/types/enums";
import {
  transactionCreateSchema,
  transactionListSchema,
  transactionSchema,
  transactionUpdateRequestSchema,
} from "@/types/schemas";

export const FetchTransactions = createAction<TransactionFilters | undefined>(
  "transactions/fetch",
);
export const FetchRecentTransactions = createAction<{
  limit?: number;
  accountIds?: string[];
  transactionTypes?: string[];
}>("transactions/fetchRecent");
export const CreateTransaction = createAction<TransactionCreate>(
  "transactions/create",
);
export const UpdateTransaction = createAction<{
  id: string;
  data: TransactionUpdateRequest;
}>("transactions/update");
export const DeleteTransaction = createAction<string>("transactions/delete");

const serializeAccounts = (ids?: string[]) => {
  if (!ids || ids.length === 0) return undefined;
  return ids.join(",");
};

function* handleFetchTransactions(
  action: ReturnType<typeof FetchTransactions>,
) {
  const stored: TransactionFilters = yield select(selectTransactionFilters);
  const filters = { ...stored, ...(action.payload ?? {}) };
  yield put(setTransactionsLoading(true));
  const isDemo: boolean = yield select(selectIsDemo);
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
      ...(filters.transactionTypes?.length
        ? { transaction_type: filters.transactionTypes.join(",") }
        : {}),
      ...(filters.categoryIds?.length
        ? { category_ids: filters.categoryIds.join(",") }
        : {}),
      ...(filters.subscriptionIds?.length
        ? { subscription_ids: filters.subscriptionIds.join(",") }
        : {}),
      ...(filters.minAmount ? { min_amount: filters.minAmount } : {}),
      ...(filters.maxAmount ? { max_amount: filters.maxAmount } : {}),
      ...(filters.search ? { search: filters.search } : {}),
      ...(filters.taxEvent !== undefined
        ? { tax_event: filters.taxEvent }
        : {}),
      ...(filters.sortBy ? { sort_by: filters.sortBy } : {}),
      ...(filters.sortDir ? { sort_dir: filters.sortDir } : {}),
      limit,
      offset,
    };

    if (isDemo) {
      const existing: TransactionRead[] = yield select(selectTransactions);
      const source = demoTransactionsResponse.transactions;
      const combined = offset > 0 ? [...existing, ...source] : source;
      yield put(setTransactions(combined));
      if (demoTransactionsResponse.running_balances) {
        yield put(
          setRunningBalances(demoTransactionsResponse.running_balances),
        );
      }
      yield put(
        setPagination({
          limit,
          offset,
          hasMore: false,
        }),
      );
    } else {
      const response: TransactionListResponse = yield call(
        callApiWithAuth,
        { path: "/transactions", query, schema: transactionListSchema },
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
    }
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
  const isDemo: boolean = yield select(selectIsDemo);

  try {
    const query = {
      limit,
      ...(serializeAccounts(action.payload?.accountIds)
        ? { account_ids: serializeAccounts(action.payload?.accountIds) }
        : {}),
      ...(action.payload?.transactionTypes?.length
        ? { transaction_type: action.payload.transactionTypes.join(",") }
        : {}),
    };

    if (isDemo) {
      const trimmed = demoTransactionsResponse.transactions.slice(0, limit);
      yield put(setRecentTransactions(trimmed));
    } else {
      const response: TransactionListResponse = yield call(
        callApiWithAuth,
        { path: "/transactions", query, schema: transactionListSchema },
        { loadingKey: "transactions-recent" },
      );

      const trimmed = response.transactions.slice(0, limit);
      yield put(setRecentTransactions(trimmed));
    }
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body = transactionCreateSchema.parse(action.payload);
    if (isDemo) {
      const now = new Date().toISOString();
      const newTx: TransactionRead = {
        id: `demo-tx-${Date.now()}`,
        category_id: body.category_id ?? null,
        subscription_id: body.subscription_id ?? null,
        transaction_type: body.transaction_type ?? TransactionType.EXPENSE,
        description: body.description ?? "",
        notes: body.notes ?? null,
        external_id: body.external_id ?? null,
        occurred_at: body.occurred_at ?? now,
        posted_at: body.posted_at ?? now,
        created_at: now,
        updated_at: now,
        legs: body.legs.map((leg, idx) => ({
          id: `demo-leg-${Date.now()}-${idx}`,
          account_id: leg.account_id,
          amount: leg.amount,
        })),
      };
      yield put(upsertTransaction(newTx));
      const balances = (yield select(
        (state) => state.transactions.runningBalances,
      )) as Record<string, number>;
      const updatedBalances = { ...balances };
      body.legs.forEach((leg) => {
        const prev = updatedBalances[leg.account_id] ?? 0;
        const delta = parseFloat(String(leg.amount)) || 0;
        updatedBalances[leg.account_id] = prev + delta;
      });
      yield put(setRunningBalances(updatedBalances));
      return;
    }

    const response: TransactionRead = yield call(
      callApiWithAuth,
      {
        path: "/transactions",
        method: "POST",
        body,
        schema: transactionSchema,
      },
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body = transactionUpdateRequestSchema.parse(action.payload.data);
    if (isDemo) {
      const existing: TransactionRead[] = yield select(selectTransactions);
      const updated = existing.map((tx) =>
        tx.id === action.payload.id
          ? {
              ...tx,
              ...body,
              occurred_at: body.occurred_at ?? tx.occurred_at,
              posted_at: body.posted_at ?? tx.posted_at,
              category_id: body.category_id ?? tx.category_id,
              subscription_id: body.subscription_id ?? tx.subscription_id,
              updated_at: new Date().toISOString(),
            }
          : tx,
      );
      yield put(setTransactions(updated));
      return;
    }

    const response: TransactionRead = yield call(
      callApiWithAuth,
      {
        path: `/transactions/${action.payload.id}`,
        method: "PATCH",
        body,
        schema: transactionSchema,
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

function* handleDeleteTransaction(
  action: ReturnType<typeof DeleteTransaction>,
) {
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(removeTransaction(action.payload));
      return;
    }

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
  yield takeLatest(DeleteTransaction.type, handleDeleteTransaction);
}
