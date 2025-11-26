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
  mutationError?: string;
}

const initialState: AccountsState = {
  items: [],
  loading: false,
  includeInactive: false,
  asOfDate: null,
  createLoading: false,
  updateLoading: false,
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
    setAccountsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to load accounts";
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
    selectAccountMutationError: (state) => state.mutationError,
  },
});

export const {
  setAccounts,
  setAccountsLoading,
  setAccountCreateLoading,
  setAccountUpdateLoading,
  setAccountsError,
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
  selectAccountMutationError,
} = accountsSlice.selectors;
export const AccountsReducer = accountsSlice.reducer;
