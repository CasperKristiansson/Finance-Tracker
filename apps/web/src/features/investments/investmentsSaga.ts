import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  setInvestmentsError,
  setInvestmentsLoading,
  setInvestmentsUpdateError,
  setInvestmentsUpdateLoading,
  setTransactions,
  setOverview,
} from "@/features/investments/investmentsSlice";
import type {
  InvestmentOverviewResponse,
  InvestmentSnapshotCreateRequest,
  InvestmentTransactionListResponse,
} from "@/types/api";
import {
  investmentOverviewResponseSchema,
  investmentSnapshotCreateResponseSchema,
  investmentTransactionListSchema,
} from "@/types/schemas";

export const FetchInvestmentTransactions = createAction(
  "investments/fetchTransactions",
);
export const FetchInvestmentOverview = createAction(
  "investments/fetchOverview",
);
export const CreateInvestmentSnapshot = createAction<{
  data: InvestmentSnapshotCreateRequest;
}>("investments/createSnapshot");

function* handleFetchTransactions(): Generator {
  try {
    const response: InvestmentTransactionListResponse = yield call(
      callApiWithAuth,
      {
        path: "/investments/transactions",
        query: { limit: 500 },
        schema: investmentTransactionListSchema,
      },
      { loadingKey: "investments", silent: true },
    );
    if (response?.transactions) {
      yield put(setTransactions(response.transactions));
    }
  } catch (error) {
    yield put(
      setInvestmentsError(
        error instanceof Error
          ? error.message
          : "Unable to load investment transactions.",
      ),
    );
  }
}

function* handleFetchOverview(): Generator {
  yield put(setInvestmentsLoading(true));
  try {
    const response: InvestmentOverviewResponse = yield call(
      callApiWithAuth,
      {
        path: "/investments/overview",
        schema: investmentOverviewResponseSchema,
      },
      { loadingKey: "investments", silent: true },
    );
    yield put(setOverview(response));
  } catch (error) {
    yield put(
      setInvestmentsError(
        error instanceof Error
          ? error.message
          : "Unable to load investment overview.",
      ),
    );
  } finally {
    yield put(setInvestmentsLoading(false));
  }
}

function* handleCreateSnapshot(
  action: ReturnType<typeof CreateInvestmentSnapshot>,
): Generator {
  yield put(setInvestmentsUpdateLoading(true));
  yield put(setInvestmentsUpdateError(undefined));
  try {
    yield call(
      callApiWithAuth,
      {
        path: "/investments/snapshots",
        method: "POST",
        body: action.payload.data,
        schema: investmentSnapshotCreateResponseSchema,
      },
      { loadingKey: "investments-create-snapshot" },
    );
    yield put(setInvestmentsUpdateError(undefined));
    yield put(FetchInvestmentOverview());
  } catch (error) {
    yield put(
      setInvestmentsUpdateError(
        error instanceof Error
          ? error.message
          : "Unable to update investment balance.",
      ),
    );
  } finally {
    yield put(setInvestmentsUpdateLoading(false));
  }
}

export function* InvestmentsSaga() {
  yield takeLatest(FetchInvestmentTransactions.type, handleFetchTransactions);
  yield takeLatest(FetchInvestmentOverview.type, handleFetchOverview);
  yield takeLatest(CreateInvestmentSnapshot.type, handleCreateSnapshot);
}
