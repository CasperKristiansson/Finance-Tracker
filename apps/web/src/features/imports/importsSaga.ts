import { createAction } from "@reduxjs/toolkit";
import { END, eventChannel, type EventChannel } from "redux-saga";
import { call, put, select, take, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import {
  demoImportDrafts,
  demoImportFiles,
  demoImportPreview,
  demoImportSuggestions,
} from "@/data/demoPayloads";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectIsDemo } from "@/features/auth/authSlice";
import { selectCategories } from "@/features/categories/categoriesSlice";
import {
  clearImportPreview,
  selectImportDrafts,
  clearImportsError,
  setImportDraftSaving,
  setImportDrafts,
  setImportDraftsError,
  setImportDraftsLoading,
  setImportSuggestions,
  setImportPreview,
  setImportPreviewSuggestionsStatus,
  setImportsError,
  setImportsLoading,
  setImportsSuggestionsError,
  setImportsSuggesting,
  setImportsSaving,
  setStoredImportFiles,
  setStoredImportFilesError,
  setStoredImportFilesLoading,
} from "@/features/imports/importsSlice";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import type {
  ImportCommitRequest,
  ImportCommitResponse,
  ImportDraftListResponse,
  ImportDraftSaveRequest,
  ImportDraftSaveResponse,
  ImportPersistFilesRequest,
  ImportPersistFilesResponse,
  ImportCategorySuggestJobRequest,
  ImportCategorySuggestJobResponse,
  ImportCategorySuggestRequest,
  ImportCategorySuggestResponse,
  ImportCategorySuggestionRead,
  ImportPreviewRequest,
  ImportPreviewResponse,
  ImportFileRead,
  ImportFileListResponse,
  ImportFileDownloadResponse,
} from "@/types/api";
import type { EndpointRequest, EndpointResponse } from "@/types/contracts";
import type { BankImportType } from "@/types/enums";

const WS_API_BASE_URL = (import.meta.env.VITE_WS_API_BASE_URL ?? "").replace(
  /\/+$/,
  "",
);

export const PreviewImports =
  createAction<ImportPreviewRequest>("imports/preview");
export const CommitImports =
  createAction<ImportCommitRequest>("imports/commit");
export const SuggestImportCategories = createAction<{
  preview: ImportPreviewResponse;
}>("imports/suggestCategories");
export const FetchImportDrafts = createAction("imports/fetchDrafts");
export const LoadImportDraft = createAction<{ importBatchId: string }>(
  "imports/loadDraft",
);
export const SaveImportDraft = createAction<{
  importBatchId: string;
  rows: NonNullable<ImportDraftSaveRequest["rows"]>;
  snapshot?: ImportDraftSaveRequest["snapshot"];
  note?: string;
  showToast?: boolean;
}>("imports/saveDraft");
export const DeleteImportDraft = createAction<{ importBatchId: string }>(
  "imports/deleteDraft",
);
export const FetchStoredImportFiles = createAction("imports/fetchStoredFiles");
export const DownloadImportFile = createAction<{ fileId: string }>(
  "imports/downloadFile",
);
export const ResetImports = createAction("imports/reset");

type SuggestionSocketEvent =
  | { type: "open" }
  | { type: "message"; data: unknown }
  | { type: "error"; error: string }
  | { type: "closed" };

const createClientToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const createSuggestionsChannel = (
  clientId: string,
  clientToken: string,
): EventChannel<SuggestionSocketEvent> => {
  return eventChannel((emit) => {
    if (!WS_API_BASE_URL) {
      emit({
        type: "error",
        error: "Suggestions websocket URL is not configured.",
      });
      emit(END);
      return () => undefined;
    }

    const params = new URLSearchParams({
      client_id: clientId,
      token: clientToken,
    });
    const socket = new WebSocket(`${WS_API_BASE_URL}?${params.toString()}`);

    const handleOpen = () => emit({ type: "open" });
    const handleMessage = (event: MessageEvent) => {
      try {
        emit({ type: "message", data: JSON.parse(event.data) });
      } catch (error) {
        emit({
          type: "error",
          error:
            error instanceof Error
              ? error.message
              : "Invalid websocket payload.",
        });
      }
    };
    const handleError = () =>
      emit({ type: "error", error: "Suggestions websocket error." });
    const handleClose = () => {
      emit({ type: "closed" });
      emit(END);
    };

    socket.addEventListener("open", handleOpen);
    socket.addEventListener("message", handleMessage);
    socket.addEventListener("error", handleError);
    socket.addEventListener("close", handleClose);

    return () => {
      socket.removeEventListener("open", handleOpen);
      socket.removeEventListener("message", handleMessage);
      socket.removeEventListener("error", handleError);
      socket.removeEventListener("close", handleClose);
      if (socket.readyState === WebSocket.OPEN) {
        socket.close(1000, "done");
      } else if (socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  });
};

const buildDemoDownloadUrl = (file?: ImportFileRead) => {
  const filename = file?.filename ?? "demo_import.csv";
  const header = "Date,Description,Amount";
  const rows = [
    `${new Date().toISOString().slice(0, 10)},Demo import for ${filename},0.00`,
    `${new Date().toISOString().slice(0, 10)},Sample transaction,-145.20`,
  ];
  const content = [header, ...rows].join("\n");
  return `data:text/csv;charset=utf-8,${encodeURIComponent(content)}`;
};

function* waitForSocketOpen(
  channel: EventChannel<SuggestionSocketEvent>,
): Generator<unknown, void, SuggestionSocketEvent> {
  while (true) {
    const event = yield take(channel);
    if (event.type === "open") return;
    if (event.type === "error") {
      throw new Error(event.error);
    }
    if (event.type === "closed") {
      throw new Error("Suggestions websocket closed.");
    }
  }
}

function* waitForSuggestionJob(
  channel: EventChannel<SuggestionSocketEvent>,
  jobId: string,
): Generator<unknown, ImportCategorySuggestResponse, SuggestionSocketEvent> {
  while (true) {
    const event = yield take(channel);
    if (event.type === "error") {
      throw new Error(event.error);
    }
    if (event.type === "closed") {
      throw new Error("Suggestions websocket closed.");
    }
    if (event.type !== "message") continue;

    const data = event.data as Record<string, unknown> | null;
    if (!data || typeof data !== "object") continue;
    if (data.job_id !== jobId) continue;

    if (data.type === "import_suggestions_error") {
      const errorText =
        typeof data.error === "string"
          ? data.error
          : "Unable to suggest categories.";
      throw new Error(errorText);
    }

    if (data.type !== "import_suggestions") continue;

    return {
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    } as ImportCategorySuggestResponse;
  }
}

function buildSuggestPayload(
  preview: ImportPreviewResponse,
  available: Array<{
    id: string;
    name: string;
    category_type: string;
    is_archived?: boolean;
  }>,
) {
  const bankImportTypeByAccount = new Map<string, BankImportType | null>();
  (preview.files ?? []).forEach((file) => {
    if (!bankImportTypeByAccount.has(file.account_id)) {
      bankImportTypeByAccount.set(
        file.account_id,
        file.bank_import_type ?? null,
      );
    }
  });

  const transactions: ImportCategorySuggestRequest["transactions"] = [];
  const seenTransactionIds = new Set<string>();
  for (const row of preview.rows) {
    if (row.rule_applied) continue;
    const bankImportType = bankImportTypeByAccount.get(row.account_id);
    const isSwedbankAccount = bankImportType === "swedbank";
    if (isSwedbankAccount && row.description.toLowerCase().includes("swish")) {
      continue;
    }
    if (seenTransactionIds.has(row.id)) continue;
    seenTransactionIds.add(row.id);
    transactions.push({
      id: row.id,
      description: row.description,
      amount: row.amount,
      occurred_at: row.occurred_at,
    });
    if (transactions.length >= 200) break;
  }

  const estimatedMaxTokens = Math.min(
    4000,
    Math.max(1200, Math.ceil(transactions.length * 60)),
  );

  const history: ImportCategorySuggestRequest["history"] = [];
  const seenHistory = new Set<string>();
  const contexts = preview.accounts ?? [];
  for (const ctx of contexts) {
    const candidates = [
      ...(ctx.recent_transactions ?? []),
      ...(ctx.similar_transactions ?? []),
    ];
    for (const tx of candidates) {
      if (!tx.category_id || !tx.description) continue;
      const key = `${tx.category_id}:${tx.description}`.toLowerCase();
      if (seenHistory.has(key)) continue;
      seenHistory.add(key);
      history.push({
        category_id: tx.category_id,
        description: tx.description,
      });
      if (history.length >= 200) break;
    }
    if (history.length >= 200) break;
  }

  return {
    categories: available.map((cat) => ({
      id: cat.id,
      name: cat.name,
      category_type: cat.category_type,
    })),
    history,
    transactions,
    max_tokens: estimatedMaxTokens,
  };
}

const mapPersistedSuggestions = (preview: ImportPreviewResponse) => {
  if (preview.suggestions_status !== "completed") {
    return {} as Record<string, ImportCategorySuggestionRead>;
  }
  const mapped: Record<string, ImportCategorySuggestionRead> = {};
  preview.rows.forEach((row) => {
    if (
      row.suggested_category_id == null &&
      row.suggested_reason == null &&
      row.suggested_confidence == null
    ) {
      return;
    }
    const confidenceRaw =
      typeof row.suggested_confidence === "number"
        ? row.suggested_confidence
        : 0.6;
    const confidence = Math.max(0, Math.min(confidenceRaw, 0.99));
    mapped[row.id] = {
      id: row.id,
      category_id: row.suggested_category_id ?? null,
      confidence,
      reason: row.suggested_reason ?? null,
    };
  });
  return mapped;
};

const buildDraftRowsFromPreview = (
  preview: ImportPreviewResponse,
): NonNullable<ImportDraftSaveRequest["rows"]> =>
  preview.rows.map((row) => ({
    id: row.id,
    file_id: row.file_id,
    account_id: row.account_id,
    occurred_at: row.occurred_at,
    amount: row.amount,
    description: row.description,
    category_id: row.suggested_category_id ?? null,
    transfer_account_id: null,
    tax_event_type: null,
    delete: false,
  }));

const buildPersistFilesPayload = (
  preview: ImportPreviewResponse,
  request: ImportPreviewRequest,
): EndpointRequest<"persistImportFiles"> => {
  const remaining = [...request.files];
  const files: ImportPersistFilesRequest["files"] = preview.files.map(
    (previewFile, index) => {
      let sourceIndex = remaining.findIndex(
        (source) =>
          source.filename === previewFile.filename &&
          source.account_id === previewFile.account_id,
      );
      if (sourceIndex < 0) {
        sourceIndex = index < remaining.length ? index : 0;
      }
      const source = remaining[sourceIndex];
      if (!source) {
        throw new Error(
          "Unable to persist import files: missing source payload.",
        );
      }
      remaining.splice(sourceIndex, 1);
      return {
        id: previewFile.id,
        filename: previewFile.filename,
        account_id: previewFile.account_id,
        row_count: previewFile.row_count,
        error_count: previewFile.error_count,
        bank_import_type: previewFile.bank_import_type ?? null,
        content_base64: source.content_base64,
      };
    },
  );

  return {
    note: request.note,
    files,
  };
};

function* handlePreview(action: ReturnType<typeof PreviewImports>) {
  yield put(setImportsLoading(true));
  yield put(clearImportsError());
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body: ImportPreviewRequest = action.payload;
    if (isDemo) {
      yield put(setImportPreview(demoImportPreview));
      yield put(FetchImportDrafts());
      toast.success("Files parsed", {
        description: "Review transactions and submit when ready.",
      });
    } else {
      const response: ImportPreviewResponse = yield call(
        callApiWithAuth,
        buildEndpointRequest("previewImports", {
          body,
        }),
        { loadingKey: "imports" },
      );
      const persistFilesBody = buildPersistFilesPayload(response, body);
      const persistFilesResponse: ImportPersistFilesResponse = yield call(
        callApiWithAuth,
        buildEndpointRequest("persistImportFiles", {
          pathParams: { importBatchId: response.import_batch_id },
          body: persistFilesBody,
        }),
        { loadingKey: `import-files-persist-${response.import_batch_id}` },
      );
      void persistFilesResponse;

      const draftRows = buildDraftRowsFromPreview(response);
      const bootstrapDraft: EndpointRequest<"saveImportDraft"> = {
        rows: draftRows,
        snapshot: response as unknown as EndpointResponse<"getImportDraft">,
      };
      const bootstrapResponse: ImportDraftSaveResponse = yield call(
        callApiWithAuth,
        buildEndpointRequest("saveImportDraft", {
          pathParams: { importBatchId: response.import_batch_id },
          body: bootstrapDraft,
        }),
        { loadingKey: `import-draft-bootstrap-${response.import_batch_id}` },
      );
      void bootstrapResponse;

      yield put(setImportPreview(response));
      yield put(FetchImportDrafts());
      toast.success("Files parsed", {
        description: "Review transactions and submit when ready.",
      });
    }
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
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    const body: ImportCommitRequest = action.payload;
    if (isDemo) {
      toast.success("Transactions saved", {
        description: "Demo import saved locally.",
      });
      yield put(clearImportPreview());
      yield put(FetchImportDrafts());
    } else {
      const response: ImportCommitResponse = yield call(
        callApiWithAuth,
        buildEndpointRequest("commitImports", {
          body,
        }),
        { loadingKey: "imports" },
      );

      toast.success("Transactions saved", {
        description: `Batch ${response.import_batch_id.slice(0, 8)} created.`,
      });
      yield put(clearImportPreview());
      yield put(FetchImportDrafts());
    }
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

function* handleSuggest(action: ReturnType<typeof SuggestImportCategories>) {
  yield put(setImportsSuggesting(true));
  yield put(setImportsSuggestionsError(undefined));
  let channel: EventChannel<SuggestionSocketEvent> | null = null;
  const preview = action.payload.preview;
  const shouldTrackStatus = Boolean(preview.import_batch_id);
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (shouldTrackStatus) {
      yield put(setImportPreviewSuggestionsStatus("running"));
    }

    const categories: Array<{
      id: string;
      name: string;
      category_type: string;
      is_archived?: boolean;
    }> = yield select(selectCategories);
    const available = categories.filter((cat) => !cat.is_archived);
    if (!available.length) {
      throw new Error("No categories available for suggestions.");
    }

    const suggestPayload = buildSuggestPayload(preview, available);
    if (!suggestPayload.transactions.length) {
      throw new Error("No transactions available for suggestions.");
    }

    if (isDemo) {
      const mapped = demoImportSuggestions.suggestions.reduce(
        (acc, suggestion) => {
          acc[suggestion.id] = suggestion;
          return acc;
        },
        {} as Record<string, ImportCategorySuggestionRead>,
      );
      yield put(setImportSuggestions(mapped));
      if (shouldTrackStatus) {
        yield put(setImportPreviewSuggestionsStatus("completed"));
      }
    } else {
      if (!WS_API_BASE_URL) {
        throw new Error(
          "Suggestions websocket URL is not configured (set VITE_WS_API_BASE_URL).",
        );
      }
      const clientId = crypto.randomUUID();
      const clientToken = createClientToken();
      channel = createSuggestionsChannel(clientId, clientToken);
      yield* waitForSocketOpen(channel);

      const jobRequest: ImportCategorySuggestJobRequest = {
        ...suggestPayload,
        import_batch_id: preview.import_batch_id,
        client_id: clientId,
        client_token: clientToken,
      };
      const body: ImportCategorySuggestJobRequest = jobRequest;

      const response: ImportCategorySuggestJobResponse = yield call(
        callApiWithAuth,
        buildEndpointRequest("suggestImportCategoriesJob", {
          body,
        }),
        { loadingKey: "imports-suggest" },
      );

      const jobResponse: ImportCategorySuggestResponse =
        yield* waitForSuggestionJob(channel, response.job_id);
      const mapped: Record<
        string,
        ImportCategorySuggestResponse["suggestions"][number]
      > = {};
      jobResponse.suggestions.forEach((suggestion) => {
        mapped[suggestion.id] = suggestion;
      });
      yield put(setImportSuggestions(mapped));
      if (shouldTrackStatus) {
        yield put(setImportPreviewSuggestionsStatus("completed"));
      }
    }
    toast.success("Category suggestions ready");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to suggest categories.";
    if (shouldTrackStatus) {
      yield put(setImportPreviewSuggestionsStatus("failed"));
    }
    yield put(setImportsSuggestionsError(message));
    toast.error("Category suggestions unavailable", { description: message });
  } finally {
    yield put(setImportsSuggesting(false));
    if (channel) {
      channel.close();
    }
  }
}

function* handleFetchDrafts() {
  yield put(setImportDraftsLoading(true));
  yield put(setImportDraftsError(undefined));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(setImportDrafts(demoImportDrafts.drafts ?? []));
      return;
    }

    const response: ImportDraftListResponse = yield call(
      callApiWithAuth,
      buildEndpointRequest("listImportDrafts", {}),
      { loadingKey: "import-drafts" },
    );
    yield put(setImportDrafts(response.drafts ?? []));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load import drafts.";
    yield put(setImportDraftsError(message));
  } finally {
    yield put(setImportDraftsLoading(false));
  }
}

