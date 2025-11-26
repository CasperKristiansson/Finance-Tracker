import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setImportJobs,
  setImportsError,
  setImportsLoading,
  upsertImportJob,
} from "@/features/imports/importsSlice";
import type { ImportJob } from "@/types/api";

export const FetchImportJobs = createAction("imports/fetchAll");
export const RegisterImportJob = createAction<ImportJob>(
  "imports/registerLocalJob",
);

function* handleFetchImports() {
  yield put(setImportsLoading(true));
  try {
    const response: { jobs?: ImportJob[] } = yield call(
      callApiWithAuth,
      { path: "/imports" },
      { loadingKey: "imports", silent: true },
    );

    if (response?.jobs) {
      yield put(setImportJobs(response.jobs));
    }
  } catch (error) {
    yield put(
      setImportsError(
        error instanceof Error
          ? error.message
          : "Imports API is not wired yet; backend endpoints will supply jobs when ready.",
      ),
    );
  } finally {
    yield put(setImportsLoading(false));
  }
}

function* handleRegisterImportJob(
  action: ReturnType<typeof RegisterImportJob>,
) {
  yield put(upsertImportJob(action.payload));
  toast.info("Import job added locally", {
    description:
      "Backend wiring pending; this will sync once endpoints are live.",
  });
}

export function* ImportsSaga() {
  yield takeLatest(FetchImportJobs.type, handleFetchImports);
  yield takeLatest(RegisterImportJob.type, handleRegisterImportJob);
}
