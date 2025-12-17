import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ImportPreviewResponse } from "@/types/api";

export interface ImportsState {
  preview?: ImportPreviewResponse;
  loading: boolean;
  saving: boolean;
  error?: string;
}

const initialState: ImportsState = {
  preview: undefined,
  loading: false,
  saving: false,
};

const importsSlice = createSlice({
  name: "imports",
  initialState,
  reducers: {
    setImportPreview(
      state,
      action: PayloadAction<ImportPreviewResponse | undefined>,
    ) {
      state.preview = action.payload;
      state.error = undefined;
    },
    clearImportPreview(state) {
      state.preview = undefined;
    },
    setImportsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setImportsSaving(state, action: PayloadAction<boolean>) {
      state.saving = action.payload;
    },
    setImportsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;
    },
    clearImportsError(state) {
      state.error = undefined;
    },
  },
  selectors: {
    selectImportPreview: (state) => state.preview,
    selectImportsLoading: (state) => state.loading,
    selectImportsSaving: (state) => state.saving,
    selectImportsError: (state) => state.error,
  },
});

export const {
  setImportPreview,
  clearImportPreview,
  setImportsLoading,
  setImportsSaving,
  setImportsError,
  clearImportsError,
} = importsSlice.actions;

export const {
  selectImportPreview,
  selectImportsLoading,
  selectImportsSaving,
  selectImportsError,
} = importsSlice.selectors;

export const ImportsReducer = importsSlice.reducer;
