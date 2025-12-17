import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  clearImportPreview,
  clearImportsError,
  setImportPreview,
  setImportsError,
  setImportsLoading,
  setImportsSaving,
} from "@/features/imports/importsSlice";
import type {
  ImportCommitRequest,
  ImportCommitResponse,
  ImportPreviewRequest,
  ImportPreviewResponse,
} from "@/types/api";
import {
  importCommitRequestSchema,
  importCommitResponseSchema,
  importPreviewRequestSchema,
  importPreviewResponseSchema,
} from "@/types/schemas";

export const PreviewImports =
  createAction<ImportPreviewRequest>("imports/preview");
export const CommitImports =
  createAction<ImportCommitRequest>("imports/commit");
export const ResetImports = createAction("imports/reset");

function* handlePreview(action: ReturnType<typeof PreviewImports>) {
  yield put(setImportsLoading(true));
  yield put(clearImportsError());
  try {
    const body = importPreviewRequestSchema.parse(action.payload);
    const response: ImportPreviewResponse = yield call(
      callApiWithAuth,
      {
        path: "/imports/preview",
        method: "POST",
        body,
        schema: importPreviewResponseSchema,
      },
      { loadingKey: "imports" },
    );

    yield put(setImportPreview(response));
    toast.success("Files parsed", {
      description: "Review transactions and submit when ready.",
    });
  } catch (error) {
    yield put(
      setImportsError(
        error instanceof Error ? error.message : "Unable to parse files.",
      ),
    );
    toast.error("Parse failed", {
      description:
        error instanceof Error ? error.message : "Please try again shortly.",
    });
  } finally {
    yield put(setImportsLoading(false));
  }
}

function* handleCommit(action: ReturnType<typeof CommitImports>) {
  yield put(setImportsSaving(true));
  yield put(clearImportsError());
  try {
    const body: ImportCommitRequest = importCommitRequestSchema.parse(
      action.payload,
    );
    const response: ImportCommitResponse = yield call(
      callApiWithAuth,
      {
        path: "/imports/commit",
        method: "POST",
        body,
        schema: importCommitResponseSchema,
      },
      { loadingKey: "imports" },
    );
    const parsed = importCommitResponseSchema.parse(response);

    toast.success("Transactions saved", {
      description: `Batch ${parsed.import_batch_id.slice(0, 8)} created.`,
    });
    yield put(clearImportPreview());
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
  yield takeLatest(PreviewImports.type, handlePreview);
  yield takeLatest(CommitImports.type, handleCommit);
  yield takeLatest(ResetImports.type, function* () {
    yield put(clearImportPreview());
    yield put(clearImportsError());
  });
}
