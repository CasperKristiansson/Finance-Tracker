import { createAction } from "@reduxjs/toolkit";
import { call, put, select, takeLatest } from "redux-saga/effects";
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
  ImportCategorySuggestRequest,
  ImportCategorySuggestResponse,
  ImportPreviewRequest,
  ImportPreviewResponse,
} from "@/types/api";
import {
  importCommitRequestSchema,
  importCommitResponseSchema,
  importCategorySuggestRequestSchema,
  importCategorySuggestResponseSchema,
  importPreviewRequestSchema,
  importPreviewResponseSchema,
} from "@/types/schemas";

export const PreviewImports =
  createAction<ImportPreviewRequest>("imports/preview");
export const CommitImports =
  createAction<ImportCommitRequest>("imports/commit");
export const SuggestImportCategories = createAction<{
  preview: ImportPreviewResponse;
}>("imports/suggestCategories");
export const ResetImports = createAction("imports/reset");

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
    const contexts = preview.accounts ?? [];
    const rowsByAccount = new Map<string, typeof preview.rows>();
    preview.rows.forEach((row) => {
      const list = rowsByAccount.get(row.account_id) ?? [];
      list.push(row);
      rowsByAccount.set(row.account_id, list);
    });

    const mapped: Record<
      string,
      ImportCategorySuggestResponse["suggestions"][number]
    > = {};

    for (const ctx of contexts) {
      const accountRows = rowsByAccount.get(ctx.account_id) ?? [];
      const transactions: ImportCategorySuggestRequest["transactions"] = [];
      for (const row of accountRows) {
        if (row.rule_applied) continue;
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
      const body = importCategorySuggestRequestSchema.parse(payload);

      const response: ImportCategorySuggestResponse = yield call(
        callApiWithAuth,
        {
          path: "/imports/suggest-categories",
          method: "POST",
          body,
          schema: importCategorySuggestResponseSchema,
        },
        { loadingKey: `imports-suggest-${ctx.account_id}` },
      );
      const parsed = importCategorySuggestResponseSchema.parse(response);
      parsed.suggestions.forEach((suggestion) => {
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
