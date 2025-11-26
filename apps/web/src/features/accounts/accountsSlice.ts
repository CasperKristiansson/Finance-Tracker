import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AccountWithBalance } from "@/types/api";

export interface AccountsState {
  items: AccountWithBalance[];
  loading: boolean;
  error?: string;
  includeInactive: boolean;
  asOfDate?: string | null;
}

const initialState: AccountsState = {
  items: [],
  loading: false,
  includeInactive: false,
  asOfDate: null,
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
    setAccountsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to load accounts";
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
  },
  selectors: {
    selectAccountsState: (state) => state,
    selectAccounts: (state) => state.items,
    selectAccountsLoading: (state) => state.loading,
    selectAccountsError: (state) => state.error,
  },
});

export const {
  setAccounts,
  setAccountsLoading,
  setAccountsError,
  setAccountsFilters,
} = accountsSlice.actions;
export const {
  selectAccountsState,
  selectAccounts,
  selectAccountsLoading,
  selectAccountsError,
} = accountsSlice.selectors;
export const AccountsReducer = accountsSlice.reducer;
