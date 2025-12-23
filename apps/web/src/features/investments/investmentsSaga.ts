import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import {
  demoInvestmentMetrics,
  demoInvestmentOverview,
  demoInvestmentSnapshots,
  demoInvestmentTransactions,
} from "@/data/demoPayloads";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectIsDemo } from "@/features/auth/authSlice";
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
  setOverview,
  setSnapshots,
  upsertSnapshot,
} from "@/features/investments/investmentsSlice";
import type {
  InvestmentMetricsResponse,
  InvestmentOverviewResponse,
  InvestmentTransactionListResponse,
  InvestmentSnapshotListResponse,
  InvestmentSnapshotResponse,
  NordnetParseRequest,
  NordnetParseResponse,
  NordnetSnapshotCreateRequest,
} from "@/types/api";
import {
  investmentMetricsResponseSchema,
  investmentOverviewResponseSchema,
  investmentSnapshotListResponseSchema,
  investmentSnapshotResponseSchema,
  investmentTransactionListSchema,
  nordnetParseRequestSchema,
  nordnetParseResponseSchema,
  nordnetSnapshotCreateRequestSchema,
} from "@/types/schemas";

export const FetchInvestmentSnapshots = createAction("investments/fetch");
export const FetchInvestmentTransactions = createAction(
  "investments/fetchTransactions",
);
export const FetchInvestmentMetrics = createAction("investments/fetchMetrics");
export const FetchInvestmentOverview = createAction(
  "investments/fetchOverview",
);
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(setSnapshots(demoInvestmentSnapshots.snapshots));
    } else {
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(setTransactions(demoInvestmentTransactions.transactions));
      return;
    }

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

function* handleFetchMetrics(): Generator {
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(setMetrics(demoInvestmentMetrics.performance));
      yield put(setSnapshots(demoInvestmentMetrics.snapshots));
      yield put(setTransactions(demoInvestmentMetrics.transactions));
    } else {
      const response: InvestmentMetricsResponse = yield call(
        callApiWithAuth,
        {
          path: "/investments/metrics",
          schema: investmentMetricsResponseSchema,
        },
        { loadingKey: "investments", silent: true },
      );
      yield put(setMetrics(response.performance));
      yield put(setSnapshots(response.snapshots));
      // holdings already embedded in snapshots; no-op
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

function* handleFetchOverview(): Generator {
  yield put(setInvestmentsLoading(true));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(setOverview(demoInvestmentOverview));
    } else {
      const response: InvestmentOverviewResponse = yield call(
        callApiWithAuth,
        {
          path: "/investments/overview",
          schema: investmentOverviewResponseSchema,
        },
        { loadingKey: "investments", silent: true },
      );
      yield put(setOverview(response));
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

function* handleParseNordnetExport(
  action: ReturnType<typeof ParseNordnetExport>,
) {
  const { clientId, ...rawBody } = action.payload;
  const body = nordnetParseRequestSchema.parse(rawBody);
  yield put(setParseLoading({ clientId, loading: true }));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      const mock: NordnetParseResponse = {
        report_type: "positions",
        snapshot_date: new Date().toISOString(),
        portfolio_value: "45500.00",
        parsed_payload: { preview: "demo" },
      };
      yield put(setParseResult({ clientId, result: mock }));
      toast.success("Parsed export", {
        description: "Review holdings and save when ready.",
      });
      return;
    }

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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const { clientId, ...rawBody } = action.payload;
    const body = nordnetSnapshotCreateRequestSchema.parse(rawBody);
    if (isDemo) {
      const now = new Date().toISOString();
      const snapshot =
        demoInvestmentSnapshots.snapshots[0] ??
        ({
          id: `demo-snapshot-${Date.now()}`,
          provider: "nordnet",
          report_type: body.report_type ?? "positions",
          account_name: body.account_name ?? "Demo Account",
          snapshot_date: body.snapshot_date ?? now,
          portfolio_value: body.portfolio_value ?? "0",
          raw_text: body.raw_text ?? "Demo snapshot",
          parsed_payload: body.parsed_payload ?? {},
          cleaned_payload: body.manual_payload ?? null,
          bedrock_metadata: null,
          created_at: now,
          updated_at: now,
          holdings: [],
        } satisfies InvestmentSnapshotResponse["snapshot"]);
      yield put(upsertSnapshot(snapshot));
      toast.success("Snapshot saved", {
        description: "Portfolio snapshot stored successfully.",
      });
      if (clientId) {
        yield put(setLastSavedClientId(clientId));
        yield put(clearParseResult(clientId));
      }
    } else {
      const response: InvestmentSnapshotResponse = yield call(
        callApiWithAuth,
        {
          path: "/investments/nordnet/snapshots",
          method: "POST",
          body,
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
      if (clientId) {
        yield put(setLastSavedClientId(clientId));
        yield put(clearParseResult(clientId));
      }
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
  yield takeLatest(FetchInvestmentOverview.type, handleFetchOverview);
  yield takeLatest(ParseNordnetExport.type, handleParseNordnetExport);
  yield takeLatest(SaveNordnetSnapshot.type, handleSaveSnapshot);
  yield takeLatest(ClearDraft.type, handleClearDraft);
}
