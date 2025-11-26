import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import {
  setAccounts,
  setAccountsError,
  setAccountsFilters,
  setAccountsLoading,
  type AccountsState,
} from "@/features/accounts/accountsSlice";
import { callApiWithAuth } from "@/features/api/apiSaga";
import type { AccountListResponse } from "@/types/api";

export const FetchAccounts = createAction<
  Partial<Pick<AccountsState, "includeInactive" | "asOfDate">> | undefined
>("accounts/fetch");

function* handleFetchAccounts(action: ReturnType<typeof FetchAccounts>) {
  const filters = action.payload ?? {};
  yield put(setAccountsLoading(true));
  if (action.payload) {
    yield put(setAccountsFilters(action.payload));
  }

  try {
    const query = {
      include_inactive: filters.includeInactive ?? false,
      ...(filters.asOfDate ? { as_of_date: filters.asOfDate } : {}),
    };

    const response: AccountListResponse = yield call(
      callApiWithAuth,
      { path: "/accounts", query },
      { loadingKey: "accounts" },
    );

    yield put(setAccounts(response.accounts));
  } catch (error) {
    yield put(
      setAccountsError(
        error instanceof Error ? error.message : "Failed to load accounts",
      ),
    );
  } finally {
    yield put(setAccountsLoading(false));
  }
}

export function* AccountsSaga() {
  yield takeLatest(FetchAccounts.type, handleFetchAccounts);
}
