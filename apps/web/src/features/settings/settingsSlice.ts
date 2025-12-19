import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface SettingsState {
  firstName?: string;
  lastName?: string;
  currencyCode?: string;
  loading: boolean;
  saving: boolean;
  error?: string;
  lastSavedAt?: string;
}

const SETTINGS_STORAGE_KEY = "finance-tracker-settings";

const safeParseLocalSettings = (): Partial<SettingsState> | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as Partial<SettingsState>;
  } catch (error) {
    console.warn("Failed to parse cached settings", error);
    return undefined;
  }
};

const cachedSettings = safeParseLocalSettings();

const initialState: SettingsState = {
  firstName: cachedSettings?.firstName,
  lastName: cachedSettings?.lastName,
  currencyCode: cachedSettings?.currencyCode,
  loading: false,
  saving: false,
  error: undefined,
  lastSavedAt: cachedSettings?.lastSavedAt,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    hydrateSettings(state, action: PayloadAction<Partial<SettingsState>>) {
      const payload = action.payload;
      if (payload.firstName !== undefined)
        state.firstName = payload.firstName || undefined;
      if (payload.lastName !== undefined)
        state.lastName = payload.lastName || undefined;
      if (payload.currencyCode !== undefined)
        state.currencyCode = payload.currencyCode || undefined;
      if (payload.lastSavedAt) state.lastSavedAt = payload.lastSavedAt;
      state.error = undefined;
    },
    setSettingsLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setSettingsSaving(state, action: PayloadAction<boolean>) {
      state.saving = action.payload;
    },
    setSettingsError(state, action: PayloadAction<string | undefined>) {
      state.error = action.payload;
    },
    setLastSavedAt(state, action: PayloadAction<string | undefined>) {
      state.lastSavedAt = action.payload;
    },
    setCurrencyCode(state, action: PayloadAction<string | undefined>) {
      state.currencyCode = action.payload || undefined;
    },
    setFirstName(state, action: PayloadAction<string>) {
      state.firstName = action.payload;
    },
    setLastName(state, action: PayloadAction<string>) {
      state.lastName = action.payload;
    },
  },
  selectors: {
    selectSettingsState: (state) => state,
    selectFirstName: (state) => state.firstName,
    selectLastName: (state) => state.lastName,
    selectSettingsSaving: (state) => state.saving,
    selectSettingsLoading: (state) => state.loading,
    selectSettingsError: (state) => state.error,
    selectSettingsLastSavedAt: (state) => state.lastSavedAt,
    selectCurrencyCode: (state) => state.currencyCode,
  },
});

export const {
  hydrateSettings,
  setSettingsLoading,
  setSettingsSaving,
  setSettingsError,
  setLastSavedAt,
  setFirstName,
  setLastName,
  setCurrencyCode,
} = settingsSlice.actions;

export const {
  selectSettingsState,
  selectFirstName,
  selectLastName,
  selectSettingsSaving,
  selectSettingsLoading,
  selectSettingsError,
  selectSettingsLastSavedAt,
  selectCurrencyCode,
} = settingsSlice.selectors;

export const SettingsReducer = settingsSlice.reducer;
export { SETTINGS_STORAGE_KEY };
