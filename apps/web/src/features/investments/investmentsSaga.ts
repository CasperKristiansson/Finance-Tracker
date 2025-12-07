import { createAction } from "@reduxjs/toolkit";
import { call, put, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { callApiWithAuth } from "@/features/api/apiSaga";
import {
  clearParseResult,
  setInvestmentsError,
  setInvestmentsLoading,
  setInvestmentsSaving,
  setLastSavedClientId,
  setParseLoading,
  setParseResult,
  setTransactions,
  setMetrics,
  setSnapshots,
  upsertSnapshot,
} from "@/features/investments/investmentsSlice";
import type {
  InvestmentMetricsResponse,
  InvestmentTransactionListResponse,
  InvestmentSnapshotListResponse,
  InvestmentSnapshotResponse,
  NordnetParseRequest,
  NordnetParseResponse,
  NordnetSnapshotCreateRequest,
} from "@/types/api";
import {
  investmentMetricsResponseSchema,
  investmentSnapshotListResponseSchema,
  investmentSnapshotResponseSchema,
  investmentTransactionListSchema,
  nordnetParseResponseSchema,
} from "@/types/schemas";

export const FetchInvestmentSnapshots = createAction("investments/fetch");
export const FetchInvestmentTransactions = createAction(
  "investments/fetchTransactions",
);
export const FetchInvestmentMetrics = createAction("investments/fetchMetrics");
export const ParseNordnetExport = createAction<
  NordnetParseRequest & { clientId: string }
>("investments/parse");
export const SaveNordnetSnapshot = createAction<
  NordnetSnapshotCreateRequest & { clientId?: string }
>("investments/save");
export const ClearDraft = createAction<{ clientId: string }>(
  "investments/clearDraft",
);

function* handleFetchSnapshots(): Generator {
  yield put(setInvestmentsLoading(true));
  try {
    const response: InvestmentSnapshotListResponse = yield call(
      callApiWithAuth,
      {
        path: "/investments/nordnet/snapshots",
        schema: investmentSnapshotListResponseSchema,
      },
      { loadingKey: "investments", silent: true },
    );
    if (response?.snapshots) {
      yield put(setSnapshots(response.snapshots));
    }
  } catch (error) {
    yield put(
      setInvestmentsError(
        error instanceof Error
          ? error.message
          : "Unable to load investment snapshots.",
      ),
    );
  } finally {
    yield put(setInvestmentsLoading(false));
  }
}

function* handleFetchTransactions(): Generator {
  try {
    const response: InvestmentTransactionListResponse = yield call(
      callApiWithAuth,
      {
        path: "/investments/transactions",
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

function* handleFetchMetrics(): Generator {
  try {
    const response: InvestmentMetricsResponse = yield call(
      callApiWithAuth,
      {
        path: "/investments/metrics",
        schema: investmentMetricsResponseSchema,
      },
      { loadingKey: "investments", silent: true },
    );
    if (response?.performance) {
      yield put(setMetrics(response.performance));
    }
    if (response?.snapshots) {
      yield put(setSnapshots(response.snapshots));
    }
    if (response?.holdings) {
      // holdings already embedded in snapshots; no-op
    }
    if (response?.transactions) {
      yield put(setTransactions(response.transactions));
    }
  } catch (error) {
    yield put(
      setInvestmentsError(
        error instanceof Error ? error.message : "Unable to load metrics.",
      ),
    );
  }
}

function* handleParseNordnetExport(
  action: ReturnType<typeof ParseNordnetExport>,
) {
  const { clientId, ...body } = action.payload;
  yield put(setParseLoading({ clientId, loading: true }));
  try {
    const response: NordnetParseResponse = yield call(
      callApiWithAuth,
      {
        path: "/investments/nordnet/parse",
        method: "POST",
        body,
        schema: nordnetParseResponseSchema,
      },
      { loadingKey: `parse-${clientId}` },
    );
    yield put(setParseResult({ clientId, result: response }));
    toast.success("Parsed export", {
      description: "Review holdings and save when ready.",
    });
  } catch (error) {
    yield put(setParseLoading({ clientId, loading: false }));
    yield put(
      setInvestmentsError(
        error instanceof Error ? error.message : "Unable to parse export.",
      ),
    );
    toast.error("Parse failed", {
      description:
        error instanceof Error ? error.message : "Please check the input text.",
    });
  }
}

function* handleSaveSnapshot(action: ReturnType<typeof SaveNordnetSnapshot>) {
  yield put(setInvestmentsSaving(true));
  try {
    const response: InvestmentSnapshotResponse = yield call(
      callApiWithAuth,
      {
        path: "/investments/nordnet/snapshots",
        method: "POST",
        body: action.payload,
        schema: investmentSnapshotResponseSchema,
      },
      { loadingKey: "investments" },
    );
    if (response?.snapshot) {
      yield put(upsertSnapshot(response.snapshot));
      toast.success("Snapshot saved", {
        description: "Portfolio snapshot stored successfully.",
      });
    }
    if (action.payload.clientId) {
      yield put(setLastSavedClientId(action.payload.clientId));
      yield put(clearParseResult(action.payload.clientId));
    }
  } catch (error) {
    yield put(
      setInvestmentsError(
        error instanceof Error ? error.message : "Unable to save snapshot.",
      ),
    );
    toast.error("Save failed", {
      description:
        error instanceof Error ? error.message : "Please try again shortly.",
    });
  } finally {
    yield put(setInvestmentsSaving(false));
  }
}

function* handleClearDraft(action: ReturnType<typeof ClearDraft>) {
  yield put(clearParseResult(action.payload.clientId));
  yield put(setLastSavedClientId(undefined));
}

export function* InvestmentsSaga() {
  yield takeLatest(FetchInvestmentSnapshots.type, handleFetchSnapshots);
  yield takeLatest(FetchInvestmentTransactions.type, handleFetchTransactions);
  yield takeLatest(FetchInvestmentMetrics.type, handleFetchMetrics);
  yield takeLatest(ParseNordnetExport.type, handleParseNordnetExport);
  yield takeLatest(SaveNordnetSnapshot.type, handleSaveSnapshot);
  yield takeLatest(ClearDraft.type, handleClearDraft);
}
