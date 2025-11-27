import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { API_BASE_URL } from "@/lib/apiClient";
import type { BankTemplateMapping, ThemePreference } from "@/types/api";

export interface BankTemplate {
  id: string;
  name: string;
  description?: string;
  mapping: BankTemplateMapping;
  isDefault?: boolean;
}

export interface EnvEntry {
  key: string;
  value: string;
  label?: string;
}

export interface SettingsState {
  theme: ThemePreference;
  bankTemplates: BankTemplate[];
  apiBaseUrl: string;
  envInfo: EnvEntry[];
  loading: boolean;
  saving: boolean;
  error?: string;
  lastSavedAt?: string;
}

const SETTINGS_STORAGE_KEY = "finance-tracker-settings";
const THEME_STORAGE_KEY = "finance-tracker-theme";

const DEFAULT_BANK_TEMPLATES: BankTemplate[] = [
  {
    id: "default",
    name: "Auto-detect",
    description: "Let the parser infer columns when headers are clear.",
    mapping: { date: "date", description: "description", amount: "amount" },
    isDefault: true,
  },
  {
    id: "nordea",
    name: "Nordea CSV",
    description: "Swedish export with bokföringsdatum/text/belopp columns.",
    mapping: {
      date: "bokforingsdatum",
      description: "text",
      amount: "belopp",
    },
    isDefault: true,
  },
  {
    id: "revolut",
    name: "Revolut CSV",
    description:
      "Standard Revolut export with completed_date/description/amount.",
    mapping: {
      date: "completed_date",
      description: "description",
      amount: "amount",
    },
    isDefault: true,
  },
];

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

const readStoredTheme = (): ThemePreference => {
  if (typeof window === "undefined") return "system";
  const stored =
    (localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null) ??
    (localStorage.getItem("theme") as ThemePreference | null);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
};

const buildEnvEntries = (): EnvEntry[] => {
  const rawEntries: EnvEntry[] = [
    {
      key: "VITE_API_BASE_URL",
      value: import.meta.env.VITE_API_BASE_URL || "Not set",
      label: "API Base URL",
    },
    {
      key: "VITE_USER_POOL_ID",
      value: import.meta.env.VITE_USER_POOL_ID || "Not set",
      label: "Cognito User Pool",
    },
    {
      key: "VITE_USER_POOL_CLIENT_ID",
      value: import.meta.env.VITE_USER_POOL_CLIENT_ID || "Not set",
      label: "Cognito Client",
    },
    {
      key: "VITE_AWS_REGION",
      value: import.meta.env.VITE_AWS_REGION || "Not set",
      label: "AWS Region",
    },
  ];

  return rawEntries.filter(
    (entry, index, all) =>
      all.findIndex((item) => item.key === entry.key) === index,
  );
};

const cachedSettings = safeParseLocalSettings();

const initialState: SettingsState = {
  theme: cachedSettings?.theme ?? readStoredTheme(),
  bankTemplates: cachedSettings?.bankTemplates?.length
    ? cachedSettings.bankTemplates
    : DEFAULT_BANK_TEMPLATES,
  apiBaseUrl: API_BASE_URL,
  envInfo: cachedSettings?.envInfo ?? buildEnvEntries(),
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
      if (payload.theme) state.theme = payload.theme;
      if (payload.bankTemplates) state.bankTemplates = payload.bankTemplates;
      if (payload.apiBaseUrl) state.apiBaseUrl = payload.apiBaseUrl;
      if (payload.envInfo) state.envInfo = payload.envInfo;
      if (payload.lastSavedAt) state.lastSavedAt = payload.lastSavedAt;
      state.error = undefined;
    },
    setThemePreference(state, action: PayloadAction<ThemePreference>) {
      state.theme = action.payload;
      state.error = undefined;
    },
    upsertBankTemplate(state, action: PayloadAction<BankTemplate>) {
      const index = state.bankTemplates.findIndex(
        (item) => item.id === action.payload.id,
      );
      if (index >= 0) {
        const existing = state.bankTemplates[index];
        state.bankTemplates[index] = {
          ...existing,
          ...action.payload,
          isDefault: existing.isDefault,
        };
      } else {
        state.bankTemplates.push(action.payload);
      }
      state.error = undefined;
    },
    removeBankTemplate(state, action: PayloadAction<string>) {
      state.bankTemplates = state.bankTemplates.filter((template) => {
        if (template.isDefault) return true;
        return template.id !== action.payload;
      });
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
    setEnvInfo(state, action: PayloadAction<EnvEntry[]>) {
      state.envInfo = action.payload;
    },
    setLastSavedAt(state, action: PayloadAction<string | undefined>) {
      state.lastSavedAt = action.payload;
    },
  },
  selectors: {
    selectSettingsState: (state) => state,
    selectThemePreference: (state) => state.theme,
    selectBankTemplates: (state) => state.bankTemplates,
    selectEnvInfo: (state) => state.envInfo,
    selectApiBaseUrl: (state) => state.apiBaseUrl,
    selectSettingsSaving: (state) => state.saving,
    selectSettingsLoading: (state) => state.loading,
    selectSettingsError: (state) => state.error,
    selectSettingsLastSavedAt: (state) => state.lastSavedAt,
  },
});

export const {
  hydrateSettings,
  setThemePreference,
  upsertBankTemplate,
  removeBankTemplate,
  setSettingsLoading,
  setSettingsSaving,
  setSettingsError,
  setEnvInfo,
  setLastSavedAt,
} = settingsSlice.actions;

export const {
  selectSettingsState,
  selectThemePreference,
  selectBankTemplates,
  selectEnvInfo,
  selectApiBaseUrl,
  selectSettingsSaving,
  selectSettingsLoading,
  selectSettingsError,
  selectSettingsLastSavedAt,
} = settingsSlice.selectors;

export const SettingsReducer = settingsSlice.reducer;
export { DEFAULT_BANK_TEMPLATES, SETTINGS_STORAGE_KEY, THEME_STORAGE_KEY };
