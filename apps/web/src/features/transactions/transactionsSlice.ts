import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { TransactionRead } from "@/types/api";

export interface TransactionFilters {
  startDate?: string | null;
  endDate?: string | null;
  accountIds?: string[];
  limit?: number;
  offset?: number;
  categoryIds?: string[];
  subscriptionIds?: string[];
  minAmount?: string;
  maxAmount?: string;
  search?: string;
  sortBy?: "occurred_at" | "amount" | "description" | "category" | "type";
  sortDir?: "asc" | "desc";
}

export interface TransactionsState {
  items: TransactionRead[];
  loading: boolean;
  error?: string;
  filters: TransactionFilters;
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  runningBalances: Record<string, number>;
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
  pagination: {
    limit: 50,
    offset: 0,
    hasMore: true,
  },
  runningBalances: {},
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
    setRunningBalances(
      state,
      action: PayloadAction<Record<string, number | string>>,
    ) {
      const next: Record<string, number> = {};
      Object.entries(action.payload).forEach(([key, value]) => {
        const numeric = typeof value === "string" ? parseFloat(value) : value;
        if (Number.isFinite(numeric)) {
          next[key] = Number(numeric);
        }
      });
      state.runningBalances = next;
    },
    upsertTransaction(state, action: PayloadAction<TransactionRead>) {
      const idx = state.items.findIndex((tx) => tx.id === action.payload.id);
      if (idx >= 0) {
        state.items[idx] = action.payload;
      } else {
        state.items.unshift(action.payload);
      }
    },
    removeTransaction(state, action: PayloadAction<string>) {
      state.items = state.items.filter((tx) => tx.id !== action.payload);
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
    setPagination(
      state,
      action: PayloadAction<Partial<TransactionsState["pagination"]>>,
    ) {
      state.pagination = { ...state.pagination, ...action.payload };
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
    selectRunningBalanceByAccount: (state) => state.runningBalances,
    selectTransactionsLoading: (state) => state.loading,
    selectTransactionsError: (state) => state.error,
    selectTransactionFilters: (state) => state.filters,
    selectTransactionsPagination: (state) => state.pagination,
    selectRecentTransactions: (state) => state.recent,
  },
});

export const {
  setTransactions,
  upsertTransaction,
  removeTransaction,
  setTransactionsLoading,
  setTransactionsError,
  setTransactionFilters,
  setPagination,
  setRecentTransactions,
  setRecentLoading,
  setRecentError,
  setRecentLimit,
  setRunningBalances,
  resetTransactions,
} = transactionsSlice.actions;
export const {
  selectTransactionsState,
  selectTransactions,
  selectRunningBalanceByAccount,
  selectTransactionsLoading,
  selectTransactionsError,
  selectTransactionFilters,
  selectTransactionsPagination,
  selectRecentTransactions,
} = transactionsSlice.selectors;
export const TransactionsReducer = transactionsSlice.reducer;
