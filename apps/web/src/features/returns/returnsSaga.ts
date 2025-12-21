import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { z } from "zod";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setReturns,
  setReturnsError,
  setReturnsLoading,
  setReturnStatusFilter,
  selectReturnsState,
  type ReturnAction,
  type ReturnsState,
} from "@/features/returns/returnsSlice";
import type { ReturnListResponse } from "@/types/api";
import {
  returnActionRequestSchema,
  returnListSchema,
  returnSummarySchema,
} from "@/types/schemas";

export const FetchReturns = createAction<
  { status?: ReturnsState["statusFilter"] } | undefined
>("returns/fetch");
export const UpdateReturn = createAction<{
  transactionId: string;
  action: ReturnAction;
}>("returns/update");

function* handleFetchReturns(action: ReturnType<typeof FetchReturns>) {
  const statusFilter = action.payload?.status;
  if (statusFilter) {
    yield put(setReturnStatusFilter(statusFilter));
  }
  const state: ReturnsState = yield select(selectReturnsState);
  yield put(setReturnsLoading(true));

  try {
    const query =
      state.statusFilter && state.statusFilter !== "all"
        ? { status: state.statusFilter }
        : {};

    const response: ReturnListResponse = yield call(
      callApiWithAuth,
      { path: "/returns", query, schema: returnListSchema },
      { loadingKey: "returns-list" },
    );
    yield put(setReturns(response.returns));
  } catch (error) {
    yield put(
      setReturnsError(
        error instanceof Error ? error.message : "Failed to load returns",
      ),
    );
  } finally {
    yield put(setReturnsLoading(false));
  }
}

function* handleUpdateReturn(action: ReturnType<typeof UpdateReturn>) {
  try {
    const body = returnActionRequestSchema.parse({
      transaction_id: action.payload.transactionId,
      action: action.payload.action,
    });
    const updateResponseSchema = z.union([
      returnSummarySchema,
      z.object({
        return_id: z.string(),
        detached: z.boolean().optional(),
        status: z.string().optional(),
      }),
    ]);

    yield call(
      callApiWithAuth,
      {
        path: "/returns",
        method: "POST",
        body,
        schema: updateResponseSchema,
      },
      { loadingKey: "returns-update" },
    );
    const state: ReturnsState = yield select(selectReturnsState);
    yield call(
      handleFetchReturns,
      FetchReturns({ status: state.statusFilter }),
    );
  } catch (error) {
    yield put(
      setReturnsError(
        error instanceof Error ? error.message : "Failed to update return",
      ),
    );
  }
}

export function* ReturnsSaga() {
  yield takeLatest(FetchReturns.type, handleFetchReturns);
  yield takeLatest(UpdateReturn.type, handleUpdateReturn);
}
