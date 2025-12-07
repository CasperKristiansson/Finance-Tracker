import { Check, Loader2, Plus, Trash2, UploadCloud } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import type {
  BankImportType,
  ImportCommitRow,
  ImportCreateRequest,
  ImportRowRead,
  ImportSession,
  SubscriptionListResponse,
  SubscriptionRead,
} from "@/types/api";

type LocalFile = {
  id: string;
  file?: File;
  filename: string;
  accountId?: string;
  bankType?: BankImportType;
  contentBase64?: string;
};

type RowOverride = {
  categoryId?: string;
  accountId?: string;
  description?: string;
  amount?: string;
  occurredAt?: string;
  subscriptionId?: string;
  delete?: boolean;
};

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
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const dropRef = useRef<HTMLLabelElement | null>(null);
  const [overrides, setOverrides] = useState<Record<string, RowOverride>>({});
  const [subscriptions, setSubscriptions] = useState<SubscriptionRead[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(false);

  useEffect(() => {
    fetchAccounts({});
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!token) return;
      setSubscriptionsLoading(true);
      try {
        const { data } = await apiFetch<SubscriptionListResponse>({
          path: "/subscriptions",
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
    void loadSubscriptions();
  }, [token]);

  const currentSession: ImportSession | undefined = session;

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const next: LocalFile[] = [];
    for (const file of Array.from(files)) {
      next.push({
        id: crypto.randomUUID(),
        file,
        filename: file.name,
      });
    }
    setLocalFiles((prev) => [...prev, ...next]);
  };

  const updateLocal = (id: string, patch: Partial<LocalFile>) => {
    setLocalFiles((prev) =>
      prev.map((lf) => (lf.id === id ? { ...lf, ...patch } : lf)),
    );
  };

  const removeLocal = (id: string) => {
    setLocalFiles((prev) => prev.filter((lf) => lf.id !== id));
  };

  const upload = async () => {
    if (!localFiles.length) return;
    setUploading(true);
    try {
      const missingBank = localFiles.find((lf) => !lf.bankType);
      if (missingBank) {
        toast.error("Choose a bank for each file", {
          description: missingBank.filename,
        });
        return;
      }
      const filesPayload = await Promise.all(
        localFiles.map(async (lf) => {
          const content =
            lf.contentBase64 || (lf.file ? await toBase64(lf.file) : "");
          return {
            filename: lf.filename,
            content_base64: content,
            account_id: lf.accountId,
            bank_type: lf.bankType!,
          };
        }),
      );
      const payload: ImportCreateRequest = {
        files: filesPayload,
        note: note || undefined,
      };
      if (currentSession?.id) {
        await appendImportFiles(currentSession.id, payload);
        await fetchImportSession(currentSession.id);
      } else {
        await startImportSession(payload);
      }
      setLocalFiles([]);
    } finally {
      setUploading(false);
    }
  };

  const applyOverride = (rowId: string, patch: RowOverride) => {
    setOverrides((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], ...patch },
    }));
  };

  const clearOverrides = () => setOverrides({});

  const createSubscriptionForRow = async (row: ImportRowRead) => {
    const base = (row.data || {}) as Record<string, unknown>;
    const override = overrides[row.id];
    const descriptionText =
      (
        override?.description ??
        toStringValue(base["description"] ?? base["memo"] ?? base["text"])
      )?.trim() || "";
    const dateValue =
      override?.occurredAt ||
      toStringValue(base["date"] ?? base["occurred_at"] ?? base["posted_at"]);

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
        token,
      });
      setSubscriptions((prev) => [
        data,
        ...prev.filter((s) => s.id !== data.id),
      ]);
      applyOverride(row.id, { subscriptionId: data.id });
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

  const rows: ImportRowRead[] = useMemo(
    () => currentSession?.rows ?? [],
    [currentSession],
  );

  const commit = async () => {
    if (!currentSession?.id || !rows.length) return;
    const commitRows: ImportCommitRow[] = rows.map((row) => {
      const override = overrides[row.id];
      const baseData = (row.data || {}) as Record<string, unknown>;
      const dateValue =
        override?.occurredAt ||
        toStringValue(
          baseData["date"] ?? baseData["occurred_at"] ?? baseData["posted_at"],
        ) ||
        "";
      const amountValue =
        override?.amount ||
        toStringValue(baseData["amount"] ?? baseData["value"] ?? "");

      return {
        row_id: row.id,
        category_id: override?.categoryId,
        account_id: override?.accountId,
        description: override?.description,
        amount: amountValue ? String(amountValue) : undefined,
        occurred_at: dateValue ? String(dateValue) : undefined,
        subscription_id: override?.subscriptionId,
        delete: override?.delete || false,
      };
    });

    await commitImportSession(currentSession.id, commitRows);
    clearOverrides();
  };

  const summaryFiles = currentSession?.files || [];

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
              {localFiles.length === 0 ? (
                <p className="text-slate-500">No files added yet.</p>
              ) : (
                localFiles.map((lf) => (
                  <div
                    key={lf.id}
                    className="grid grid-cols-[1.2fr,1fr,1fr,auto] items-center gap-2 rounded border border-slate-200 bg-white px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium text-slate-800">
                      {lf.filename}
                    </span>
                    <select
                      className="rounded border border-slate-200 px-2 py-1 text-sm"
                      value={lf.accountId || ""}
                      onChange={(e) =>
                        updateLocal(lf.id, {
                          accountId: e.target.value || undefined,
                        })
                      }
                    >
                      <option value="">Account (optional)</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.account_type} • {acc.id.slice(0, 6)}
                        </option>
                      ))}
                    </select>
                    <select
                      className="rounded border border-slate-200 px-2 py-1 text-sm"
                      value={lf.bankType || ""}
                      onChange={(e) =>
                        updateLocal(lf.id, {
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
                      onClick={() => removeLocal(lf.id)}
                      className="text-slate-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm text-slate-700">Note (optional)</label>
              <textarea
                className="min-h-[60px] rounded border border-slate-200 px-3 py-2"
                value={note}
                onChange={(e) => setNote(e.target.value)}
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
                    clearOverrides();
                  }}
                >
                  Reset session
                </Button>
              ) : null}
              <Button
                onClick={upload}
                disabled={uploading || localFiles.length === 0}
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
                  onClick={commit}
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
                  <TableHead>Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const override = overrides[row.id] || {};
                  const base = (row.data || {}) as Record<string, unknown>;
                  const dateValue =
                    override.occurredAt ||
                    toStringValue(
                      base["date"] ?? base["occurred_at"] ?? base["posted_at"],
                    );
                  const descriptionValue =
                    override.description ??
                    toStringValue(
                      base["description"] ?? base["memo"] ?? base["text"],
                    );
                  const amountValue =
                    override.amount ??
                    toStringValue(base["amount"] ?? base["value"] ?? "");
                  const fileAccountId = summaryFiles.find(
                    (f) => f.id === row.file_id,
                  )?.account_id;
                  const suggestedSubName = row.suggested_subscription_name;
                  const suggestedSubId = row.suggested_subscription_id;
                  const suggestedSubConfidence =
                    row.suggested_subscription_confidence;
                  const suggestedSubReason = row.suggested_subscription_reason;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="min-w-[120px]">
                        <input
                          type="date"
                          value={
                            dateValue ? String(dateValue).slice(0, 10) : ""
                          }
                          onChange={(e) =>
                            applyOverride(row.id, {
                              occurredAt: e.target.value,
                            })
                          }
                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="text"
                          value={descriptionValue}
                          onChange={(e) =>
                            applyOverride(row.id, {
                              description: e.target.value,
                            })
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
                          value={amountValue}
                          onChange={(e) =>
                            applyOverride(row.id, { amount: e.target.value })
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
                            value={override.categoryId || ""}
                            onChange={(e) =>
                              applyOverride(row.id, {
                                categoryId: e.target.value || undefined,
                              })
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
                            value={override.subscriptionId || ""}
                            onChange={async (e) => {
                              const value = e.target.value;
                              if (value === "__create__") {
                                await createSubscriptionForRow(row);
                                return;
                              }
                              applyOverride(row.id, {
                                subscriptionId: value || undefined,
                              });
                            }}
                          >
                            <option value="">
                              {suggestedSubName
                                ? `Suggested: ${suggestedSubName}`
                                : "No subscription"}
                            </option>
                            {suggestedSubId ? (
                              <option value={suggestedSubId}>
                                Use suggested{" "}
                                {suggestedSubConfidence
                                  ? `(${Math.round(
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
                          {override.subscriptionId &&
                          suggestedSubId === override.subscriptionId ? (
                            <span className="text-xs text-emerald-600">
                              Suggested applied
                            </span>
                          ) : null}
                          {subscriptionsLoading ? (
                            <span className="text-xs text-slate-500">
                              Loading subscriptions…
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <select
                          className="w-full rounded border border-slate-200 px-2 py-1 text-sm"
                          value={override.accountId || fileAccountId || ""}
                          onChange={(e) =>
                            applyOverride(row.id, {
                              accountId: e.target.value || undefined,
                            })
                          }
                        >
                          <option value="">Use file/default account</option>
                          {accounts.map((acc) => (
                            <option key={acc.id} value={acc.id}>
                              {acc.account_type} • {acc.id.slice(0, 6)}
                            </option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell className="min-w-[80px]">
                        <label className="flex items-center gap-2 text-slate-700">
                          <input
                            type="checkbox"
                            checked={override.delete ?? false}
                            onChange={(e) =>
                              applyOverride(row.id, {
                                delete: e.target.checked,
                              })
                            }
                          />
                          Remove
                        </label>
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
