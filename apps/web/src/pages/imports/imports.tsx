import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { apiFetch } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { AccountType, TaxEventType } from "@/types/api";
import type {
  BankImportType,
  ImportCommitRow,
  ImportCreateRequest,
  ImportRowRead,
  SubscriptionListResponse,
  SubscriptionRead,
} from "@/types/api";
import {
  bankImportTypeSchema,
  subscriptionListSchema,
  subscriptionSchema,
} from "@/types/schemas";

const trimmedString = z.string().trim().optional();

const nullableTrimmedString = z.string().trim().nullable().optional();

const uploadFormSchema = z.object({
  files: z
    .array(
      z
        .object({
          clientId: z.string(),
          filename: z.string().min(1, "Filename required"),
          accountId: z.string().optional(),
          bankType: bankImportTypeSchema.optional(),
          contentBase64: z.string().optional(),
          file: z.any().optional(),
        })
        .superRefine((file, ctx) => {
          if (!file.bankType) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Select a bank",
              path: ["bankType"],
            });
          }
          if (!file.file && !file.contentBase64) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Attach a file",
              path: ["file"],
            });
          }
        }),
    )
    .min(1, "Add at least one file"),
  note: z.string().trim().optional(),
});

const commitRowSchema = z.object({
  row_id: z.string(),
  description: trimmedString,
  amount: trimmedString,
  occurred_at: trimmedString,
  category_id: nullableTrimmedString,
  account_id: nullableTrimmedString,
  transfer_account_id: nullableTrimmedString,
  subscription_id: nullableTrimmedString,
  tax_event_type: z.nativeEnum(TaxEventType).nullable().optional(),
  delete: z.boolean().optional(),
});

const commitFormSchema = z.object({
  rows: z.array(commitRowSchema),
});

type UploadFormValues = z.infer<typeof uploadFormSchema>;
type CommitFormValues = z.infer<typeof commitFormSchema>;

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",").pop() || "");
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

const badgeTone: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-800",
  error: "bg-rose-100 text-rose-800",
  empty: "bg-slate-100 text-slate-700",
  staged: "bg-blue-100 text-blue-800",
  committed: "bg-emerald-100 text-emerald-800",
};

const toStringValue = (value: unknown): string =>
  value === null || value === undefined ? "" : String(value);

const dayFromDateText = (value?: string | null) => {
  if (!value) return undefined;
  const day = Number.parseInt(value.slice(8, 10), 10);
  return Number.isFinite(day) && day >= 1 && day <= 31 ? day : undefined;
};

const bankOptions: { id: BankImportType; label: string }[] = [
  { id: "circle_k_mastercard", label: "Circle K Mastercard" },
  { id: "seb", label: "SEB" },
  { id: "swedbank", label: "Swedbank" },
];

const deriveRowDefaults = (
  row: ImportRowRead,
  fileAccountId?: string | null,
): CommitFormValues["rows"][number] => {
  const base = (row.data || {}) as Record<string, unknown>;
  const dateValue =
    toStringValue(base["date"] ?? base["occurred_at"] ?? base["posted_at"])
      .trim()
      .slice(0, 10) || undefined;
  const amountValue =
    toStringValue(base["amount"] ?? base["value"] ?? "").trim() || undefined;
  const descriptionValue =
    toStringValue(
      base["description"] ?? base["memo"] ?? base["text"] ?? "",
    ).trim() || undefined;

  return {
    row_id: row.id,
    description: descriptionValue,
    amount: amountValue,
    occurred_at: dateValue,
    category_id: null,
    account_id: fileAccountId ?? null,
    transfer_account_id: null,
    subscription_id: row.suggested_subscription_id ?? null,
    tax_event_type: null,
    delete: false,
  };
};

