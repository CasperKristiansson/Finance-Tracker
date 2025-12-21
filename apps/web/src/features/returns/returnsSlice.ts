import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ReturnSummary, ReturnStatus } from "@/types/api";

export type ReturnAction = "mark_processed" | "detach";

export interface ReturnsState {
  items: ReturnSummary[];
  loading: boolean;
  error?: string;
  statusFilter: ReturnStatus | "all";
}

const initialState: ReturnsState = {
  items: [],
  loading: false,
  statusFilter: "all",
};

const returnsSlice = createSlice({
  name: "returns",
  initialState,
  reducers: {
    setReturns(state, action: PayloadAction<ReturnSummary[]>) {
      state.items = action.payload;
      state.error = undefined;
    },
    setReturnsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setReturnsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to load returns";
    },
    setReturnStatusFilter(state, action: PayloadAction<ReturnStatus | "all">) {
      state.statusFilter = action.payload;
    },
    resetReturns: () => initialState,
  },
  selectors: {
    selectReturnsState: (state) => state,
  },
});

export const {
  setReturns,
  setReturnsLoading,
  setReturnsError,
  setReturnStatusFilter,
  resetReturns,
} = returnsSlice.actions;
export const { selectReturnsState } = returnsSlice.selectors;
export const ReturnsReducer = returnsSlice.reducer;
