import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ImportBatch } from "@/types/api";

export interface ImportsState {
  batches: ImportBatch[];
  loading: boolean;
  error?: string;
  polling: boolean;
}

const initialState: ImportsState = {
  batches: [],
  loading: false,
  polling: false,
};

const importsSlice = createSlice({
  name: "imports",
  initialState,
  reducers: {
    setImportBatches(state, action: PayloadAction<ImportBatch[]>) {
      state.batches = action.payload;
      state.error = undefined;
    },
    upsertImportBatch(state, action: PayloadAction<ImportBatch>) {
      const existingIndex = state.batches.findIndex(
        (batch) => batch.id === action.payload.id,
      );
      if (existingIndex >= 0) {
        state.batches[existingIndex] = action.payload;
      } else {
        state.batches.unshift(action.payload);
      }
    },
    setImportsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setImportsPolling(state, action: PayloadAction<boolean>) {
      state.polling = action.payload;
    },
    setImportsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to process import job";
    },
  },
  selectors: {
    selectImportsState: (state) => state,
    selectImportBatches: (state) => state.batches,
    selectImportsLoading: (state) => state.loading,
    selectImportsPolling: (state) => state.polling,
    selectImportsError: (state) => state.error,
  },
});

export const {
  setImportBatches,
  upsertImportBatch,
  setImportsLoading,
  setImportsPolling,
  setImportsError,
} = importsSlice.actions;
export const {
  selectImportsState,
  selectImportBatches,
  selectImportsLoading,
  selectImportsPolling,
  selectImportsError,
} = importsSlice.selectors;
export const ImportsReducer = importsSlice.reducer;
