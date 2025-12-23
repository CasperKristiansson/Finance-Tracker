import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { TypedSelect } from "@/app/rootSaga";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { ApiError } from "@/lib/apiClient";
import type {
  BackupRunResponse,
  SettingsPayload,
  SettingsResponse,
} from "@/types/api";
import {
  backupRunResponseSchema,
  settingsPayloadSchema,
  settingsResponseSchema,
} from "@/types/schemas";
import { selectIsDemo, selectToken } from "../auth/authSlice";
import {
  SETTINGS_STORAGE_KEY,
  hydrateSettings,
  setBackingUp,
  selectSettingsState,
  setLastSavedAt,
  setSettingsError,
  setSettingsLoading,
  setSettingsSaving,
  type SettingsState,
} from "./settingsSlice";

export const LoadSettings = createAction("settings/load");
export const SaveSettings = createAction("settings/save");
export const RunBackup = createAction("settings/run-backup");

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
    firstName: state.firstName,
    lastName: state.lastName,
    currencyCode: state.currencyCode,
    lastSavedAt: overrideTimestamp ?? state.lastSavedAt,
  };
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
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
          firstName: response.settings.first_name || undefined,
          lastName: response.settings.last_name || undefined,
          currencyCode: response.settings.currency_code || undefined,
        };
        yield put(hydrateSettings(payload));
        const currentState: SettingsState =
          yield* TypedSelect(selectSettingsState);
        persistLocalSettings(currentState);
      }
    } catch (error) {
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
    const token: string | undefined = yield* TypedSelect(selectToken);
    const isDemo: boolean = yield* TypedSelect(selectIsDemo);

    if (!token || isDemo) {
      persistLocalSettings(state, timestamp);
      yield put(setLastSavedAt(timestamp));
      toast.success("Profile saved", {
        description: "Cached locally on this device.",
      });
      return;
    }

    try {
      const payload: SettingsPayload = settingsPayloadSchema.parse({
        first_name: state.firstName,
        last_name: state.lastName,
        currency_code: state.currencyCode,
      });
      yield call(
        callApiWithAuth,
        {
          path: "/settings",
          method: "PUT",
          body: { settings: payload },
        },
        { loadingKey: "settings", silent: true },
      );
      persistLocalSettings(state, timestamp);
      yield put(setLastSavedAt(timestamp));
      toast.success("Profile saved", {
        description: "Synced with the database.",
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        toast.error("Could not sync profile", {
          description: "The profile endpoint is not available.",
        });
      } else {
        const message = error instanceof Error ? error.message : undefined;
        toast.error("Could not sync profile", { description: message });
        yield put(setSettingsError(message));
      }
    }
  } finally {
    yield put(setSettingsSaving(false));
  }
}

function* handleRunBackup() {
  yield put(setBackingUp(true));
  try {
    const token: string | undefined = yield* TypedSelect(selectToken);
    const isDemo: boolean = yield* TypedSelect(selectIsDemo);

    if (!token || isDemo) {
      toast.error("Backups unavailable", {
        description: "Sign in with a full account to run backups.",
      });
      return;
    }

    try {
      yield call(
        callApiWithAuth<BackupRunResponse>,
        {
          path: "/backups/transactions",
          method: "POST",
          schema: backupRunResponseSchema,
        },
        { loadingKey: "settings", silent: true },
      );
      toast.success("Backup created", {
        description: "Transactions have been backed up for all users.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : undefined;
      toast.error("Could not run backup", { description: message });
    }
  } finally {
    yield put(setBackingUp(false));
  }
}

export function* SettingsSaga() {
  yield takeLatest(LoadSettings.type, handleLoadSettings);
  yield takeLatest(SaveSettings.type, handleSaveSettings);
  yield takeLatest(RunBackup.type, handleRunBackup);
}
