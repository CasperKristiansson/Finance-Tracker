import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ImportJob } from "@/types/api";

export interface ImportsState {
  jobs: ImportJob[];
  loading: boolean;
  error?: string;
}

const initialState: ImportsState = {
  jobs: [],
  loading: false,
};

const importsSlice = createSlice({
  name: "imports",
  initialState,
  reducers: {
    setImportJobs(state, action: PayloadAction<ImportJob[]>) {
      state.jobs = action.payload;
      state.error = undefined;
    },
    upsertImportJob(state, action: PayloadAction<ImportJob>) {
      const existingIndex = state.jobs.findIndex(
        (job) => job.id === action.payload.id,
      );
      if (existingIndex >= 0) {
        state.jobs[existingIndex] = action.payload;
      } else {
        state.jobs.unshift(action.payload);
      }
    },
    setImportsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setImportsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to process import job";
    },
  },
  selectors: {
    selectImportsState: (state) => state,
    selectImportJobs: (state) => state.jobs,
    selectImportsLoading: (state) => state.loading,
    selectImportsError: (state) => state.error,
  },
});

export const {
  setImportJobs,
  upsertImportJob,
  setImportsLoading,
  setImportsError,
} = importsSlice.actions;
export const {
  selectImportsState,
  selectImportJobs,
  selectImportsLoading,
  selectImportsError,
} = importsSlice.selectors;
export const ImportsReducer = importsSlice.reducer;
