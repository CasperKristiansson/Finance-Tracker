import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { selectToken } from "@/features/auth/authSlice";
import {
  useAccountsApi,
  useCategoriesApi,
  useImportsApi,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type {
  AccountWithBalance,
  ImportCommitRequest,
  ImportPreviewRequest,
  ImportPreviewResponse,
  TaxEventType,
} from "@/types/api";
import { TaxEventType as TaxEventTypeEnum } from "@/types/api";

type StepKey = 1 | 2 | 3 | 4 | 5;

type LocalFile = {
  id: string;
  file: File;
  filename: string;
  accountId: string | null;
};

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",").pop() || "");
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

const noteSchema = z.object({
  note: z.string().trim().optional(),
});

type NoteValues = z.infer<typeof noteSchema>;

const commitRowSchema = z.object({
  id: z.string(),
  account_id: z.string(),
  occurred_at: z.string(),
  amount: z.string(),
  description: z.string(),
  category_id: z.string().nullable().optional(),
  subscription_id: z.string().nullable().optional(),
  transfer_account_id: z.string().nullable().optional(),
  tax_event_type: z.enum(TaxEventTypeEnum).nullable().optional(),
  delete: z.boolean().optional(),
});

const commitFormSchema = z.object({
  rows: z.array(commitRowSchema),
});

type CommitFormValues = z.infer<typeof commitFormSchema>;

const steps: Array<{ key: StepKey; label: string; description: string }> = [
  { key: 1, label: "Upload", description: "Choose one or more XLSX files." },
  { key: 2, label: "Map accounts", description: "Pick an account per file." },
  { key: 3, label: "Parse", description: "Parse files and get suggestions." },
  { key: 4, label: "Audit", description: "Review and adjust rows." },
  {
    key: 5,
    label: "Submit",
    description: "Create transactions in the ledger.",
  },
];

const bankLabel = (
  value: AccountWithBalance["bank_import_type"] | null | undefined,
) => {
  switch (value) {
    case "swedbank":
      return "Swedbank";
    case "seb":
      return "SEB";
    case "circle_k_mastercard":
      return "Circle K Mastercard";
    default:
      return "None";
  }
};