export const Imports: React.FC = () => {
  const {
    loading,
    saving,
    session,
    startImportSession,
    appendImportFiles,
    fetchImportSession,
    commitImportSession,
    resetImportSession,
  } = useImportsApi();
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const token = useAppSelector(selectToken);
  const dropRef = useRef<HTMLLabelElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRead[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);

  const uploadForm = useForm<UploadFormValues>({
    resolver: zodResolver(uploadFormSchema),
    defaultValues: { files: [], note: "" },
  });

  const {
    fields: fileFields,
    append: appendFile,
    remove: removeFile,
    update: updateFile,
  } = useFieldArray({
    control: uploadForm.control,
    name: "files",
  });

  const commitForm = useForm<CommitFormValues>({
    resolver: zodResolver(commitFormSchema),
    defaultValues: { rows: [] },
  });

  const { fields: commitFields, replace: replaceCommitRows } = useFieldArray({
    control: commitForm.control,
    name: "rows",
  });

  useEffect(() => {
    fetchAccounts({});
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!token) return;
    setSubscriptionsLoading(true);
    const load = async () => {
      try {
        const { data } = await apiFetch<SubscriptionListResponse>({
          path: "/subscriptions",
          schema: subscriptionListSchema,
          token,
        });
        setSubscriptions(data.subscriptions ?? []);
      } catch (error) {
        toast.error("Unable to load subscriptions", {
          description:
            error instanceof Error
              ? error.message
              : "Please try again shortly.",
        });
      } finally {
        setSubscriptionsLoading(false);
      }
    };
    void load();
  }, [token]);

  const currentSession = session;
  const summaryFiles = useMemo(
    () => currentSession?.files ?? [],
    [currentSession?.files],
  );
  const rows: ImportRowRead[] = useMemo(
    () => currentSession?.rows ?? [],
    [currentSession?.rows],
  );

  const rowMap = useMemo(() => {
    const map = new Map<string, ImportRowRead>();
    rows.forEach((row) => map.set(row.id, row));
    return map;
  }, [rows]);

  const fileAccountMap = useMemo(() => {
    const map = new Map<string, string | null | undefined>();
    summaryFiles.forEach((file) => map.set(file.id, file.account_id));
    return map;
  }, [summaryFiles]);

  useEffect(() => {
    const defaults = rows.map((row) =>
      deriveRowDefaults(row, fileAccountMap.get(row.file_id)),
    );
    replaceCommitRows(defaults);
    commitForm.reset({ rows: defaults });
  }, [rows, commitForm, replaceCommitRows, fileAccountMap]);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).map((file) => ({
      clientId: crypto.randomUUID(),
      filename: file.name,
      file,
      bankType: undefined,
      accountId: undefined,
    }));
    appendFile(next);
  };

  const upload = uploadForm.handleSubmit(async (values) => {
    if (!values.files.length) return;
    setUploading(true);
    try {
      const filesPayload = await Promise.all(
        values.files.map(async (lf, index) => {
          const content =
            lf.contentBase64 ||
            (lf.file ? await toBase64(lf.file as File) : "");
          if (content && !lf.contentBase64) {
            uploadForm.setValue(`files.${index}.contentBase64`, content);
          }
          return {
            filename: lf.filename.trim(),
            content_base64: content,
            account_id: lf.accountId || undefined,
            bank_type: (lf.bankType as BankImportType)!,
          };
        }),
      );

      const payload: ImportCreateRequest = {
        files: filesPayload,
        note: values.note?.trim() || undefined,
      };

      if (currentSession?.id) {
        await appendImportFiles(currentSession.id, payload);
        await fetchImportSession(currentSession.id);
      } else {
        await startImportSession(payload);
      }
      uploadForm.reset({ files: [], note: "" });
    } finally {
      setUploading(false);
    }
  });

  const commit = commitForm.handleSubmit(async (values) => {
    if (!currentSession?.id || !values.rows.length) return;
    const commitRows: ImportCommitRow[] = values.rows.map((row) => ({
      row_id: row.row_id,
      category_id: row.category_id ?? undefined,
      account_id: row.account_id ?? undefined,
      transfer_account_id: row.transfer_account_id ?? undefined,
      description: row.description?.trim() || undefined,
      amount: row.amount?.trim() || undefined,
      occurred_at: row.occurred_at?.trim() || undefined,
      subscription_id: row.subscription_id ?? undefined,
      tax_event_type: row.tax_event_type ?? undefined,
      delete: Boolean(row.delete),
    }));

    await commitImportSession(currentSession.id, commitRows);
    commitForm.reset({ rows: [] });
  });

  const setRowValue = (
    rowId: string,
    key: keyof CommitFormValues["rows"][number],
    value: unknown,
  ) => {
    const index = commitFields.findIndex((field) => field.row_id === rowId);
    if (index < 0) return;
    switch (key) {
      case "description":
        commitForm.setValue(
          `rows.${index}.description`,
          (value as string | undefined) ?? undefined,
          { shouldDirty: true },
        );
        return;
      case "amount":
        commitForm.setValue(
          `rows.${index}.amount`,
          (value as string | undefined) ?? undefined,
          { shouldDirty: true },
        );
        return;
      case "occurred_at":
        commitForm.setValue(
          `rows.${index}.occurred_at`,
          (value as string | undefined) ?? undefined,
          { shouldDirty: true },
        );
        return;
      case "category_id":
        commitForm.setValue(
          `rows.${index}.category_id`,
          (value as string | null | undefined) ?? null,
          { shouldDirty: true },
        );
        return;
      case "account_id":
        commitForm.setValue(
          `rows.${index}.account_id`,
          (value as string | null | undefined) ?? null,
          { shouldDirty: true },
        );
        return;
      case "subscription_id":
        commitForm.setValue(
          `rows.${index}.subscription_id`,
          (value as string | null | undefined) ?? null,
          { shouldDirty: true },
        );
        return;
      case "transfer_account_id":
        commitForm.setValue(
          `rows.${index}.transfer_account_id`,
          (value as string | null | undefined) ?? null,
          { shouldDirty: true },
        );
        return;
      case "delete":
        commitForm.setValue(`rows.${index}.delete`, Boolean(value), {
          shouldDirty: true,
        });
        return;
      case "tax_event_type":
        commitForm.setValue(
          `rows.${index}.tax_event_type`,
          (value as TaxEventType | null | undefined) ?? null,
          { shouldDirty: true },
        );
        return;
      default:
        return;
    }
  };

  const createSubscriptionForRow = async (row: ImportRowRead) => {
    const index = commitFields.findIndex((field) => field.row_id === row.id);
    if (index < 0) return;
    const formRow = commitForm.getValues(`rows.${index}`);
    const base = deriveRowDefaults(row, fileAccountMap.get(row.file_id));
    const descriptionText = (
      formRow.description ||
      base.description ||
      ""
    ).trim();
    const dateValue = formRow.occurred_at || base.occurred_at || "";

    if (!descriptionText) {
      toast.error("Add a description first", {
        description: "Use a description to seed the subscription matcher.",
      });
      return;
    }

    if (!token) {
      toast.error("Missing session", {
        description: "Sign in again to create a subscription.",
      });
      return;
    }

    setSubscriptionsLoading(true);
    try {
      const payload = {
        name: descriptionText.slice(0, 120),
        matcher_text: descriptionText.slice(0, 255),
        matcher_day_of_month: dayFromDateText(dateValue),
        is_active: true,
      };
      const { data } = await apiFetch<SubscriptionRead>({
        path: "/subscriptions",
        method: "POST",
        body: payload,
        schema: subscriptionSchema,
        token,
      });
      setSubscriptions((prev) => [
        data,
        ...prev.filter((s) => s.id !== data.id),
      ]);
      setRowValue(row.id, "subscription_id", data.id);
      toast.success("Subscription created", {
        description: data.name,
      });
    } catch (error) {
      toast.error("Unable to create subscription", {
        description:
          error instanceof Error ? error.message : "Please try again shortly.",
      });
    } finally {
      setSubscriptionsLoading(false);
    }
  };

  const watchedRows = commitForm.watch("rows") ?? [];
  const loanAccounts = useMemo(
    () => accounts.filter((acc) => acc.account_type === AccountType.DEBT),
    [accounts],
  );

  return (
    <MotionPage className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Imports
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Stage, review, then save
          </h1>
          <p className="text-sm text-slate-500">
            Upload multiple files, get AI suggestions, edit inline, and commit
            when ready.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {loading || uploading ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              Processing
            </span>
          ) : null}
          {saving ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              Saving
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-800">
              Upload files (add more anytime)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label
              ref={dropRef}
              onDragOver={(e) => {
                e.preventDefault();
                dropRef.current?.classList.add("border-slate-400");
              }}
              onDragLeave={() =>
                dropRef.current?.classList.remove("border-slate-400")
              }
              onDrop={(e) => {
                e.preventDefault();
                dropRef.current?.classList.remove("border-slate-400");
                handleFiles(e.dataTransfer.files);
              }}
              className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-slate-400"
            >
              <UploadCloud className="h-8 w-8 text-slate-500" />
              <p className="mt-2 text-sm font-medium text-slate-800">
                Drop bank XLSX files
              </p>
              <p className="text-xs text-slate-500">
                Assign the bank type per file. You can upload more after
                staging.
              </p>
              <input
                type="file"
                multiple
                accept=".xlsx"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>

            <div className="space-y-2">
              {fileFields.length === 0 ? (
                <p className="text-slate-500">No files added yet.</p>
              ) : (
                fileFields.map((lf, idx) => (
                  <div
                    key={lf.id}
                    className="grid grid-cols-[1.2fr,1fr,1fr,auto] items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium text-slate-800">
                      {lf.filename}
                    </span>
                    <select
                      className="rounded border border-slate-200 px-2 py-1 text-sm"
                      value={(lf.accountId as string | undefined) || ""}
                      onChange={(e) =>
                        updateFile(idx, {
                          ...lf,
                          accountId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">Account (optional)</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_type} - {acc.id.slice(0, 6)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded border border-slate-200 px-2 py-1 text-sm"
                      value={(lf.bankType as string | undefined) || ""}
                      onChange={(e) =>
                        updateFile(idx, {
                          ...lf,
                          bankType: (e.target.value || undefined) as
                            | BankImportType
                            | undefined,
                        })
                      }
                    >
                      <option value="">Select bank</option>
                      {bankOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeFile(idx)}
                      className="text-slate-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
              {uploadForm.formState.errors.files ? (
                <p className="text-xs text-rose-600">
                  {uploadForm.formState.errors.files.root?.message ??
                    uploadForm.formState.errors.files?.message ??
                    ""}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-slate-700">Note (optional)</label>
              <textarea
                className="min-h-[60px] rounded border border-slate-200 px-3 py-2"
                {...uploadForm.register("note")}
                placeholder="e.g., January statements"
              />
            </div>

            <div className="flex justify-end gap-2">
              {currentSession ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-slate-600"
                  onClick={() => {
                    resetImportSession();
                    commitForm.reset({ rows: [] });
                  }}
                >
                  Reset session
                </Button>
              ) : null}
              <Button
                onClick={() => void upload()}
                disabled={uploading || fileFields.length === 0}
                className="gap-2"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Stage files
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-800">
              Session summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-700">
            {currentSession ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Session</span>
                  <span className="text-xs font-semibold text-slate-900">
                    {currentSession.id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Files</span>
                  <span className="font-semibold text-slate-900">
                    {currentSession.file_count}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Rows</span>
                  <span className="font-semibold text-slate-900">
                    {currentSession.total_rows}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Errors</span>
                  <span className="font-semibold text-slate-900">
                    {currentSession.total_errors}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Status</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      badgeTone[currentSession.status] ||
                        "bg-slate-100 text-slate-700",
                    )}
                  >
                    {currentSession.status}
                  </span>
                </div>
                <Button
                  disabled={!rows.length || saving}
                  className="mt-2 w-full gap-2"
                  onClick={() => void commit()}
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Save all to transactions
                </Button>
              </>
            ) : (
              <p className="text-slate-500">
                Stage files to see a session summary.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-slate-800">
            Staged transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && !rows.length ? (
            <Skeleton className="h-32 w-full" />
          ) : null}
          {!rows.length ? (
            <p className="text-sm text-slate-500">
              No staged rows yet. Upload files to see parsed transactions.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Suggested</TableHead>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead>Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commitFields.map((field, idx) => {
                  const row = rowMap.get(field.row_id);
                  if (!row) return null;
                  const formRow = watchedRows[idx] ?? field;
                  const suggestedSubName = row.suggested_subscription_name;
                  const suggestedSubId = row.suggested_subscription_id;
                  const suggestedSubConfidence =
                    row.suggested_subscription_confidence;
                  const suggestedSubReason = row.suggested_subscription_reason;

                  return (
                    <TableRow key={field.id}>
                      <TableCell className="min-w-[120px]">
                        <input
                          type="date"
                          value={formRow.occurred_at ?? ""}
                          onChange={(e) =>
                            setRowValue(
                              row.id,
                              "occurred_at",
                              e.target.value || undefined,
                            )
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="text"
                          value={formRow.description ?? ""}
                          onChange={(e) =>
                            setRowValue(row.id, "description", e.target.value)
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                          placeholder="Description"
                        />
                        {row.suggested_reason ? (
                          <p className="text-xs text-slate-500">
                            {row.suggested_reason}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="min-w-[120px]">
                        <input
                          type="text"
                          value={formRow.amount ?? ""}
                          onChange={(e) =>
                            setRowValue(row.id, "amount", e.target.value)
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                        />
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {row.rule_applied ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                                Rule hit
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                No rule
                              </span>
                            )}
                            {row.rule_summary ? (
                              <span className="text-[11px] text-slate-500">
                                {row.rule_summary}
                              </span>
                            ) : null}
                          </div>
                          <select
                            className="rounded border border-slate-200 px-2 py-1 text-sm"
                            value={formRow.category_id ?? ""}
                            disabled={Boolean(formRow.tax_event_type)}
                            onChange={(e) =>
                              setRowValue(
                                row.id,
                                "category_id",
                                e.target.value || null,
                              )
                            }
                          >
                            <option value="">
                              {row.suggested_category
                                ? `Suggested: ${row.suggested_category}`
                                : "Pick category"}
                            </option>
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                          </select>
                          <select
                            className="rounded border border-slate-200 px-2 py-1 text-sm"
                            value={formRow.tax_event_type ?? ""}
                            onChange={(e) => {
                              const value = e.target.value;
                              const next =
                                value === TaxEventType.PAYMENT
                                  ? TaxEventType.PAYMENT
                                  : value === TaxEventType.REFUND
                                    ? TaxEventType.REFUND
                                    : null;
                              setRowValue(row.id, "tax_event_type", next);
                              if (next) {
                                setRowValue(row.id, "category_id", null);
                                setRowValue(row.id, "subscription_id", null);
                              }
                            }}
                          >
                            <option value="">Tax: none</option>
                            <option value="payment">Tax: payment</option>
                            <option value="refund">Tax: refund</option>
                          </select>
                          {row.suggested_confidence ? (
                            <span className="text-xs text-slate-500">
                              Confidence{" "}
                              {Math.round(row.suggested_confidence * 100)}%
                            </span>
                          ) : null}
                          {row.transfer_match ? (
                            <span className="text-xs text-slate-500">
                              Transfer? {row.transfer_match.reason}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <div className="flex flex-col gap-1">
                          <select
                            className="rounded border border-slate-200 px-2 py-1 text-sm"
                            value={formRow.subscription_id ?? ""}
                            disabled={Boolean(formRow.tax_event_type)}
                            onChange={async (e) => {
                              const value = e.target.value;
                              if (value === "__create__") {
                                await createSubscriptionForRow(row);
                                return;
                              }
                              setRowValue(
                                row.id,
                                "subscription_id",
                                value || null,
                              );
                            }}
                          >
                            <option value="">
                              {suggestedSubName
                                ? `Suggested: ${suggestedSubName}`
                                : "No subscription"}
                            </option>
                            {suggestedSubId ? (
                              <option value={suggestedSubId}>
                                Use suggested
                                {suggestedSubConfidence
                                  ? ` (${Math.round(
                                      suggestedSubConfidence * 100,
                                    )}%)`
                                  : ""}
                              </option>
                            ) : null}
                            {subscriptions.map((sub) => (
                              <option key={sub.id} value={sub.id}>
                                {sub.name}
                              </option>
                            ))}
                            <option value="__create__">
                              Create new from description
                            </option>
                          </select>
                          {suggestedSubReason ? (
                            <span className="text-xs text-slate-500">
                              Suggestion: {suggestedSubReason}
                            </span>
                          ) : null}
                          {formRow.subscription_id &&
                          suggestedSubId === formRow.subscription_id ? (
                            <span className="text-xs text-emerald-600">
                              Suggested applied
                            </span>
                          ) : null}
                          {subscriptionsLoading ? (
                            <span className="text-xs text-slate-500">
                              Loading subscriptions...
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <select
                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                          value={
                            formRow.account_id ??
                            fileAccountMap.get(row.file_id) ??
                            ""
                          }
                          onChange={(e) =>
                            setRowValue(
                              row.id,
                              "account_id",
                              e.target.value || null,
                            )
                          }
                        >
                          <option value="">Use file/default account</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.account_type} - {acc.id.slice(0, 6)}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <select
                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                          value={formRow.transfer_account_id ?? ""}
                          onChange={(e) =>
                            setRowValue(
                              row.id,
                              "transfer_account_id",
                              e.target.value || null,
                            )
                          }
                        >
                          <option value="">No loan</option>
                          {loanAccounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name || "Loan"} - {acc.id.slice(0, 6)}
                            </option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-slate-500">
                          Links this row as a transfer to the loan.
                        </p>
                      </TableCell>
                      <TableCell className="min-w-[80px]">
                        <Controller
                          control={commitForm.control}
                          name={`rows.${idx}.delete` as const}
                          render={({ field: { value, onChange } }) => (
                            <label className="flex items-center gap-2 text-slate-700">
                              <input
                                type="checkbox"
                                checked={Boolean(value)}
                                onChange={(e) => onChange(e.target.checked)}
                              />
                              Remove
                            </label>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </MotionPage>
  );
};

export default Imports;
