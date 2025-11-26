import {
  Check,
  Download,
  FileSpreadsheet,
  Loader2,
  Shield,
  UploadCloud,
} from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAccountsApi,
  useCategoriesApi,
  useImportsApi,
} from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import type {
  ImportBatch,
  ImportCreateRequest,
  ImportFileRead,
} from "@/types/api";

type LocalFile = {
  id: string;
  file?: File;
  filename: string;
  accountId?: string;
  templateId?: string;
  contentBase64?: string;
};

type RowOverride = {
  categoryId?: string;
  transferLinked?: boolean;
};

const templates = [
  { id: "default", name: "Auto-detect" },
  { id: "nordea", name: "Nordea CSV" },
  { id: "revolut", name: "Revolut CSV" },
];

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
};

export const Imports: React.FC = () => {
  const {
    batches,
    loading,
    polling,
    fetchImportBatches,
    uploadImportBatch,
    startPolling,
    stopPolling,
  } = useImportsApi();
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const [localFiles, setLocalFiles] = useState<LocalFile[]>([]);
  const [note, setNote] = useState("");
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [uploading, setUploading] = useState(false);
  const dropRef = useRef<HTMLLabelElement | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, Record<number, RowOverride>>
  >({});

  useEffect(() => {
    fetchImportBatches();
    fetchAccounts({});
    fetchCategories();
    startPolling(8000);
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestBatch: ImportBatch | undefined = useMemo(
    () => (batches && batches.length > 0 ? batches[0] : undefined),
    [batches],
  );

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
      const filesPayload = await Promise.all(
        localFiles.map(async (lf) => {
          const content =
            lf.contentBase64 || (lf.file ? await toBase64(lf.file) : "");
          return {
            filename: lf.filename,
            content_base64: content,
            account_id: lf.accountId,
            template_id: lf.templateId,
          };
        }),
      );
      const payload: ImportCreateRequest = {
        files: filesPayload,
        note: note || undefined,
      };
      await uploadImportBatch(payload);
      setActiveStep(2);
      fetchImportBatches();
      setLocalFiles([]);
    } finally {
      setUploading(false);
    }
  };

  const errorCsv = useMemo(() => {
    if (!latestBatch?.files) return null;
    const lines: string[] = ["filename,row,message"];
    latestBatch.files.forEach((file) => {
      file.errors?.forEach((err) =>
        lines.push(`${file.filename},${err.row_number},${err.message}`),
      );
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    return URL.createObjectURL(blob);
  }, [latestBatch]);

  const applyOverride = (
    fileId: string,
    rowIndex: number,
    patch: RowOverride,
  ) => {
    setOverrides((prev) => {
      const fileOverrides = prev[fileId] ? { ...prev[fileId] } : {};
      fileOverrides[rowIndex] = { ...fileOverrides[rowIndex], ...patch };
      return { ...prev, [fileId]: fileOverrides };
    });
  };

  const renderPreview = (file: ImportFileRead) => {
    const rows = file.preview_rows || [];
    const errorsByRow = new Map<number, string>(
      (file.errors || []).map((err) => [err.row_number, err.message]),
    );
    return (
      <div
        key={file.id}
        className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
      >
        <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-slate-500" />
            {file.filename}
          </div>
          <div
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              badgeTone[file.status] || "",
            )}
          >
            {file.status}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Suggested Category</TableHead>
              <TableHead>Transfer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-slate-500">
                  No preview rows
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => {
                const err = errorsByRow.get(idx + 1);
                const override = overrides[file.id]?.[idx] || {};
                const suggested = row.suggested_category || "Unassigned";
                return (
                  <TableRow key={idx} className={err ? "bg-rose-50" : ""}>
                    <TableCell>{row.date || row.occurred_at || "—"}</TableCell>
                    <TableCell>{row.description || row.memo || "—"}</TableCell>
                    <TableCell className="font-semibold text-slate-900">
                      {row.amount || row.value || "—"}
                    </TableCell>
                    <TableCell>
                      {err ? (
                        <span className="text-rose-600">{err}</span>
                      ) : (
                        "OK"
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="rounded border border-slate-200 px-2 py-1 text-left text-sm text-slate-800">
                          {override.categoryId
                            ? categories.find(
                                (c) => c.id === override.categoryId,
                              )?.name || "Custom"
                            : suggested}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="start"
                          className="max-h-60 w-56 overflow-auto"
                        >
                          <DropdownMenuLabel>Pick category</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              applyOverride(file.id, idx, {
                                categoryId: undefined,
                              })
                            }
                          >
                            Keep suggested ({suggested})
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {categories.map((cat) => (
                            <DropdownMenuItem
                              key={cat.id}
                              onClick={() =>
                                applyOverride(file.id, idx, {
                                  categoryId: cat.id,
                                })
                              }
                            >
                              {cat.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      <label className="flex items-center gap-2 text-slate-700">
                        <input
                          type="checkbox"
                          checked={
                            override.transferLinked ??
                            Boolean(row.transfer_match)
                          }
                          onChange={(e) =>
                            applyOverride(file.id, idx, {
                              transferLinked: e.target.checked,
                            })
                          }
                        />
                        {row.transfer_match?.reason || "Transfer match"}
                      </label>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Imports
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Upload & map bank files
          </h1>
          <p className="text-sm text-slate-500">
            Multi-file dropzone with AI suggestions and transfer detection.
            Templates per account are supported.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          {polling ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />{" "}
              Checking status
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[1, 2, 3].map((step) => (
          <Card
            key={step}
            className={cn(
              "border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]",
              activeStep === step && "border-slate-400",
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div>
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Step {step}
                </p>
                <CardTitle className="text-sm text-slate-800">
                  {step === 1 && "Select files"}
                  {step === 2 && "Review mapping"}
                  {step === 3 && "Summary"}
                </CardTitle>
              </div>
              {activeStep > step ? (
                <Check className="h-4 w-4 text-emerald-600" />
              ) : null}
            </CardHeader>
            <CardContent className="text-sm text-slate-700">
              {step === 1 && (
                <div className="space-y-3">
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
                      Drop CSV or XLSX files
                    </p>
                    <p className="text-xs text-slate-500">
                      You can add multiple files and assign accounts/templates.
                    </p>
                    <input
                      type="file"
                      multiple
                      accept=".csv, .xlsx"
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
                            value={lf.templateId || "default"}
                            onChange={(e) =>
                              updateLocal(lf.id, { templateId: e.target.value })
                            }
                          >
                            {templates.map((tpl) => (
                              <option key={tpl.id} value={tpl.id}>
                                {tpl.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => removeLocal(lf.id)}
                            className="text-slate-500"
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm text-slate-700">
                      Note (optional)
                    </label>
                    <textarea
                      className="min-h-[60px] rounded border border-slate-200 px-3 py-2"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g., January statements"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={upload}
                      disabled={uploading || localFiles.length === 0}
                      className="gap-2"
                    >
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UploadCloud className="h-4 w-4" />
                      )}
                      Upload & review
                    </Button>
                  </div>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-3">
                  {loading && <Skeleton className="h-24 w-full" />}
                  {!latestBatch ? (
                    <p className="text-slate-500">
                      No imports yet. Upload files to preview.
                    </p>
                  ) : null}
                  {latestBatch?.files?.map(renderPreview)}
                  <div className="flex justify-end">
                    <Button
                      variant="default"
                      className="gap-2"
                      onClick={() => setActiveStep(3)}
                      disabled={!latestBatch}
                    >
                      Confirm mapping
                    </Button>
                  </div>
                </div>
              )}
              {step === 3 && (
                <div className="space-y-3 text-sm text-slate-700">
                  {latestBatch ? (
                    <>
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <p className="text-sm font-semibold text-slate-800">
                          Summary
                        </p>
                        <p className="text-xs text-slate-600">
                          Files: {latestBatch.file_count} • Rows:{" "}
                          {latestBatch.total_rows} • Errors:{" "}
                          {latestBatch.total_errors}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-2"
                          onClick={() => fetchImportBatches()}
                        >
                          Refresh status
                        </Button>
                        {errorCsv ? (
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="gap-2"
                          >
                            <a href={errorCsv} download="import-errors.csv">
                              <Download className="h-4 w-4" /> Download errors
                            </a>
                          </Button>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="text-slate-500">
                      Upload files to see a summary.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Imports;
