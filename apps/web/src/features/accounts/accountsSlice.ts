import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AccountWithBalance } from "@/types/api";

export interface AccountsState {
  items: AccountWithBalance[];
  loading: boolean;
  error?: string;
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
  loading: false,
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
    setAccountsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
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
    selectAccountsLoading: (state) => state.loading,
    selectAccountsError: (state) => state.error,
    selectAccountCreateLoading: (state) => state.createLoading,
    selectAccountUpdateLoading: (state) => state.updateLoading,
    selectAccountReconcileLoading: (state) => state.reconcileLoading,
    selectAccountReconcileError: (state) => state.reconcileError,
    selectAccountMutationError: (state) => state.mutationError,
  },
});

export const {
  setAccounts,
  setAccountsLoading,
  setAccountCreateLoading,
  setAccountUpdateLoading,
  setAccountReconcileLoading,
  setAccountsError,
  setAccountReconcileError,
  setAccountMutationError,
  setAccountsFilters,
  resetAccounts,
} = accountsSlice.actions;
export const {
  selectAccountsState,
  selectAccounts,
  selectAccountsLoading,
  selectAccountsError,
  selectAccountCreateLoading,
  selectAccountUpdateLoading,
  selectAccountReconcileLoading,
  selectAccountReconcileError,
  selectAccountMutationError,
} = accountsSlice.selectors;
export const AccountsReducer = accountsSlice.reducer;