function* handleLoadDraft(action: ReturnType<typeof LoadImportDraft>) {
  yield put(setImportsLoading(true));
  yield put(clearImportsError());
  const isDemo: boolean = yield select(selectIsDemo);

  try {
    if (isDemo) {
      if (action.payload.importBatchId !== demoImportPreview.import_batch_id) {
        throw new Error("Import draft not found.");
      }
      yield put(setImportPreview(demoImportPreview));
      yield put(
        setImportSuggestions(mapPersistedSuggestions(demoImportPreview)),
      );
      return;
    }

    const response: ImportPreviewResponse = yield call(
      callApiWithAuth,
      buildEndpointRequest("getImportDraft", {
        pathParams: { importBatchId: action.payload.importBatchId },
      }),
      { loadingKey: `import-draft-${action.payload.importBatchId}` },
    );
    yield put(setImportPreview(response));
    yield put(setImportSuggestions(mapPersistedSuggestions(response)));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load import draft.";
    yield put(setImportsError(message));
    toast.error("Could not load import", { description: message });
  } finally {
    yield put(setImportsLoading(false));
  }
}

function* handleSaveDraft(action: ReturnType<typeof SaveImportDraft>) {
  yield put(setImportDraftSaving(true));
  yield put(setImportDraftsError(undefined));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      return;
    }

    const body: EndpointRequest<"saveImportDraft"> = {
      rows: action.payload.rows,
      snapshot: action.payload
        .snapshot as unknown as EndpointResponse<"getImportDraft">,
      note: action.payload.note,
    };
    const response: ImportDraftSaveResponse = yield call(
      callApiWithAuth,
      buildEndpointRequest("saveImportDraft", {
        pathParams: { importBatchId: action.payload.importBatchId },
        body,
      }),
      { loadingKey: `import-draft-save-${action.payload.importBatchId}` },
    );
    void response;
    if (action.payload.showToast) {
      toast.success("Draft saved");
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to save import draft.";
    yield put(setImportDraftsError(message));
    if (action.payload.showToast) {
      toast.error("Draft save failed", { description: message });
    }
  } finally {
    yield put(setImportDraftSaving(false));
  }
}

