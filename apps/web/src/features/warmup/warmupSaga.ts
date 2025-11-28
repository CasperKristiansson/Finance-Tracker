import { createAction } from "@reduxjs/toolkit";
import { call, delay, put, takeLatest } from "redux-saga/effects";
import { TypedSelect } from "@/app/rootSaga";
import { apiFetch, ApiError } from "@/lib/apiClient";
import type { WarmupResponse } from "@/types/api";
import {
  recordWarmupAttempt,
  selectWarmupState,
  startWarmup,
  updateWarmupNote,
  warmupFailed,
  warmupReady,
  type WarmupState,
} from "./warmupSlice";

export const BeginWarmup = createAction("warmup/begin");

export const WARMUP_MAX_ATTEMPTS = 6;
const RETRY_DELAY_MS = 8000;

const describeWarmupError = (error: unknown): string | undefined => {
  if (error instanceof ApiError) {
    if (typeof error.details === "string") return error.details;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return undefined;
};

function* performWarmup() {
  const state: WarmupState = yield* TypedSelect(selectWarmupState);
  if (state.status === "warming" || state.status === "ready") return;

  yield put(startWarmup());

  for (let attempt = 1; attempt <= WARMUP_MAX_ATTEMPTS; attempt += 1) {
    const attemptNote =
      attempt === 1
        ? "Waking Aurora so your data is ready."
        : `Still waiting for Aurora - attempt ${attempt}/${WARMUP_MAX_ATTEMPTS}`;
    yield put(recordWarmupAttempt({ attempt, note: attemptNote }));

    try {
      const { data } = (yield call(apiFetch<WarmupResponse>, {
        path: "/warmup",
        method: "GET",
        retryCount: 1,
      })) as { data: WarmupResponse };

      if (data?.status === "ready") {
        yield put(warmupReady());
        return;
      }

      const message =
        data?.message ??
        "Database is scaling up from zero. Retrying automatically.";
      yield put(updateWarmupNote(message));
    } catch (error) {
      const message = describeWarmupError(error);

      if (attempt >= WARMUP_MAX_ATTEMPTS) {
        yield put(
          warmupFailed(
            message ??
              "Could not confirm that the database is awake. Please retry.",
          ),
        );
        return;
      }

      if (message) {
        yield put(updateWarmupNote(message));
      }
    }

    if (attempt < WARMUP_MAX_ATTEMPTS) {
      yield delay(RETRY_DELAY_MS);
    }
  }

  yield put(
    warmupFailed(
      "Database warmup timed out. Please retry or refresh the page.",
    ),
  );
}

export function* WarmupSaga() {
  yield takeLatest(BeginWarmup.type, performWarmup);
}