export const Imports: React.FC = () => {
  const token = useAppSelector(selectToken);
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const {
    preview,
    loading,
    saving,
    suggesting,
    suggestions,
    suggestionsError,
    error,
    previewImports,
    commitImports,
    suggestCategories,
    resetImports,
  } = useImportsApi();

  const [step, setStep] = useState<StepKey>(1);
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [commitTriggered, setCommitTriggered] = useState(false);
  const [suggestionsRequested, setSuggestionsRequested] = useState(false);
  const [autoParseRequested, setAutoParseRequested] = useState(false);

  const noteForm = useForm<NoteValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note: "" },
  });

  const commitForm = useForm<CommitFormValues>({
    resolver: zodResolver(commitFormSchema),
    defaultValues: { rows: [] },
  });

  const { fields: commitRows, replace: replaceCommitRows } = useFieldArray({
    control: commitForm.control,
    name: "rows",
  });

  useEffect(() => {
    fetchAccounts({});
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!preview) return;
    if (commitRows.length) return;
    const defaults: CommitFormValues["rows"] = preview.rows.map((row) => ({
      id: row.id,
      account_id: row.account_id,
      occurred_at: row.occurred_at,
      amount: row.amount,
      description: row.description,
      category_id: row.rule_applied
        ? (row.suggested_category_id ?? null)
        : null,
      subscription_id: row.suggested_subscription_id ?? null,
      transfer_account_id: null,
      tax_event_type: null,
      delete: false,
    }));
    replaceCommitRows(defaults);
    commitForm.reset({ rows: defaults });
  }, [preview, commitRows.length, commitForm, replaceCommitRows]);

  useEffect(() => {
    if (!commitTriggered) return;
    if (saving) return;
    if (error) {
      setCommitTriggered(false);
      return;
    }
    if (preview) return;

    setCommitTriggered(false);
    setStep(1);
    setFiles([]);
    noteForm.reset({ note: "" });
    commitForm.reset({ rows: [] });
    setSuggestionsRequested(false);
  }, [commitTriggered, saving, preview, error, noteForm, commitForm]);

  useEffect(() => {
    const hasErrors = preview
      ? preview.files.some((file) => (file.error_count ?? 0) > 0)
      : false;
    if (!preview || hasErrors) {
      setSuggestionsRequested(false);
      return;
    }
    if (suggestionsRequested) return;
    if (!categories.length) return;
    if (Object.keys(suggestions).length) return;
    if (suggesting) return;

    suggestCategories(preview);
    setSuggestionsRequested(true);
  }, [
    preview,
    suggestionsRequested,
    categories.length,
    suggestions,
    suggesting,
    suggestCategories,
  ]);

  useEffect(() => {
    if (!Object.keys(suggestions).length) return;
    commitRows.forEach((row, idx) => {
      const suggestion = suggestions[row.id];
      if (!suggestion?.category_id) return;
      const currentCategory = commitForm.getValues(`rows.${idx}.category_id`);
      if (currentCategory) return;
      const taxEvent = commitForm.getValues(`rows.${idx}.tax_event_type`);
      if (taxEvent) return;
      const isDeleted = commitForm.getValues(`rows.${idx}.delete`);
      if (isDeleted) return;
      commitForm.setValue(`rows.${idx}.category_id`, suggestion.category_id, {
        shouldDirty: true,
      });
    });
  }, [suggestions, commitRows, commitForm]);

  useEffect(() => {
    if (!preview) return;
    if (step !== 3) return;
    if (preview.files.some((file) => (file.error_count ?? 0) > 0)) return;
    setStep(4);
  }, [preview, step]);

  const accountById = useMemo(() => {
    const map = new Map<string, AccountWithBalance>();
    accounts.forEach((acc) => map.set(acc.id, acc));
    return map;
  }, [accounts]);

  const mappedFilesReady = useMemo(
    () => files.length > 0 && files.every((f) => Boolean(f.accountId)),
    [files],
  );

  const previewHasErrors = useMemo(() => {
    if (!preview) return false;
    return preview.files.some((f) => (f.error_count ?? 0) > 0);
  }, [preview]);

  const canProceedToAudit = Boolean(preview) && !previewHasErrors;

  const handleSelectFiles = (list: FileList | null) => {
    if (!list) return;
    const next: LocalFile[] = Array.from(list).map((file) => ({
      id: crypto.randomUUID(),
      file,
      filename: file.name,
      accountId: null,
    }));
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileAccount = (id: string, accountId: string | null) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, accountId } : f)),
    );
  };

  const goNext = () => {
    if (step === 1) {
      if (!files.length) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!mappedFilesReady) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!canProceedToAudit) return;
      setStep(4);
      return;
    }
    if (step === 4) {
      setStep(5);
      return;
    }
  };

  const goBack = () => {
    if (step === 1) return;
    if (step === 2) {
      setStep(1);
      return;
    }
    if (step === 3) {
      resetImports();
      setStep(2);
      return;
    }
    if (step === 4) {
      setStep(3);
      return;
    }
    if (step === 5) {
      setStep(4);
      return;
    }
  };

  const parse = useCallback(async () => {
    if (!token) {
      toast.error("Missing session", { description: "Please sign in again." });
      return;
    }
    if (!mappedFilesReady) return;

    setSuggestionsRequested(false);
    const note = noteForm.getValues("note")?.trim() || undefined;
    const filesPayload: ImportPreviewRequest["files"] = await Promise.all(
      files.map(async (f) => ({
        filename: f.filename,
        content_base64: await toBase64(f.file),
        account_id: f.accountId!,
      })),
    );
    previewImports({ files: filesPayload, note });
  }, [files, mappedFilesReady, noteForm, previewImports, token]);

  useEffect(() => {
    if (step !== 3) {
      setAutoParseRequested(false);
      return;
    }
    if (autoParseRequested) return;
    if (!mappedFilesReady) return;
    if (loading) return;
    if (preview) return;

    setAutoParseRequested(true);
    void parse();
  }, [step, autoParseRequested, mappedFilesReady, loading, preview, parse]);

  const submit = commitForm.handleSubmit(async (values) => {
    if (!token) {
      toast.error("Missing session", { description: "Please sign in again." });
      return;
    }
    const note = noteForm.getValues("note")?.trim() || undefined;
    const payload: ImportCommitRequest = {
      note,
      rows: values.rows.map((row) => ({
        id: row.id,
        account_id: row.account_id,
        occurred_at: row.occurred_at,
        amount: row.amount,
        description: row.description,
        category_id: row.category_id ?? null,
        subscription_id: row.subscription_id ?? null,
        transfer_account_id: row.transfer_account_id ?? null,
        tax_event_type:
          (row.tax_event_type as TaxEventType | null | undefined) ?? null,
        delete: Boolean(row.delete),
      })),
    };
    commitImports(payload);
    setCommitTriggered(true);
  });

  const stepper = (
    <div className="grid gap-3 md:grid-cols-5">
      {steps.map((s) => {
        const active = s.key === step;
        const done = s.key < step;
        return (
          <div
            key={s.key}
            className={cn(
              "rounded-lg border bg-white p-3",
              active ? "border-slate-300" : "border-slate-200 opacity-80",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Step {s.key}
              </span>
              {done ? (
                <span className="text-xs font-semibold text-emerald-700">
                  Done
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {s.label}
            </div>
            <div className="mt-1 text-xs text-slate-500">{s.description}</div>
          </div>
        );
      })}
    </div>
  );

  return (
    <MotionPage className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Imports
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Upload, map, parse, audit, submit
          </h1>
          <p className="text-sm text-slate-500">
            Files are never stored. Transactions are created only when you
            submit.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {loading ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              Parsing
            </span>
          ) : null}
          {saving ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              Submitting
            </span>
          ) : null}
        </div>
      </div>

      {stepper}

      {error ? (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="py-4 text-sm text-rose-700">
            {error}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-slate-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-800">
            {steps.find((s) => s.key === step)?.label}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 ? (
            <>
              <label className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-slate-400">
                <UploadCloud className="h-8 w-8 text-slate-500" />
                <p className="mt-2 text-sm font-medium text-slate-800">
                  Drop bank XLSX files
                </p>
                <p className="text-xs text-slate-500">
                  You will map each file to an account in the next step.
                </p>
                <input
                  type="file"
                  multiple
                  accept=".xlsx"
                  className="hidden"
                  onChange={(e) => handleSelectFiles(e.target.files)}
                />
              </label>

              {files.length ? (
                <div className="space-y-2">
                  {files.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {f.filename}
                        </p>
                        <p className="text-xs text-slate-500">
                          {(f.file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-slate-500"
                        onClick={() => removeFile(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No files selected yet.</p>
              )}

              <div className="space-y-2">
                <label className="text-sm text-slate-700">
                  Note (optional)
                </label>
                <textarea
                  className="min-h-[60px] w-full rounded border border-slate-200 px-3 py-2"
                  {...noteForm.register("note")}
                  placeholder="e.g., January statements"
                />
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <p className="text-sm text-slate-600">
                Select the account for each file. The account&apos;s statement
                format determines how the file is parsed.
              </p>
              <div className="space-y-2">
                {files.map((f) => {
                  const account = f.accountId
                    ? accountById.get(f.accountId)
                    : undefined;
                  const bankType = account?.bank_import_type ?? null;
                  return (
                    <div
                      key={f.id}
                      className="grid grid-cols-[1.3fr,1fr,auto] items-center gap-3 rounded border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {f.filename}
                        </p>
                        <p className="text-xs text-slate-500">
                          Statement format:{" "}
                          <span className="font-semibold text-slate-700">
                            {bankLabel(bankType)}
                          </span>
                        </p>
                      </div>
                      <select
                        className="w-full rounded border border-slate-200 px-2 py-2 text-sm"
                        value={f.accountId ?? ""}
                        onChange={(e) =>
                          updateFileAccount(f.id, e.target.value || null)
                        }
                      >
                        <option value="">Select account</option>
                        {accounts.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({bankLabel(acc.bank_import_type)})
                          </option>
                        ))}
                      </select>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-slate-500"
                        onClick={() => removeFile(f.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              {!mappedFilesReady ? (
                <p className="text-xs text-rose-600">
                  Assign an account to every file to continue.
                </p>
              ) : null}
            </>
          ) : null}

          {step === 3 ? (
            <>
              <p className="text-sm text-slate-600">
                Parse the files using each account&apos;s configured statement
                format.
              </p>
              <Button
                className="gap-2"
                disabled={!mappedFilesReady || loading}
                onClick={() => void parse()}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Parse files
              </Button>

              {preview ? (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-slate-800">
                      Parse summary
                    </p>
                    {preview.files.map((f) => (
                      <div
                        key={f.id}
                        className={cn(
                          "rounded border px-3 py-2 text-sm",
                          f.error_count
                            ? "border-rose-200 bg-rose-50 text-rose-800"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{f.filename}</span>
                          <span className="text-xs font-semibold">
                            {f.row_count} rows, {f.error_count} errors
                          </span>
                        </div>
                        {f.errors?.length ? (
                          <ul className="mt-2 space-y-1 text-xs">
                            {f.errors.slice(0, 5).map((err, idx) => (
                              <li key={`${f.id}-${idx}`}>
                                Row {err.row_number}: {err.message}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  {previewHasErrors ? (
                    <p className="text-xs text-rose-600">
                      Fix errors (typically account statement format) to
                      continue.
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Parsed successfully. Continue to audit.
                    </p>
                  )}
                </>
              ) : null}
            </>
          ) : null}

          {step === 4 && preview ? (
            <>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Draft transactions
                  </p>
                  <p className="text-xs text-slate-500">
                    Edit values, apply categories, or mark rows for deletion.
                  </p>
                  {suggesting ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Suggesting categories with Bedrock…
                    </p>
                  ) : suggestionsError ? (
                    <p className="mt-1 text-xs text-rose-600">
                      Category suggestions unavailable: {suggestionsError}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!commitRows.length}
                  onClick={() => {
                    commitRows.forEach((row, idx) => {
                      const previewRow = (
                        preview as ImportPreviewResponse
                      ).rows.find((r) => r.id === row.id);
                      const nextCategory =
                        suggestions[row.id]?.category_id ??
                        previewRow?.suggested_category_id ??
                        null;
                      if (!nextCategory) return;
                      commitForm.setValue(
                        `rows.${idx}.category_id`,
                        nextCategory,
                        { shouldDirty: true },
                      );
                    });
                    toast.success("Applied suggested categories");
                  }}
                >
                  Apply suggested categories
                </Button>
              </div>

              <div className="rounded border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[56px]">Del</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Tax event</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {commitRows.map((row, idx) => {
                      const previewRow = preview.rows.find(
                        (r) => r.id === row.id,
                      );
                      const suggestedCategoryId =
                        suggestions[row.id]?.category_id ??
                        previewRow?.suggested_category_id ??
                        null;
                      const suggestedFromCategories = suggestedCategoryId
                        ? (categories.find(
                            (cat) => cat.id === suggestedCategoryId,
                          )?.name ?? null)
                        : null;
                      const suggested =
                        suggestedFromCategories ??
                        previewRow?.suggested_category_name ??
                        null;
                      const suggestedOk =
                        Boolean(suggestedCategoryId) &&
                        commitForm.watch(`rows.${idx}.category_id`) ===
                          suggestedCategoryId;
                      const related =
                        previewRow?.related_transactions?.[0] ?? null;
                      return (
                        <TableRow key={row.id} className="align-top">
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={Boolean(
                                commitForm.watch(`rows.${idx}.delete`),
                              )}
                              onChange={(e) =>
                                commitForm.setValue(
                                  `rows.${idx}.delete`,
                                  e.target.checked,
                                  {
                                    shouldDirty: true,
                                  },
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <input
                              className="w-[140px] rounded border border-slate-200 px-2 py-1 text-sm"
                              value={
                                commitForm.watch(`rows.${idx}.occurred_at`) ??
                                ""
                              }
                              onChange={(e) =>
                                commitForm.setValue(
                                  `rows.${idx}.occurred_at`,
                                  e.target.value,
                                  {
                                    shouldDirty: true,
                                  },
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <input
                                className="w-full min-w-[260px] rounded border border-slate-200 px-2 py-1 text-sm"
                                value={
                                  commitForm.watch(`rows.${idx}.description`) ??
                                  ""
                                }
                                onChange={(e) =>
                                  commitForm.setValue(
                                    `rows.${idx}.description`,
                                    e.target.value,
                                    { shouldDirty: true },
                                  )
                                }
                              />
                              {related?.category_name ? (
                                <p className="text-[11px] text-slate-500">
                                  Similar: {related.category_name} •{" "}
                                  {related.description}
                                </p>
                              ) : null}
                              {suggested ? (
                                <p className="text-[11px] text-slate-500">
                                  Suggested:{" "}
                                  <span
                                    className={cn(
                                      "font-semibold",
                                      suggestedOk
                                        ? "text-emerald-700"
                                        : "text-slate-700",
                                    )}
                                  >
                                    {suggested}
                                  </span>
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <input
                              className="w-[120px] rounded border border-slate-200 px-2 py-1 text-sm"
                              value={
                                commitForm.watch(`rows.${idx}.amount`) ?? ""
                              }
                              onChange={(e) =>
                                commitForm.setValue(
                                  `rows.${idx}.amount`,
                                  e.target.value,
                                  {
                                    shouldDirty: true,
                                  },
                                )
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <select
                              className="w-[220px] rounded border border-slate-200 px-2 py-1 text-sm"
                              value={
                                commitForm.watch(`rows.${idx}.category_id`) ??
                                ""
                              }
                              onChange={(e) =>
                                commitForm.setValue(
                                  `rows.${idx}.category_id`,
                                  e.target.value || null,
                                  { shouldDirty: true },
                                )
                              }
                              disabled={Boolean(
                                commitForm.watch(`rows.${idx}.tax_event_type`),
                              )}
                            >
                              <option value="">
                                {suggesting ? "Suggesting…" : "No category"}
                              </option>
                              {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                  {cat.name}
                                </option>
                              ))}
                            </select>
                            {suggesting &&
                            !commitForm.watch(`rows.${idx}.category_id`) ? (
                              <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Waiting for Bedrock…
                              </div>
                            ) : null}
                          </TableCell>
                          <TableCell>
                            <select
                              className="w-[160px] rounded border border-slate-200 px-2 py-1 text-sm"
                              value={
                                commitForm.watch(
                                  `rows.${idx}.tax_event_type`,
                                ) ?? ""
                              }
                              onChange={(e) =>
                                commitForm.setValue(
                                  `rows.${idx}.tax_event_type`,
                                  (e.target.value ||
                                    null) as TaxEventType | null,
                                  { shouldDirty: true },
                                )
                              }
                            >
                              <option value="">None</option>
                              <option value="payment">Payment</option>
                              <option value="refund">Refund</option>
                            </select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}

          {step === 5 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                This will create transactions in the ledger. If any row fails
                validation, nothing will be saved.
              </p>
              <Button
                className="gap-2"
                disabled={!preview || saving || previewHasErrors}
                onClick={() => void submit()}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Submit transactions
              </Button>
              <p className="text-xs text-slate-500">
                Tip: go back to adjust rows before submitting.
              </p>
            </div>
          ) : null}

          <Separator />
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={goBack}
              disabled={step === 1 || loading || saving}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {step === 3 ? (
                <Button
                  onClick={goNext}
                  disabled={!canProceedToAudit || loading || saving}
                >
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : step === 4 ? (
                <Button
                  onClick={goNext}
                  disabled={loading || saving || previewHasErrors}
                >
                  Review submit
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : step < 5 ? (
                <Button
                  onClick={goNext}
                  disabled={
                    (step === 1 && !files.length) ||
                    (step === 2 && !mappedFilesReady) ||
                    loading ||
                    saving
                  }
                >
                  Next
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={() => {
                    resetImports();
                    setFiles([]);
                    noteForm.reset({ note: "" });
                    commitForm.reset({ rows: [] });
                    setSuggestionsRequested(false);
                    setStep(1);
                  }}
                >
                  Start over
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </MotionPage>
  );
};
