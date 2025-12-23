import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  LoanEventRead,
  LoanPortfolioSeriesPoint,
  LoanScheduleRead,
} from "@/types/api";

export interface LoansState {
  schedules: Record<string, LoanScheduleRead>;
  events: Record<string, LoanEventRead[]>;
  portfolioSeries: LoanPortfolioSeriesPoint[];
  loading: Record<string, boolean>;
  error?: string;
}

const initialState: LoansState = {
  schedules: {},
  events: {},
  portfolioSeries: [],
  loading: {},
};

const loansSlice = createSlice({
  name: "loans",
  initialState,
  reducers: {
    setLoanSchedule(
      state,
      action: PayloadAction<{ accountId: string; schedule: LoanScheduleRead }>,
    ) {
      state.schedules[action.payload.accountId] = action.payload.schedule;
      state.error = undefined;
    },
    setLoanEvents(
      state,
      action: PayloadAction<{ accountId: string; events: LoanEventRead[] }>,
    ) {
      state.events[action.payload.accountId] = action.payload.events;
      state.error = undefined;
    },
    setLoanPortfolioSeries(
      state,
      action: PayloadAction<{ series: LoanPortfolioSeriesPoint[] }>,
    ) {
      state.portfolioSeries = action.payload.series;
      state.error = undefined;
    },
    setLoanLoading(
      state,
      action: PayloadAction<{ key: string; isLoading: boolean }>,
    ) {
      state.loading[action.payload.key] = action.payload.isLoading;
    },
    setLoanError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to load loan data";
    },
  },
  selectors: {
    selectLoanState: (state) => state,
    selectLoanSchedule: (state) => state.schedules,
    selectLoanEvents: (state) => state.events,
    selectLoanPortfolioSeries: (state) => state.portfolioSeries,
    selectLoanLoading: (state) => state.loading,
    selectLoanError: (state) => state.error,
  },
});

export const {
  setLoanSchedule,
  setLoanEvents,
  setLoanPortfolioSeries,
  setLoanLoading,
  setLoanError,
} = loansSlice.actions;
export const {
  selectLoanState,
  selectLoanSchedule,
  selectLoanEvents,
  selectLoanPortfolioSeries,
  selectLoanLoading,
  selectLoanError,
} = loansSlice.selectors;
export const LoansReducer = loansSlice.reducer;
