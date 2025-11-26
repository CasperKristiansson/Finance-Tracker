import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest, delay, race, take } from "redux-saga/effects";
import { toast } from "sonner";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setImportBatches,
  setImportsError,
  setImportsLoading,
  upsertImportBatch,
  setImportsPolling,
} from "@/features/imports/importsSlice";
import type {
  ImportBatch,
  ImportCreateRequest,
  ImportListResponse,
} from "@/types/api";

export const FetchImportBatches = createAction("imports/fetchAll");
export const UploadImportBatch =
  createAction<ImportCreateRequest>("imports/upload");
export const StartImportPolling = createAction<number | undefined>(
  "imports/startPolling",
);
export const StopImportPolling = createAction("imports/stopPolling");

function* handleFetchImports() {
  yield put(setImportsLoading(true));
  try {
    const response: ImportListResponse = yield call(
      callApiWithAuth,
      { path: "/imports" },
      { loadingKey: "imports", silent: true },
    );

    if (response?.imports) {
      yield put(setImportBatches(response.imports));
    }
  } catch (error) {
    yield put(
      setImportsError(
        error instanceof Error
          ? error.message
          : "Unable to load imports right now.",
      ),
    );
  } finally {
    yield put(setImportsLoading(false));
  }
}

function* handlePollImports(action: ReturnType<typeof StartImportPolling>) {
  const intervalMs = action.payload ?? 10000;
  yield put(setImportsPolling(true));
  try {
    while (true) {
      yield call(handleFetchImports);
      const { stopped } = yield race({
        stopped: take(StopImportPolling.type),
        delayed: delay(intervalMs),
      });
      if (stopped) break;
    }
  } finally {
    yield put(setImportsPolling(false));
  }
}

function* handleUploadImportBatch(
  action: ReturnType<typeof UploadImportBatch>,
) {
  yield put(setImportsLoading(true));
  try {
    const response: ImportListResponse = yield call(
      callApiWithAuth,
      {
        path: "/imports",
        method: "POST",
        body: action.payload,
      },
      { loadingKey: "imports" },
    );

    const batches: ImportBatch[] = response?.imports ?? [];
    batches.forEach((batch) => {
      yield put(upsertImportBatch(batch));
    });

    toast.success("Import received", {
      description:
        "Files uploaded. Processing will continue in the background.",
    });
  } catch (error) {
    yield put(
      setImportsError(
        error instanceof Error ? error.message : "Unable to upload import.",
      ),
    );
    toast.error("Import failed", {
      description:
        error instanceof Error ? error.message : "Please try again shortly.",
    });
  } finally {
    yield put(setImportsLoading(false));
  }
}

export function* ImportsSaga() {
  yield takeLatest(FetchImportBatches.type, handleFetchImports);
  yield takeLatest(UploadImportBatch.type, handleUploadImportBatch);
  yield takeLatest(StartImportPolling.type, handlePollImports);
  yield takeLatest(StopImportPolling.type, function* () {
    yield put(setImportsPolling(false));
  });
}
