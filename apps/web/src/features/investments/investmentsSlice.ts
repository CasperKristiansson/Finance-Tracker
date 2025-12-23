import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  InvestmentTransactionRead,
  InvestmentOverviewResponse,
} from "@/types/api";

export interface InvestmentsState {
  transactions: InvestmentTransactionRead[];
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
    selectInvestmentOverview: (state) => state.overview,
    selectInvestmentsLoading: (state) => state.loading,
    selectInvestmentsError: (state) => state.error,
  },
});

export const {
  setTransactions,
  setOverview,
  setInvestmentsLoading,
  setInvestmentsError,
} = investmentsSlice.actions;

export const {
  selectInvestmentsState,
  selectInvestmentTransactions,
  selectInvestmentOverview,
  selectInvestmentsLoading,
  selectInvestmentsError,
} = investmentsSlice.selectors;
export const InvestmentsReducer = investmentsSlice.reducer;