function* handleDeleteDraft(action: ReturnType<typeof DeleteImportDraft>) {
  yield put(setImportDraftsLoading(true));
  yield put(setImportDraftsError(undefined));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      const currentDrafts: ImportDraftListResponse["drafts"] =
        yield select(selectImportDrafts);
      yield put(
        setImportDrafts(
          currentDrafts.filter(
            (draft) => draft.import_batch_id !== action.payload.importBatchId,
          ),
        ),
      );
      return;
    }

    yield call(
      callApiWithAuth,
      buildEndpointRequest("deleteImportDraft", {
        pathParams: { importBatchId: action.payload.importBatchId },
      }),
      { loadingKey: `import-draft-delete-${action.payload.importBatchId}` },
    );
    yield put(FetchImportDrafts());
    toast.success("Import draft removed");
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to remove import draft.";
    yield put(setImportDraftsError(message));
    toast.error("Could not remove import draft", { description: message });
  } finally {
    yield put(setImportDraftsLoading(false));
  }
}

function* handleFetchStoredFiles() {
  yield put(setStoredImportFilesLoading(true));
  yield put(setStoredImportFilesError(undefined));
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      yield put(setStoredImportFiles(demoImportFiles.files ?? []));
    } else {
      const response: ImportFileListResponse = yield call(
        callApiWithAuth,
        buildEndpointRequest("listImportFiles", {}),
        { loadingKey: "import-files" },
      );
      yield put(setStoredImportFiles(response.files ?? []));
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load import files.";
    yield put(setStoredImportFilesError(message));
    toast.error("Could not load stored files", { description: message });
  } finally {
    yield put(setStoredImportFilesLoading(false));
  }
}

