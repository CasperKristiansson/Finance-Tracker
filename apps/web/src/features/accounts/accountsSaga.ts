import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import {
  setAccountCreateLoading,
  setAccountMutationError,
  setAccountUpdateLoading,
  setAccounts,
  setAccountsError,
  setAccountsFilters,
  setAccountsLoading,
  type AccountsState,
} from "@/features/accounts/accountsSlice";
import { callApiWithAuth } from "@/features/api/apiSaga";
import type {
  AccountCreateRequest,
  AccountListResponse,
  AccountUpdateRequest,
  LoanCreateRequest,
  LoanUpdateRequest,
} from "@/types/api";
import {
  accountCreateRequestSchema,
  accountListSchema,
  accountUpdateRequestSchema,
  loanCreateRequestSchema,
  loanUpdateRequestSchema,
} from "@/types/schemas";

export const FetchAccounts = createAction<
  Partial<Pick<AccountsState, "includeInactive" | "asOfDate">> | undefined
>("accounts/fetch");
export const CreateAccount =
  createAction<AccountCreateRequest>("accounts/create");
export const UpdateAccount = createAction<{
  accountId: string;
  data: AccountUpdateRequest;
}>("accounts/update");
export const ArchiveAccount = createAction<{ accountId: string }>(
  "accounts/archive",
);
export const AttachLoan = createAction<LoanCreateRequest>(
  "accounts/attachLoan",
);
export const UpdateLoan = createAction<{
  accountId: string;
  data: LoanUpdateRequest;
}>("accounts/updateLoan");

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
      { path: "/accounts", query, schema: accountListSchema },
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

function* handleCreateAccount(action: ReturnType<typeof CreateAccount>) {
  yield put(setAccountCreateLoading(true));
  yield put(setAccountMutationError(undefined));
  try {
    const body = accountCreateRequestSchema.parse(action.payload);
    yield call(
      callApiWithAuth,
      { path: "/accounts", method: "POST", body },
      { loadingKey: "accounts-create" },
    );
    yield put(FetchAccounts(undefined));
  } catch (error) {
    yield put(
      setAccountMutationError(
        error instanceof Error ? error.message : "Failed to create account",
      ),
    );
  } finally {
    yield put(setAccountCreateLoading(false));
  }
}

function* handleUpdateAccount(action: ReturnType<typeof UpdateAccount>) {
  const { accountId, data } = action.payload;
  yield put(setAccountUpdateLoading(true));
  yield put(setAccountMutationError(undefined));
  try {
    const body = accountUpdateRequestSchema.parse(data);
    yield call(
      callApiWithAuth,
      { path: `/accounts/${accountId}`, method: "PATCH", body },
      { loadingKey: "accounts-update" },
    );
    yield put(FetchAccounts(undefined));
  } catch (error) {
    yield put(
      setAccountMutationError(
        error instanceof Error ? error.message : "Failed to update account",
      ),
    );
  } finally {
    yield put(setAccountUpdateLoading(false));
  }
}

function* handleArchiveAccount(action: ReturnType<typeof ArchiveAccount>) {
  yield* handleUpdateAccount(
    UpdateAccount({
      accountId: action.payload.accountId,
      data: { is_active: false },
    }) as ReturnType<typeof UpdateAccount>,
  );
}

function* handleAttachLoan(action: ReturnType<typeof AttachLoan>) {
  const { account_id, ...loanData } = action.payload;
  yield put(setAccountUpdateLoading(true));
  yield put(setAccountMutationError(undefined));
  try {
    const body = loanCreateRequestSchema.parse({ account_id, ...loanData });
    yield call(
      callApiWithAuth,
      { path: "/loans", method: "POST", body },
      { loadingKey: "loan-attach" },
    );
    yield put(FetchAccounts(undefined));
  } catch (error) {
    yield put(
      setAccountMutationError(
        error instanceof Error ? error.message : "Failed to attach loan",
      ),
    );
  } finally {
    yield put(setAccountUpdateLoading(false));
  }
}

function* handleUpdateLoan(action: ReturnType<typeof UpdateLoan>) {
  const { accountId, data } = action.payload;
  yield put(setAccountUpdateLoading(true));
  yield put(setAccountMutationError(undefined));
  try {
    const body = loanUpdateRequestSchema.parse(data);
    yield call(
      callApiWithAuth,
      { path: `/accounts/${accountId}/loan`, method: "PATCH", body },
      { loadingKey: "loan-update" },
    );
    yield put(FetchAccounts(undefined));
  } catch (error) {
    yield put(
      setAccountMutationError(
        error instanceof Error ? error.message : "Failed to update loan",
      ),
    );
  } finally {
    yield put(setAccountUpdateLoading(false));
  }
}

export function* AccountsSaga() {
  yield takeLatest(FetchAccounts.type, handleFetchAccounts);
  yield takeLatest(CreateAccount.type, handleCreateAccount);
  yield takeLatest(UpdateAccount.type, handleUpdateAccount);
  yield takeLatest(ArchiveAccount.type, handleArchiveAccount);
  yield takeLatest(AttachLoan.type, handleAttachLoan);
  yield takeLatest(UpdateLoan.type, handleUpdateLoan);
}
