import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TransactionRead } from "@/types/api";

export interface TransactionFilters {
  startDate?: string | null;
  endDate?: string | null;
  accountIds?: string[];
}

export interface TransactionsState {
  items: TransactionRead[];
  loading: boolean;
  error?: string;
  filters: TransactionFilters;
}

const initialState: TransactionsState = {
  items: [],
  loading: false,
  filters: {},
};

const transactionsSlice = createSlice({
  name: "transactions",
  initialState,
  reducers: {
    setTransactions(state, action: PayloadAction<TransactionRead[]>) {
      state.items = action.payload;
      state.error = undefined;
    },
    setTransactionsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setTransactionsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to load transactions";
    },
    setTransactionFilters(state, action: PayloadAction<TransactionFilters>) {
      state.filters = { ...state.filters, ...action.payload };
    },
  },
  selectors: {
    selectTransactionsState: (state) => state,
    selectTransactions: (state) => state.items,
    selectTransactionsLoading: (state) => state.loading,
    selectTransactionsError: (state) => state.error,
    selectTransactionFilters: (state) => state.filters,
  },
});

export const {
  setTransactions,
  setTransactionsLoading,
  setTransactionsError,
  setTransactionFilters,
} = transactionsSlice.actions;
export const {
  selectTransactionsState,
  selectTransactions,
  selectTransactionsLoading,
  selectTransactionsError,
  selectTransactionFilters,
} = transactionsSlice.selectors;
export const TransactionsReducer = transactionsSlice.reducer;
