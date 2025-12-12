import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type WarmupPhase = "idle" | "warming" | "ready" | "failed";

export interface WarmupState {
  status: WarmupPhase;
  attempts: number;
  startedAt?: string;
  lastAttemptAt?: string;
  note?: string;
  lastError?: string;
}

const initialState: WarmupState = {
  status: "idle",
  attempts: 0,
};

const warmupSlice = createSlice({
  name: "warmup",
  initialState,
  reducers: {
    startWarmup(state) {
      const now = new Date().toISOString();
      state.status = "warming";
      state.attempts = 0;
      state.startedAt = now;
      state.lastAttemptAt = now;
      state.note = "Sending a wake-up ping to the database.";
      state.lastError = undefined;
    },
    recordWarmupAttempt(
      state,
      action: PayloadAction<{ attempt: number; note?: string }>,
    ) {
      state.status = "warming";
      state.attempts = action.payload.attempt;
      state.lastAttemptAt = new Date().toISOString();
      if (action.payload.note) {
        state.note = action.payload.note;
      }
    },
    updateWarmupNote(state, action: PayloadAction<string | undefined>) {
      state.note = action.payload;
    },
    warmupReady(state) {
      state.status = "ready";
      state.note = "Database is awake and ready.";
      state.lastError = undefined;
    },
    warmupFailed(state, action: PayloadAction<string | undefined>) {
      state.status = "failed";
      state.lastError = action.payload;
    },
    resetWarmup() {
      return initialState;
    },
  },
  selectors: {
    selectWarmupState: (state) => state,
  },
});

export const {
  startWarmup,
  recordWarmupAttempt,
  updateWarmupNote,
  warmupReady,
  warmupFailed,
  resetWarmup,
} = warmupSlice.actions;

export const { selectWarmupState } = warmupSlice.selectors;

export const WarmupReducer = warmupSlice.reducer;
