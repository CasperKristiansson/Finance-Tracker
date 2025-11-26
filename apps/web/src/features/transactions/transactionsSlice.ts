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
  recent: {
    items: TransactionRead[];
    loading: boolean;
    error?: string;
    limit: number;
  };
}

const initialState: TransactionsState = {
  items: [],
  loading: false,
  filters: {},
  recent: {
    items: [],
    loading: false,
    limit: 5,
  },
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
    setRecentTransactions(state, action: PayloadAction<TransactionRead[]>) {
      state.recent.items = action.payload;
      state.recent.error = undefined;
    },
    setRecentLoading(state, action: PayloadAction<boolean>) {
      state.recent.loading = action.payload;
    },
    setRecentError(state, action: PayloadAction<string | undefined>) {
      state.recent.error =
        action.payload ?? "Unable to load recent transactions";
    },
    setRecentLimit(state, action: PayloadAction<number>) {
      state.recent.limit = action.payload;
    },
    resetTransactions: () => initialState,
  },
  selectors: {
    selectTransactionsState: (state) => state,
    selectTransactions: (state) => state.items,
    selectTransactionsLoading: (state) => state.loading,
    selectTransactionsError: (state) => state.error,
    selectTransactionFilters: (state) => state.filters,
    selectRecentTransactions: (state) => state.recent,
  },
});

export const {
  setTransactions,
  setTransactionsLoading,
  setTransactionsError,
  setTransactionFilters,
  setRecentTransactions,
  setRecentLoading,
  setRecentError,
  setRecentLimit,
  resetTransactions,
} = transactionsSlice.actions;
export const {
  selectTransactionsState,
  selectTransactions,
  selectTransactionsLoading,
  selectTransactionsError,
  selectTransactionFilters,
  selectRecentTransactions,
} = transactionsSlice.selectors;
export const TransactionsReducer = transactionsSlice.reducer;
