import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { demoLoanEvents, demoLoanSchedules } from "@/data/demoPayloads";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectIsDemo } from "@/features/auth/authSlice";
import {
  setLoanError,
  setLoanEvents,
  setLoanLoading,
  setLoanPortfolioSeries,
  setLoanSchedule,
} from "@/features/loans/loansSlice";
import type {
  LoanEventRead,
  LoanPortfolioSeriesResponse,
  LoanScheduleRead,
} from "@/types/api";
import {
  loanEventsResponseSchema,
  loanPortfolioSeriesResponseSchema,
  loanScheduleSchema,
} from "@/types/schemas";

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

export const FetchLoanPortfolioSeries = createAction<{
  startDate?: string;
  endDate?: string;
}>("loans/fetchPortfolioSeries");

function* handleFetchSchedule(action: ReturnType<typeof FetchLoanSchedule>) {
  const { accountId, asOfDate, periods } = action.payload;
  const loadingKey = `loan-schedule-${accountId}`;
  yield put(setLoanLoading({ key: loadingKey, isLoading: true }));
  const isDemo: boolean = yield select(selectIsDemo);

  try {
    const query = {
      ...(asOfDate ? { as_of_date: asOfDate } : {}),
      ...(periods ? { periods } : {}),
    };

    if (isDemo) {
      const schedule = demoLoanSchedules[accountId];
      if (schedule) {
        yield put(setLoanSchedule({ accountId, schedule }));
      }
    } else {
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
    }
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
  const isDemo: boolean = yield select(selectIsDemo);

  try {
    const query = {
      ...(limit ? { limit } : {}),
      ...(offset ? { offset } : {}),
    };

    if (isDemo) {
      const events = demoLoanEvents[accountId] ?? [];
      yield put(setLoanEvents({ accountId, events }));
    } else {
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
    }
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

function* handleFetchPortfolioSeries(
  action: ReturnType<typeof FetchLoanPortfolioSeries>,
) {
  const { startDate, endDate } = action.payload;
  const loadingKey = "loan-portfolio-series";
  yield put(setLoanLoading({ key: loadingKey, isLoading: true }));

  try {
    const query = {
      ...(startDate ? { start_date: startDate } : {}),
      ...(endDate ? { end_date: endDate } : {}),
    };

    const response: LoanPortfolioSeriesResponse = yield call(
      callApiWithAuth,
      {
        path: "/loans/events/series",
        query,
        schema: loanPortfolioSeriesResponseSchema,
      },
      { loadingKey },
    );

    yield put(setLoanPortfolioSeries({ series: response.series }));
  } catch (error) {
    yield put(
      setLoanError(
        error instanceof Error
          ? error.message
          : "Failed to load loan portfolio series",
      ),
    );
  } finally {
    yield put(setLoanLoading({ key: loadingKey, isLoading: false }));
  }
}

export function* LoansSaga() {
  yield takeLatest(FetchLoanSchedule.type, handleFetchSchedule);
  yield takeLatest(FetchLoanEvents.type, handleFetchEvents);
  yield takeLatest(FetchLoanPortfolioSeries.type, handleFetchPortfolioSeries);
}
