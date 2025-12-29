import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type {
  ImportCategorySuggestionRead,
  ImportFileRead,
  ImportPreviewResponse,
} from "@/types/api";

export interface ImportsState {
  preview?: ImportPreviewResponse;
  loading: boolean;
  saving: boolean;
  suggesting: boolean;
  suggestions: Record<string, ImportCategorySuggestionRead>;
  suggestionsError?: string;
  error?: string;
  storedFiles: ImportFileRead[];
  storedFilesLoading: boolean;
  storedFilesError?: string;
}

const initialState: ImportsState = {
  preview: undefined,
  loading: false,
  saving: false,
  suggesting: false,
  suggestions: {},
  storedFiles: [],
  storedFilesLoading: false,
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
      state.suggestions = {};
      state.suggestionsError = undefined;
    },
    clearImportPreview(state) {
      state.preview = undefined;
      state.suggestions = {};
      state.suggestionsError = undefined;
    },
    setImportsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setImportsSaving(state, action: PayloadAction<boolean>) {
      state.saving = action.payload;
    },
    setImportsSuggesting(state, action: PayloadAction<boolean>) {
      state.suggesting = action.payload;
    },
    setImportSuggestions(
      state,
      action: PayloadAction<Record<string, ImportCategorySuggestionRead>>,
    ) {
      state.suggestions = action.payload;
      state.suggestionsError = undefined;
    },
    setImportsSuggestionsError(
      state,
      action: PayloadAction<string | undefined>,
    ) {
      state.suggestionsError = action.payload;
    },
    setImportsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;
    },
    clearImportsError(state) {
      state.error = undefined;
    },
    setStoredImportFiles(state, action: PayloadAction<ImportFileRead[]>) {
      state.storedFiles = action.payload;
      state.storedFilesError = undefined;
    },
    setStoredImportFilesLoading(state, action: PayloadAction<boolean>) {
      state.storedFilesLoading = action.payload;
    },
    setStoredImportFilesError(
      state,
      action: PayloadAction<string | undefined>,
    ) {
      state.storedFilesError = action.payload;
    },
  },
  selectors: {
    selectImportPreview: (state) => state.preview,
    selectImportsLoading: (state) => state.loading,
    selectImportsSaving: (state) => state.saving,
    selectImportsSuggesting: (state) => state.suggesting,
    selectImportSuggestions: (state) => state.suggestions,
    selectImportsSuggestionsError: (state) => state.suggestionsError,
    selectImportsError: (state) => state.error,
    selectStoredImportFiles: (state) => state.storedFiles,
    selectStoredImportFilesLoading: (state) => state.storedFilesLoading,
    selectStoredImportFilesError: (state) => state.storedFilesError,
  },
});

export const {
  setImportPreview,
  clearImportPreview,
  setImportsLoading,
  setImportsSaving,
  setImportsSuggesting,
  setImportSuggestions,
  setImportsSuggestionsError,
  setImportsError,
  clearImportsError,
  setStoredImportFiles,
  setStoredImportFilesLoading,
  setStoredImportFilesError,
} = importsSlice.actions;

export const {
  selectImportPreview,
  selectImportsLoading,
  selectImportsSaving,
  selectImportsSuggesting,
  selectImportSuggestions,
  selectImportsSuggestionsError,
  selectImportsError,
  selectStoredImportFiles,
  selectStoredImportFilesLoading,
  selectStoredImportFilesError,
} = importsSlice.selectors;

export const ImportsReducer = importsSlice.reducer;
