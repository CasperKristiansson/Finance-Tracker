import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  InvestmentTransactionRead,
  InvestmentOverviewResponse,
} from "@/types/api";

export interface InvestmentsState {
  transactions: InvestmentTransactionRead[];
  overview?: InvestmentOverviewResponse;
  loading: boolean;
  updateLoading: boolean;
  error?: string;
  updateError?: string;
}

const initialState: InvestmentsState = {
  transactions: [],
  overview: undefined,
  loading: false,
  updateLoading: false,
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
    setInvestmentsUpdateLoading(state, action: PayloadAction<boolean>) {
      state.updateLoading = action.payload;
    },
    setInvestmentsUpdateError(
      state,
      action: PayloadAction<string | undefined>,
    ) {
      state.updateError = action.payload;
    },
  },
  selectors: {
    selectInvestmentsState: (state) => state,
    selectInvestmentTransactions: (state) => state.transactions,
    selectInvestmentOverview: (state) => state.overview,
    selectInvestmentsLoading: (state) => state.loading,
    selectInvestmentsError: (state) => state.error,
    selectInvestmentsUpdateLoading: (state) => state.updateLoading,
    selectInvestmentsUpdateError: (state) => state.updateError,
  },
});

export const {
  setTransactions,
  setOverview,
  setInvestmentsLoading,
  setInvestmentsError,
  setInvestmentsUpdateLoading,
  setInvestmentsUpdateError,
} = investmentsSlice.actions;

export const {
  selectInvestmentsState,
  selectInvestmentTransactions,
  selectInvestmentOverview,
  selectInvestmentsLoading,
  selectInvestmentsError,
  selectInvestmentsUpdateLoading,
  selectInvestmentsUpdateError,
} = investmentsSlice.selectors;
export const InvestmentsReducer = investmentsSlice.reducer;
