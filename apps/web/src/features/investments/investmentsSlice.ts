import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { InvestmentSnapshot, NordnetParseResponse } from "@/types/api";

export interface InvestmentsState {
  snapshots: InvestmentSnapshot[];
  loading: boolean;
  saving: boolean;
  parseLoading: Record<string, boolean>;
  parsedResults: Record<string, NordnetParseResponse>;
  lastSavedClientId?: string;
  error?: string;
}

const initialState: InvestmentsState = {
  snapshots: [],
  loading: false,
  saving: false,
  parseLoading: {},
  parsedResults: {},
};

const investmentsSlice = createSlice({
  name: "investments",
  initialState,
  reducers: {
    setSnapshots(state, action: PayloadAction<InvestmentSnapshot[]>) {
      state.snapshots = action.payload;
      state.error = undefined;
    },
    upsertSnapshot(state, action: PayloadAction<InvestmentSnapshot>) {
      const existingIndex = state.snapshots.findIndex(
        (snap) => snap.id === action.payload.id,
      );
      if (existingIndex >= 0) {
        state.snapshots[existingIndex] = action.payload;
      } else {
        state.snapshots = [...state.snapshots, action.payload];
      }
      state.error = undefined;
    },
    setInvestmentsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setInvestmentsSaving(state, action: PayloadAction<boolean>) {
      state.saving = action.payload;
    },
    setInvestmentsError(state, action: PayloadAction<string | undefined>) {
      state.error =
        action.payload ?? "Unable to load or save investment snapshots.";
    },
    setParseLoading(
      state,
      action: PayloadAction<{ clientId: string; loading: boolean }>,
    ) {
      state.parseLoading[action.payload.clientId] = action.payload.loading;
    },
    setParseResult(
      state,
      action: PayloadAction<{ clientId: string; result: NordnetParseResponse }>,
    ) {
      state.parsedResults[action.payload.clientId] = action.payload.result;
      state.parseLoading[action.payload.clientId] = false;
    },
    clearParseResult(state, action: PayloadAction<string>) {
      delete state.parsedResults[action.payload];
      delete state.parseLoading[action.payload];
    },
    setLastSavedClientId(state, action: PayloadAction<string | undefined>) {
      state.lastSavedClientId = action.payload;
    },
  },
  selectors: {
    selectInvestmentsState: (state) => state,
    selectInvestmentSnapshots: (state) => state.snapshots,
    selectInvestmentsLoading: (state) => state.loading,
    selectInvestmentsSaving: (state) => state.saving,
    selectInvestmentsError: (state) => state.error,
    selectParseLoading: (state) => state.parseLoading,
    selectParsedResults: (state) => state.parsedResults,
    selectLastSavedClientId: (state) => state.lastSavedClientId,
  },
});

export const {
  setSnapshots,
  upsertSnapshot,
  setInvestmentsLoading,
  setInvestmentsSaving,
  setInvestmentsError,
  setParseLoading,
  setParseResult,
  clearParseResult,
  setLastSavedClientId,
} = investmentsSlice.actions;

export const {
  selectInvestmentsState,
  selectInvestmentSnapshots,
  selectInvestmentsLoading,
  selectInvestmentsSaving,
  selectInvestmentsError,
  selectParseLoading,
  selectParsedResults,
  selectLastSavedClientId,
} = investmentsSlice.selectors;
export const InvestmentsReducer = investmentsSlice.reducer;
