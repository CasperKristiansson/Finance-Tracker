import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ImportSession } from "@/types/api";

export interface ImportsState {
  session?: ImportSession;
  loading: boolean;
  saving: boolean;
  error?: string;
}

const initialState: ImportsState = {
  session: undefined,
  loading: false,
  saving: false,
};

const importsSlice = createSlice({
  name: "imports",
  initialState,
  reducers: {
    setImportSession(state, action: PayloadAction<ImportSession | undefined>) {
      state.session = action.payload;
      state.error = undefined;
    },
    clearImportSession(state) {
      state.session = undefined;
    },
    setImportsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setImportsSaving(state, action: PayloadAction<boolean>) {
      state.saving = action.payload;
    },
    setImportsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload ?? "Unable to process import job";
    },
  },
  selectors: {
    selectImportsState: (state) => state,
    selectImportSession: (state) => state.session,
    selectImportsLoading: (state) => state.loading,
    selectImportsSaving: (state) => state.saving,
    selectImportsError: (state) => state.error,
  },
});

export const {
  setImportSession,
  clearImportSession,
  setImportsLoading,
  setImportsSaving,
  setImportsError,
} = importsSlice.actions;

export const {
  selectImportsState,
  selectImportSession,
  selectImportsLoading,
  selectImportsSaving,
  selectImportsError,
} = importsSlice.selectors;
export const ImportsReducer = importsSlice.reducer;
