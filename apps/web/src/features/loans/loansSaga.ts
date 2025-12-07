import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setLoanError,
  setLoanEvents,
  setLoanLoading,
  setLoanSchedule,
} from "@/features/loans/loansSlice";
import type { LoanEventRead, LoanScheduleRead } from "@/types/api";
import { loanEventsResponseSchema, loanScheduleSchema } from "@/types/schemas";

export const FetchLoanSchedule = createAction<{
  accountId: string;
  asOfDate?: string;
  periods?: number;
}>("loans/fetchSchedule");

export const FetchLoanEvents = createAction<{
  accountId: string;
  limit?: number;
  offset?: number;
}>("loans/fetchEvents");

function* handleFetchSchedule(action: ReturnType<typeof FetchLoanSchedule>) {
  const { accountId, asOfDate, periods } = action.payload;
  const loadingKey = `loan-schedule-${accountId}`;
  yield put(setLoanLoading({ key: loadingKey, isLoading: true }));

  try {
    const query = {
      ...(asOfDate ? { as_of_date: asOfDate } : {}),
      ...(periods ? { periods } : {}),
    };

    const response: LoanScheduleRead = yield call(
      callApiWithAuth,
      {
        path: `/loans/${accountId}/schedule`,
        query,
        schema: loanScheduleSchema,
      },
      { loadingKey },
    );

    yield put(setLoanSchedule({ accountId, schedule: response }));
  } catch (error) {
    yield put(
      setLoanError(
        error instanceof Error ? error.message : "Failed to load loan schedule",
      ),
    );
  } finally {
    yield put(setLoanLoading({ key: loadingKey, isLoading: false }));
  }
}

function* handleFetchEvents(action: ReturnType<typeof FetchLoanEvents>) {
  const { accountId, limit, offset } = action.payload;
  const loadingKey = `loan-events-${accountId}`;
  yield put(setLoanLoading({ key: loadingKey, isLoading: true }));

  try {
    const query = {
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
    };

    const response: { events: LoanEventRead[] } = yield call(
      callApiWithAuth,
      {
        path: `/loans/${accountId}/events`,
        query,
        schema: loanEventsResponseSchema,
      },
      { loadingKey },
    );

    yield put(setLoanEvents({ accountId, events: response.events }));
  } catch (error) {
    yield put(
      setLoanError(
        error instanceof Error ? error.message : "Failed to load loan events",
      ),
    );
  } finally {
    yield put(setLoanLoading({ key: loadingKey, isLoading: false }));
  }
}

export function* LoansSaga() {
  yield takeLatest(FetchLoanSchedule.type, handleFetchSchedule);
  yield takeLatest(FetchLoanEvents.type, handleFetchEvents);
}
