import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { TypedSelect } from "@/app/rootSaga";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { ApiError } from "@/lib/apiClient";
import type {
  SettingsPayload,
  SettingsResponse,
  ThemePreference,
} from "@/types/api";
import { settingsResponseSchema } from "@/types/schemas";
import { selectIsDemo, selectToken } from "../auth/authSlice";
import {
  SETTINGS_STORAGE_KEY,
  THEME_STORAGE_KEY,
  hydrateSettings,
  selectSettingsState,
  setLastSavedAt,
  setSettingsError,
  setSettingsLoading,
  setSettingsSaving,
  setThemePreference,
  type SettingsState,
} from "./settingsSlice";

export const LoadSettings = createAction("settings/load");
export const SaveSettings = createAction("settings/save");

const readCachedSettings = (): Partial<SettingsState> | undefined => {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as Partial<SettingsState>;
  } catch (error) {
    console.warn("Failed to read cached settings", error);
    return undefined;
  }
};

const persistLocalSettings = (
  state: SettingsState,
  overrideTimestamp?: string,
): void => {
  if (typeof window === "undefined") return;
  const payload: Partial<SettingsState> = {
    theme: state.theme,
    firstName: state.firstName,
    lastName: state.lastName,
    envInfo: state.envInfo,
    lastSavedAt: overrideTimestamp ?? state.lastSavedAt,
  };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
};

const persistThemeSelection = (theme: ThemePreference) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  localStorage.setItem("theme", theme);
};

function* handleLoadSettings() {
  yield put(setSettingsLoading(true));
  try {
    const cached = readCachedSettings();
    if (cached) {
      yield put(
        hydrateSettings({
          ...cached,
        }),
      );
    }

    const token: string | undefined = yield* TypedSelect(selectToken);
    const isDemo: boolean = yield* TypedSelect(selectIsDemo);

    if (!token || isDemo) {
      return;
    }

    try {
      const response: SettingsResponse = yield call(
        callApiWithAuth,
        { path: "/settings", schema: settingsResponseSchema },
        { loadingKey: "settings", silent: true },
      );
      if (response?.settings) {
        const payload: Partial<SettingsState> = {
          theme: response.settings.theme,
          firstName: response.settings.first_name || undefined,
          lastName: response.settings.last_name || undefined,
        };
        yield put(hydrateSettings(payload));
        const currentState: SettingsState =
          yield* TypedSelect(selectSettingsState);
        persistLocalSettings(currentState);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        // Backend settings endpoint not available; rely on cached defaults.
        return;
      }
      const message = error instanceof Error ? error.message : "Unknown error";
      yield put(setSettingsError(message));
    }
  } finally {
    yield put(setSettingsLoading(false));
  }
}

function* handleSaveSettings() {
  yield put(setSettingsSaving(true));
  yield put(setSettingsError(undefined));
  const timestamp = new Date().toISOString();
  try {
    const state: SettingsState = yield* TypedSelect(selectSettingsState);
    persistLocalSettings(state, timestamp);
    yield put(setLastSavedAt(timestamp));

    try {
      const payload: SettingsPayload = {
        theme: state.theme,
        first_name: state.firstName,
        last_name: state.lastName,
      };
      yield call(
        callApiWithAuth,
        {
          path: "/settings",
          method: "PUT",
          body: { settings: payload },
        },
        { loadingKey: "settings", silent: true },
      );
      toast.success("Settings saved", {
        description: "Synced with the API and cached locally.",
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        toast.message("Saved locally", {
          description:
            "API settings endpoint is unavailable; using local copy.",
        });
      } else {
        const message = error instanceof Error ? error.message : undefined;
        toast.error("Could not sync settings", { description: message });
        yield put(setSettingsError(message));
      }
    }
  } finally {
    yield put(setSettingsSaving(false));
  }
}

function* handleThemeChange(action: ReturnType<typeof setThemePreference>) {
  try {
    persistThemeSelection(action.payload);
    const state: SettingsState = yield* TypedSelect(selectSettingsState);
    persistLocalSettings({ ...state, theme: action.payload });
  } catch (error) {
    console.warn("Unable to persist theme preference", error);
  }
}

export function* SettingsSaga() {
  yield takeLatest(LoadSettings.type, handleLoadSettings);
  yield takeLatest(SaveSettings.type, handleSaveSettings);
  yield takeLatest(setThemePreference.type, handleThemeChange);
}
