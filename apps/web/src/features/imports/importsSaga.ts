import { createAction } from "@reduxjs/toolkit";
import { END, eventChannel, type EventChannel } from "redux-saga";
import { call, put, select, take, takeLatest } from "redux-saga/effects";
import { toast } from "sonner";
import { callApiWithAuth } from "@/features/api/apiSaga";
import { selectCategories } from "@/features/categories/categoriesSlice";
import {
  clearImportPreview,
  clearImportsError,
  setImportSuggestions,
  setImportPreview,
  setImportsError,
  setImportsLoading,
  setImportsSuggestionsError,
  setImportsSuggesting,
  setImportsSaving,
} from "@/features/imports/importsSlice";
import type {
  ImportCommitRequest,
  ImportCommitResponse,
  ImportCategorySuggestJobRequest,
  ImportCategorySuggestJobResponse,
  ImportCategorySuggestRequest,
  ImportCategorySuggestResponse,
  ImportPreviewRequest,
  ImportPreviewResponse,
} from "@/types/api";
import type { BankImportType } from "@/types/enums";
import {
  importCommitRequestSchema,
  importCommitResponseSchema,
  importCategorySuggestJobRequestSchema,
  importCategorySuggestJobResponseSchema,
  importCategorySuggestRequestSchema,
  importCategorySuggestResponseSchema,
  importPreviewRequestSchema,
  importPreviewResponseSchema,
} from "@/types/schemas";

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

    return importCategorySuggestResponseSchema.parse({
      suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
    });
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

  const contexts = preview.accounts ?? [];
  const rowsByAccount = new Map<string, typeof preview.rows>();
  preview.rows.forEach((row) => {
    const list = rowsByAccount.get(row.account_id) ?? [];
    list.push(row);
    rowsByAccount.set(row.account_id, list);
  });

  const payloads: Array<{
    accountId: string;
    request: ImportCategorySuggestRequest;
  }> = [];

  for (const ctx of contexts) {
    const accountRows = rowsByAccount.get(ctx.account_id) ?? [];
    const bankImportType = bankImportTypeByAccount.get(ctx.account_id);
    const isSwedbankAccount = bankImportType === "swedbank";

    const transactions: ImportCategorySuggestRequest["transactions"] = [];
    for (const row of accountRows) {
      if (row.rule_applied) continue;
      if (
        isSwedbankAccount &&
        row.description.toLowerCase().includes("swish")
      ) {
        continue;
      }
      transactions.push({
        id: row.id,
        description: row.description,
        amount: row.amount,
        occurred_at: row.occurred_at,
      });
      if (transactions.length >= 200) break;
    }
    if (!transactions.length) continue;

    const history: ImportCategorySuggestRequest["history"] = [];
    const seenHistory = new Set<string>();
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

    const payload: ImportCategorySuggestRequest = {
      categories: available.map((cat) => ({
        id: cat.id,
        name: cat.name,
        category_type: cat.category_type,
      })),
      history,
      transactions,
    };

    payloads.push({ accountId: ctx.account_id, request: payload });
  }

  return payloads;
}

function* suggestSync(
  payloads: Array<{ accountId: string; request: ImportCategorySuggestRequest }>,
) {
  const mapped: Record<
    string,
    ImportCategorySuggestResponse["suggestions"][number]
  > = {};

  for (const { accountId, request } of payloads) {
    const body = importCategorySuggestRequestSchema.parse(request);
    const response: ImportCategorySuggestResponse = yield call(
      callApiWithAuth,
      {
        path: "/imports/suggest-categories",
        method: "POST",
        body,
        schema: importCategorySuggestResponseSchema,
      },
      { loadingKey: `imports-suggest-${accountId}` },
    );
    const parsed = importCategorySuggestResponseSchema.parse(response);
    parsed.suggestions.forEach((suggestion) => {
      mapped[suggestion.id] = suggestion;
    });
  }

  return mapped;
}

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

function* handleSuggest(action: ReturnType<typeof SuggestImportCategories>) {
  yield put(setImportsSuggesting(true));
  yield put(setImportsSuggestionsError(undefined));
  let channel: EventChannel<SuggestionSocketEvent> | null = null;
  try {
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

    const preview = action.payload.preview;
    const payloads = buildSuggestPayload(preview, available);
    if (!payloads.length) {
      throw new Error("No transactions available for suggestions.");
    }

    if (!WS_API_BASE_URL) {
      const mapped = yield* suggestSync(payloads);
      yield put(setImportSuggestions(mapped));
      return;
    }

    const clientId = crypto.randomUUID();
    const clientToken = createClientToken();
    channel = createSuggestionsChannel(clientId, clientToken);
    yield* waitForSocketOpen(channel);

    const mapped: Record<
      string,
      ImportCategorySuggestResponse["suggestions"][number]
    > = {};

    for (const { accountId, request } of payloads) {
      const jobRequest: ImportCategorySuggestJobRequest = {
        ...request,
        client_id: clientId,
        client_token: clientToken,
      };
      const body = importCategorySuggestJobRequestSchema.parse(jobRequest);

      const response: ImportCategorySuggestJobResponse = yield call(
        callApiWithAuth,
        {
          path: "/imports/suggest-categories/jobs",
          method: "POST",
          body,
          schema: importCategorySuggestJobResponseSchema,
        },
        { loadingKey: `imports-suggest-${accountId}` },
      );
      const parsed = importCategorySuggestJobResponseSchema.parse(response);

      const jobResponse: ImportCategorySuggestResponse =
        yield* waitForSuggestionJob(channel, parsed.job_id);
      jobResponse.suggestions.forEach((suggestion) => {
        mapped[suggestion.id] = suggestion;
      });
    }

    yield put(setImportSuggestions(mapped));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to suggest categories.";
    yield put(setImportsSuggestionsError(message));
    toast.error("Category suggestions unavailable", { description: message });
  } finally {
    yield put(setImportsSuggesting(false));
    if (channel) {
      channel.close();
    }
  }
}

export function* ImportsSaga() {
  yield takeLatest(PreviewImports.type, handlePreview);
  yield takeLatest(CommitImports.type, handleCommit);
  yield takeLatest(SuggestImportCategories.type, handleSuggest);
  yield takeLatest(ResetImports.type, function* () {
    yield put(clearImportPreview());
    yield put(clearImportsError());
    yield put(setImportsSuggesting(false));
    yield put(setImportsSuggestionsError(undefined));
  });
}
