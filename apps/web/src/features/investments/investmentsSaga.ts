import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import {
  demoInvestmentOverview,
  demoInvestmentTransactions,
} from "@/data/demoPayloads";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectIsDemo } from "@/features/auth/authSlice";
import {
  setInvestmentsError,
  setInvestmentsLoading,
  setInvestmentsUpdateError,
  setInvestmentsUpdateLoading,
  setTransactions,
  setOverview,
} from "@/features/investments/investmentsSlice";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import type {
  InvestmentOverviewResponse,
  InvestmentTransactionRead,
} from "@/types/api";
import type { EndpointRequest, EndpointResponse } from "@/types/contracts";

export const FetchInvestmentTransactions = createAction(
  "investments/fetchTransactions",
);
export const FetchInvestmentOverview = createAction(
  "investments/fetchOverview",
);
export const CreateInvestmentSnapshot = createAction<{
  data: EndpointRequest<"createInvestmentSnapshot">;
}>("investments/createSnapshot");

function* handleFetchTransactions(): Generator {
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(setTransactions(demoInvestmentTransactions.transactions));
      return;
    }

    const response: EndpointResponse<"listInvestmentTransactions"> = yield call(
      callApiWithAuth,
      buildEndpointRequest("listInvestmentTransactions", {
        query: { limit: 500 },
      }),
      { loadingKey: "investments", silent: true },
    );
    if (response?.transactions) {
      yield put(
        setTransactions(
          response.transactions as unknown as InvestmentTransactionRead[],
        ),
      );
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(setOverview(demoInvestmentOverview));
    } else {
      const response: EndpointResponse<"investmentOverview"> = yield call(
        callApiWithAuth,
        buildEndpointRequest("investmentOverview"),
        { loadingKey: "investments", silent: true },
      );
      const normalized: InvestmentOverviewResponse = {
        ...response,
        portfolio: {
          ...response.portfolio,
          series: response.portfolio.series ?? [],
          cashflow_series: response.portfolio.cashflow_series ?? [],
        },
        accounts: (response.accounts ?? []).map((account) => ({
          ...account,
          series: account.series ?? [],
        })),
        recent_cashflows: response.recent_cashflows ?? [],
      };
      yield put(setOverview(normalized));
    }
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (!isDemo) {
      yield call(
        callApiWithAuth,
        buildEndpointRequest("createInvestmentSnapshot", {
          body: action.payload.data,
        }),
        { loadingKey: "investments-create-snapshot" },
      );
    }
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
