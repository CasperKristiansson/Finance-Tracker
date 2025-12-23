import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  InvestmentTransactionRead,
  InvestmentMetricsResponse,
  InvestmentOverviewResponse,
} from "@/types/api";

export interface InvestmentsState {
  transactions: InvestmentTransactionRead[];
  metrics?: InvestmentMetricsResponse["performance"];
  overview?: InvestmentOverviewResponse;
  loading: boolean;
  error?: string;
}

const initialState: InvestmentsState = {
  transactions: [],
  overview: undefined,
  loading: false,
};

const investmentsSlice = createSlice({
  name: "investments",
  initialState,
  reducers: {
    setTransactions(state, action: PayloadAction<InvestmentTransactionRead[]>) {
      state.transactions = action.payload;
      state.error = undefined;
    },
    setMetrics(
      state,
      action: PayloadAction<
        InvestmentMetricsResponse["performance"] | undefined
      >,
    ) {
      state.metrics = action.payload;
    },
    setOverview(state, action: PayloadAction<InvestmentOverviewResponse>) {
      state.overview = action.payload;
      state.error = undefined;
    },
    setInvestmentsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setInvestmentsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to load investment data.";
    },
  },
  selectors: {
    selectInvestmentsState: (state) => state,
    selectInvestmentTransactions: (state) => state.transactions,
    selectInvestmentMetrics: (state) => state.metrics,
    selectInvestmentOverview: (state) => state.overview,
    selectInvestmentsLoading: (state) => state.loading,
    selectInvestmentsError: (state) => state.error,
  },
});

export const {
  setTransactions,
  setMetrics,
  setOverview,
  setInvestmentsLoading,
  setInvestmentsError,
} = investmentsSlice.actions;

export const {
  selectInvestmentsState,
  selectInvestmentTransactions,
  selectInvestmentMetrics,
  selectInvestmentOverview,
  selectInvestmentsLoading,
  selectInvestmentsError,
} = investmentsSlice.selectors;
export const InvestmentsReducer = investmentsSlice.reducer;
