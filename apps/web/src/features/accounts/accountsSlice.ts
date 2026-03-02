import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AccountWithBalance } from "@/types/api";
import type { EndpointResponse } from "@/types/contracts";

type AccountOption = EndpointResponse<"listAccountOptions">["options"][number];

export interface AccountsState {
  items: AccountWithBalance[];
  options: AccountOption[];
  loading: boolean;
  optionsLoading: boolean;
  error?: string;
  optionsError?: string;
  includeInactive: boolean;
  asOfDate?: string | null;
  createLoading: boolean;
  updateLoading: boolean;
  reconcileLoading: boolean;
  reconcileError?: string;
  mutationError?: string;
}

const initialState: AccountsState = {
  items: [],
  options: [],
  loading: false,
  optionsLoading: false,
  includeInactive: false,
  asOfDate: null,
  createLoading: false,
  updateLoading: false,
  reconcileLoading: false,
};

const accountsSlice = createSlice({
  name: "accounts",
  initialState,
  reducers: {
    setAccounts(state, action: PayloadAction<AccountWithBalance[]>) {
      state.items = action.payload;
      state.error = undefined;
    },
    setAccountOptions(state, action: PayloadAction<AccountOption[]>) {
      state.options = action.payload;
      state.optionsError = undefined;
    },
    setAccountsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setAccountOptionsLoading(state, action: PayloadAction<boolean>) {
      state.optionsLoading = action.payload;
    },
    setAccountCreateLoading(state, action: PayloadAction<boolean>) {
      state.createLoading = action.payload;
    },
    setAccountUpdateLoading(state, action: PayloadAction<boolean>) {
      state.updateLoading = action.payload;
    },
    setAccountReconcileLoading(state, action: PayloadAction<boolean>) {
      state.reconcileLoading = action.payload;
    },
    setAccountsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to load accounts";
    },
    setAccountOptionsError(state, action: PayloadAction<string | undefined>) {
      state.optionsError = action.payload ?? "Unable to load account options";
    },
    setAccountReconcileError(state, action: PayloadAction<string | undefined>) {
      state.reconcileError = action.payload;
    },
    setAccountMutationError(state, action: PayloadAction<string | undefined>) {
      state.mutationError = action.payload;
    },
    setAccountsFilters(
      state,
      action: PayloadAction<{
        includeInactive?: boolean;
        asOfDate?: string | null;
      }>,
    ) {
      if (action.payload.includeInactive !== undefined) {
        state.includeInactive = action.payload.includeInactive;
      }
      if (action.payload.asOfDate !== undefined) {
        state.asOfDate = action.payload.asOfDate;
      }
    },
    resetAccounts: () => initialState,
  },
  selectors: {
    selectAccountsState: (state) => state,
    selectAccounts: (state) => state.items,
    selectAccountOptions: (state) => state.options,
    selectAccountsLoading: (state) => state.loading,
    selectAccountOptionsLoading: (state) => state.optionsLoading,
    selectAccountsError: (state) => state.error,
    selectAccountOptionsError: (state) => state.optionsError,
    selectAccountCreateLoading: (state) => state.createLoading,
    selectAccountUpdateLoading: (state) => state.updateLoading,
    selectAccountReconcileLoading: (state) => state.reconcileLoading,
    selectAccountReconcileError: (state) => state.reconcileError,
    selectAccountMutationError: (state) => state.mutationError,
  },
});

export const {
  setAccounts,
  setAccountOptions,
  setAccountsLoading,
  setAccountOptionsLoading,
  setAccountCreateLoading,
  setAccountUpdateLoading,
  setAccountReconcileLoading,
  setAccountsError,
  setAccountOptionsError,
  setAccountReconcileError,
  setAccountMutationError,
  setAccountsFilters,
  resetAccounts,
} = accountsSlice.actions;
export const {
  selectAccountsState,
  selectAccounts,
  selectAccountOptions,
  selectAccountsLoading,
  selectAccountOptionsLoading,
  selectAccountsError,
  selectAccountOptionsError,
  selectAccountCreateLoading,
  selectAccountUpdateLoading,
  selectAccountReconcileLoading,
  selectAccountReconcileError,
  selectAccountMutationError,
} = accountsSlice.selectors;
export const AccountsReducer = accountsSlice.reducer;
