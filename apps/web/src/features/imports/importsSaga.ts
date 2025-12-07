import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  clearImportSession,
  setImportSession,
  setImportsError,
  setImportsLoading,
  setImportsSaving,
} from "@/features/imports/importsSlice";
import type {
  ImportCommitRequest,
  ImportCreateRequest,
  ImportSessionResponse,
} from "@/types/api";
import {
  importCommitRequestSchema,
  importCreateRequestSchema,
  importSessionResponseSchema,
} from "@/types/schemas";

export const StartImportSession = createAction<ImportCreateRequest>(
  "imports/startSession",
);
export const AppendImportFiles = createAction<
  ImportCreateRequest & { sessionId: string }
>("imports/appendFiles");
export const FetchImportSession = createAction<string>("imports/fetchSession");
export const CommitImportSession = createAction<{
  sessionId: string;
  rows: ImportCommitRequest["rows"];
}>("imports/commitSession");
export const ResetImportSession = createAction("imports/resetSession");

function* handleStartSession(action: ReturnType<typeof StartImportSession>) {
  yield put(setImportsLoading(true));
  try {
    const body = importCreateRequestSchema.parse(action.payload);
    const response: ImportSessionResponse = yield call(
      callApiWithAuth,
      {
        path: "/imports",
        method: "POST",
        body,
        schema: importSessionResponseSchema,
      },
      { loadingKey: "imports" },
    );

    if (response?.import_session) {
      yield put(setImportSession(response.import_session));
      toast.success("Files staged", {
        description: "Review suggestions and save when ready.",
      });
    }
  } catch (error) {
    yield put(
      setImportsError(
        error instanceof Error ? error.message : "Unable to stage import.",
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

function* handleAppendFiles(action: ReturnType<typeof AppendImportFiles>) {
  yield put(setImportsLoading(true));
  try {
    const { sessionId, ...request } = action.payload;
    const body = importCreateRequestSchema.parse(request);
    const response: ImportSessionResponse = yield call(
      callApiWithAuth,
      {
        path: `/imports/${sessionId}/files`,
        method: "POST",
        body,
        schema: importSessionResponseSchema,
      },
      { loadingKey: "imports" },
    );

    if (response?.import_session) {
      yield put(setImportSession(response.import_session));
      toast.success("Files added", {
        description: "New rows are ready for review.",
      });
    }
  } catch (error) {
    yield put(
      setImportsError(
        error instanceof Error ? error.message : "Unable to add files.",
      ),
    );
    toast.error("Upload failed", {
      description:
        error instanceof Error ? error.message : "Please try again shortly.",
    });
  } finally {
    yield put(setImportsLoading(false));
  }
}

function* handleFetchSession(action: ReturnType<typeof FetchImportSession>) {
  yield put(setImportsLoading(true));
  try {
    const response: ImportSessionResponse = yield call(
      callApiWithAuth,
      {
        path: `/imports/${action.payload}`,
        schema: importSessionResponseSchema,
      },
      { loadingKey: "imports", silent: true },
    );
    if (response?.import_session) {
      yield put(setImportSession(response.import_session));
    }
  } catch (error) {
    yield put(
      setImportsError(
        error instanceof Error ? error.message : "Unable to load session.",
      ),
    );
  } finally {
    yield put(setImportsLoading(false));
  }
}

function* handleCommitSession(action: ReturnType<typeof CommitImportSession>) {
  yield put(setImportsSaving(true));
  try {
    const body: ImportCommitRequest = importCommitRequestSchema.parse({
      rows: action.payload.rows,
    });
    yield call(
      callApiWithAuth,
      {
        path: `/imports/${action.payload.sessionId}/commit`,
        method: "POST",
        body,
      },
      { loadingKey: "imports" },
    );

    toast.success("Transactions saved", {
      description: "Your staged transactions are now in the ledger.",
    });
    yield put(clearImportSession());
  } catch (error) {
    yield put(
      setImportsError(
        error instanceof Error ? error.message : "Unable to save transactions.",
      ),
    );
    toast.error("Save failed", {
      description:
        error instanceof Error ? error.message : "Please try again shortly.",
    });
  } finally {
    yield put(setImportsSaving(false));
  }
}

export function* ImportsSaga() {
  yield takeLatest(StartImportSession.type, handleStartSession);
  yield takeLatest(AppendImportFiles.type, handleAppendFiles);
  yield takeLatest(FetchImportSession.type, handleFetchSession);
  yield takeLatest(CommitImportSession.type, handleCommitSession);
  yield takeLatest(ResetImportSession.type, function* () {
    yield put(clearImportSession());
  });
}