function* handleDownloadImportFile(
  action: ReturnType<typeof DownloadImportFile>,
) {
  const isDemo: boolean = yield select(selectIsDemo);
  try {
    if (isDemo) {
      const file = demoImportFiles.files.find(
        (item) => item.id === action.payload.fileId,
      );
      const url = buildDemoDownloadUrl(file);
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success("Download started (demo mode)");
    } else {
      const response: ImportFileDownloadResponse = yield call(
        callApiWithAuth,
        buildEndpointRequest("downloadImportFile", {
          body: { file_id: action.payload.fileId },
        }),
        { loadingKey: `import-file-${action.payload.fileId}` },
      );
      if (response.url) {
        window.open(response.url, "_blank", "noopener,noreferrer");
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to download file.";
    toast.error("Download failed", { description: message });
  }
}

export function* ImportsSaga() {
  yield takeLatest(PreviewImports.type, handlePreview);
  yield takeLatest(CommitImports.type, handleCommit);
  yield takeLatest(SuggestImportCategories.type, handleSuggest);
  yield takeLatest(FetchImportDrafts.type, handleFetchDrafts);
  yield takeLatest(LoadImportDraft.type, handleLoadDraft);
  yield takeLatest(SaveImportDraft.type, handleSaveDraft);
  yield takeLatest(DeleteImportDraft.type, handleDeleteDraft);
  yield takeLatest(FetchStoredImportFiles.type, handleFetchStoredFiles);
  yield takeLatest(DownloadImportFile.type, handleDownloadImportFile);
  yield takeLatest(ResetImports.type, function* () {
    yield put(clearImportPreview());
    yield put(clearImportsError());
    yield put(setImportsSuggesting(false));
    yield put(setImportsSuggestionsError(undefined));
    yield put(setImportDraftSaving(false));
    yield put(setImportDraftsError(undefined));
  });
}
