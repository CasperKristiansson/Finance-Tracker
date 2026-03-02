import { createAction } from "@reduxjs/toolkit";
import type { SagaIterator } from "redux-saga";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { demoAccounts } from "@/data/demoPayloads";
import {
  setAccountOptions,
  setAccountOptionsError,
  setAccountOptionsLoading,
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
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import type { EndpointRequest, EndpointResponse } from "@/types/contracts";

export const FetchAccounts = createAction<
  Partial<Pick<AccountsState, "includeInactive" | "asOfDate">> | undefined
>("accounts/fetch");
export const FetchAccountOptions = createAction<
  Pick<AccountsState, "includeInactive"> | undefined
>("accounts/fetchOptions");
export const CreateAccount =
  createAction<EndpointRequest<"createAccount">>("accounts/create");
export const UpdateAccount = createAction<{
  accountId: string;
  data: EndpointRequest<"updateAccount">;
}>("accounts/update");
export const ArchiveAccount = createAction<{ accountId: string }>(
  "accounts/archive",
);
export const AttachLoan = createAction<EndpointRequest<"createLoan">>(
  "accounts/attachLoan",
);
export const UpdateLoan = createAction<{
  accountId: string;
  data: EndpointRequest<"updateLoan">;
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

function* handleFetchAccounts(
  action: ReturnType<typeof FetchAccounts>,
): SagaIterator {
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

      const response: EndpointResponse<"listAccounts"> = yield call(
        callApiWithAuth,
        buildEndpointRequest("listAccounts", {
          query,
        }),
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

function* handleFetchAccountOptions(
  action: ReturnType<typeof FetchAccountOptions>,
): SagaIterator {
  const stored: AccountsState = yield select(selectAccountsState);
  const includeInactive =
    action.payload?.includeInactive ?? stored.includeInactive;
  yield put(setAccountOptionsLoading(true));
  const isDemo: boolean = yield select(selectIsDemo);

  try {
    if (isDemo) {
      const options = demoAccounts.accounts.map((account) => ({
        id: account.id,
        name: account.name,
        account_type: account.account_type,
        is_active: account.is_active,
        icon: account.icon,
        bank_import_type: account.bank_import_type,
      }));
      yield put(setAccountOptions(options));
      return;
    }

    const response: EndpointResponse<"listAccountOptions"> = yield call(
      callApiWithAuth,
      buildEndpointRequest("listAccountOptions", {
        query: {
          include_inactive: includeInactive,
        },
      }),
      { loadingKey: "account-options" },
    );
    yield put(setAccountOptions(response.options));
  } catch (error) {
    yield put(
      setAccountOptionsError(
        error instanceof Error
          ? error.message
          : "Failed to load account options",
      ),
    );
  } finally {
    yield put(setAccountOptionsLoading(false));
  }
}

function* handleCreateAccount(
  action: ReturnType<typeof CreateAccount>,
): SagaIterator {
  yield put(setAccountCreateLoading(true));
  yield put(setAccountMutationError(undefined));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body: EndpointRequest<"createAccount"> = action.payload;
    if (isDemo) {
      const existing = (yield select(selectAccounts)) as AccountsState["items"];
      const now = new Date().toISOString();
      const accountId = `demo-account-${Date.now()}`;
      const newAccount = {
        id: accountId,
        name: body.name ?? "Untitled account",
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
              account_id: accountId,
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
      buildEndpointRequest("createAccount", { body }),
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

function* handleUpdateAccount(
  action: ReturnType<typeof UpdateAccount>,
): SagaIterator {
  const { accountId, data } = action.payload;
  yield put(setAccountUpdateLoading(true));
  yield put(setAccountMutationError(undefined));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body: EndpointRequest<"updateAccount"> = data;
    if (isDemo) {
      const existing = (yield select(selectAccounts)) as AccountsState["items"];
      const updated = existing.map((acct) =>
        acct.id === accountId
          ? {
              ...acct,
              name: body.name ?? acct.name,
              is_active: body.is_active ?? acct.is_active,
              icon: body.icon !== undefined ? body.icon : (acct.icon ?? null),
              bank_import_type:
                body.bank_import_type !== undefined
                  ? body.bank_import_type
                  : (acct.bank_import_type ?? null),
              updated_at: new Date().toISOString(),
            }
          : acct,
      );
      yield put(setAccounts(updated));
      return;
    }

    yield call(
      callApiWithAuth,
      buildEndpointRequest("updateAccount", {
        pathParams: { accountId },
        body,
      }),
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

function* handleArchiveAccount(
  action: ReturnType<typeof ArchiveAccount>,
): SagaIterator {
  yield call(
    handleUpdateAccount,
    UpdateAccount({
      accountId: action.payload.accountId,
      data: { is_active: false },
    }) as ReturnType<typeof UpdateAccount>,
  );
}

function* handleAttachLoan(
  action: ReturnType<typeof AttachLoan>,
): SagaIterator {
  const { account_id, ...loanData } = action.payload;
  yield put(setAccountUpdateLoading(true));
  yield put(setAccountMutationError(undefined));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body: EndpointRequest<"createLoan"> = { account_id, ...loanData };
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

    yield call(callApiWithAuth, buildEndpointRequest("createLoan", { body }), {
      loadingKey: "loan-attach",
    });
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

function* handleUpdateLoan(
  action: ReturnType<typeof UpdateLoan>,
): SagaIterator {
  const { accountId, data } = action.payload;
  yield put(setAccountUpdateLoading(true));
  yield put(setAccountMutationError(undefined));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body: EndpointRequest<"updateLoan"> = data;
    if (isDemo) {
      const existing = (yield select(selectAccounts)) as AccountsState["items"];
      const now = new Date().toISOString();
      const updated = existing.map((acct) =>
        acct.id === accountId && acct.loan
          ? {
              ...acct,
              loan: {
                ...acct.loan,
                origin_principal:
                  body.origin_principal ?? acct.loan.origin_principal,
                current_principal:
                  body.current_principal ?? acct.loan.current_principal,
                interest_rate_annual:
                  body.interest_rate_annual ?? acct.loan.interest_rate_annual,
                interest_compound:
                  body.interest_compound ?? acct.loan.interest_compound,
                minimum_payment:
                  body.minimum_payment != null
                    ? body.minimum_payment
                    : acct.loan.minimum_payment,
                expected_maturity_date:
                  body.expected_maturity_date != null
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
      buildEndpointRequest("updateLoan", {
        pathParams: { accountId },
        body,
      }),
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
): SagaIterator {
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
      const body: EndpointRequest<"reconcileAccount"> = {
        captured_at: item.capturedAt,
        reported_balance: item.reportedBalance,
        description: item.description,
        category_id: item.categoryId ?? null,
      };
      yield call(
        callApiWithAuth,
        buildEndpointRequest("reconcileAccount", {
          pathParams: { accountId: item.accountId },
          body,
        }),
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

export function* AccountsSaga(): SagaIterator {
  yield takeLatest(FetchAccounts.type, handleFetchAccounts);
  yield takeLatest(FetchAccountOptions.type, handleFetchAccountOptions);
  yield takeLatest(CreateAccount.type, handleCreateAccount);
  yield takeLatest(UpdateAccount.type, handleUpdateAccount);
  yield takeLatest(ArchiveAccount.type, handleArchiveAccount);
  yield takeLatest(AttachLoan.type, handleAttachLoan);
  yield takeLatest(UpdateLoan.type, handleUpdateLoan);
  yield takeLatest(ReconcileAccounts.type, handleReconcileAccounts);
}
