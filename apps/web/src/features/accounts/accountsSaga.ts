import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { demoAccounts } from "@/data/demoPayloads";
import {
  setAccountCreateLoading,
  setAccountMutationError,
  setAccountReconcileError,
  setAccountReconcileLoading,
  setAccountUpdateLoading,
  setAccounts,
  setAccountsError,
  setAccountsFilters,
  setAccountsLoading,
  selectAccountsState,
  selectAccounts,
  type AccountsState,
} from "@/features/accounts/accountsSlice";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectIsDemo } from "@/features/auth/authSlice";
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
  reconcileAccountRequestSchema,
  reconcileAccountResponseSchema,
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
export const ReconcileAccounts = createAction<{
  items: Array<{
    accountId: string;
    capturedAt: string;
    reportedBalance: string;
    description?: string;
    categoryId?: string | null;
  }>;
}>("accounts/reconcile");

function* handleFetchAccounts(action: ReturnType<typeof FetchAccounts>) {
  const stored: AccountsState = yield select(selectAccountsState);
  const filters =
    action.payload ??
    ({
      includeInactive: stored.includeInactive,
      asOfDate: stored.asOfDate,
    } satisfies Partial<Pick<AccountsState, "includeInactive" | "asOfDate">>);
  yield put(setAccountsLoading(true));
  const isDemo: boolean = yield select(selectIsDemo);
  if (action.payload) {
    yield put(setAccountsFilters(action.payload));
  }

  try {
    if (isDemo) {
      yield put(setAccounts(demoAccounts.accounts));
    } else {
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
    }
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body = accountCreateRequestSchema.parse(action.payload);
    if (isDemo) {
      const existing = (yield select(selectAccounts)) as AccountsState["items"];
      const now = new Date().toISOString();
      const newAccount = {
        id: `demo-account-${Date.now()}`,
        name: body.name,
        account_type: body.account_type,
        is_active: body.is_active ?? true,
        icon: body.icon ?? null,
        bank_import_type: body.bank_import_type ?? null,
        created_at: now,
        updated_at: now,
        balance: "0",
        last_reconciled_at: null,
        reconciliation_gap: "0",
        needs_reconciliation: false,
        loan: body.loan
          ? {
              id: `demo-loan-${Date.now()}`,
              account_id: `demo-account-${Date.now()}`,
              origin_principal: body.loan.origin_principal,
              current_principal: body.loan.current_principal,
              interest_rate_annual: body.loan.interest_rate_annual,
              interest_compound: body.loan.interest_compound,
              minimum_payment: body.loan.minimum_payment ?? null,
              expected_maturity_date: body.loan.expected_maturity_date ?? null,
              created_at: now,
              updated_at: now,
            }
          : null,
      };
      yield put(setAccounts([...existing, newAccount]));
      return;
    }

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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body = accountUpdateRequestSchema.parse(data);
    if (isDemo) {
      const existing = (yield select(selectAccounts)) as AccountsState["items"];
      const updated = existing.map((acct) =>
        acct.id === accountId
          ? {
              ...acct,
              ...body,
              updated_at: new Date().toISOString(),
            }
          : acct,
      );
      yield put(setAccounts(updated));
      return;
    }

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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body = loanCreateRequestSchema.parse({ account_id, ...loanData });
    if (isDemo) {
      const existing = (yield select(selectAccounts)) as AccountsState["items"];
      const now = new Date().toISOString();
      const updated = existing.map((acct) =>
        acct.id === account_id
          ? {
              ...acct,
              loan: {
                id: `demo-loan-${Date.now()}`,
                account_id,
                origin_principal: body.origin_principal,
                current_principal: body.current_principal,
                interest_rate_annual: body.interest_rate_annual,
                interest_compound: body.interest_compound,
                minimum_payment: body.minimum_payment ?? null,
                expected_maturity_date: body.expected_maturity_date ?? null,
                created_at: now,
                updated_at: now,
              },
              updated_at: now,
            }
          : acct,
      );
      yield put(setAccounts(updated));
      return;
    }

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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body = loanUpdateRequestSchema.parse(data);
    if (isDemo) {
      const existing = (yield select(selectAccounts)) as AccountsState["items"];
      const now = new Date().toISOString();
      const updated = existing.map((acct) =>
        acct.id === accountId && acct.loan
          ? {
              ...acct,
              loan: {
                ...acct.loan,
                ...body,
                minimum_payment:
                  body.minimum_payment !== undefined
                    ? body.minimum_payment
                    : acct.loan.minimum_payment,
                expected_maturity_date:
                  body.expected_maturity_date !== undefined
                    ? body.expected_maturity_date
                    : acct.loan.expected_maturity_date,
                updated_at: now,
              },
              updated_at: now,
            }
          : acct,
      );
      yield put(setAccounts(updated));
      return;
    }

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

function* handleReconcileAccounts(
  action: ReturnType<typeof ReconcileAccounts>,
) {
  yield put(setAccountReconcileLoading(true));
  yield put(setAccountReconcileError(undefined));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      const existing = (yield select(selectAccounts)) as AccountsState["items"];
      const updated = existing.map((acct) => {
        const match = action.payload.items.find(
          (item) => item.accountId === acct.id,
        );
        if (!match) return acct;
        return {
          ...acct,
          balance: match.reportedBalance,
          last_reconciled_at: match.capturedAt,
          reconciliation_gap: "0",
          needs_reconciliation: false,
          updated_at: match.capturedAt,
        };
      });
      yield put(setAccounts(updated));
      return;
    }

    for (const item of action.payload.items) {
      const body = reconcileAccountRequestSchema.parse({
        captured_at: item.capturedAt,
        reported_balance: item.reportedBalance,
        description: item.description,
        category_id: item.categoryId ?? null,
      });
      yield call(
        callApiWithAuth,
        {
          path: `/accounts/${item.accountId}/reconcile`,
          method: "POST",
          body,
          schema: reconcileAccountResponseSchema,
        },
        { loadingKey: "accounts-reconcile" },
      );
    }
    yield put(FetchAccounts(undefined));
  } catch (error) {
    yield put(
      setAccountReconcileError(
        error instanceof Error ? error.message : "Failed to reconcile accounts",
      ),
    );
  } finally {
    yield put(setAccountReconcileLoading(false));
  }
}

export function* AccountsSaga() {
  yield takeLatest(FetchAccounts.type, handleFetchAccounts);
  yield takeLatest(CreateAccount.type, handleCreateAccount);
  yield takeLatest(UpdateAccount.type, handleUpdateAccount);
  yield takeLatest(ArchiveAccount.type, handleArchiveAccount);
  yield takeLatest(AttachLoan.type, handleAttachLoan);
  yield takeLatest(UpdateLoan.type, handleUpdateLoan);
  yield takeLatest(ReconcileAccounts.type, handleReconcileAccounts);
}
