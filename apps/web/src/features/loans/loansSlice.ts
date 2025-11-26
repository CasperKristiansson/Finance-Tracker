import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { LoanEventRead, LoanScheduleRead } from "@/types/api";

export interface LoansState {
  schedules: Record<string, LoanScheduleRead>;
  events: Record<string, LoanEventRead[]>;
  loading: Record<string, boolean>;
  error?: string;
}

const initialState: LoansState = {
  schedules: {},
  events: {},
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
    selectLoanLoading: (state) => state.loading,
    selectLoanError: (state) => state.error,
  },
});

export const { setLoanSchedule, setLoanEvents, setLoanLoading, setLoanError } =
  loansSlice.actions;
export const {
  selectLoanState,
  selectLoanSchedule,
  selectLoanEvents,
  selectLoanLoading,
  selectLoanError,
} = loansSlice.selectors;
export const LoansReducer = loansSlice.reducer;
