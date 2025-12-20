import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoveRight,
  Scissors,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { selectToken } from "@/features/auth/authSlice";
import {
  useAccountsApi,
  useCategoriesApi,
  useImportsApi,
} from "@/hooks/use-api";
import { renderCategoryIcon } from "@/lib/category-icons";
import { cn } from "@/lib/utils";
import type {
  AccountWithBalance,
  CategoryRead,
  ImportCommitRequest,
  ImportPreviewResponse,
  ImportPreviewRequest,
  TaxEventType,
} from "@/types/api";
import { TaxEventType as TaxEventTypeEnum } from "@/types/api";

type StepKey = 1 | 2 | 3 | 4;

type LocalFile = {
  id: string;
  file: File;
  filename: string;
  accountId: string | null;
};

type PreviewFile = ImportPreviewResponse["files"][number];

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",").pop() || "");
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });

const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return "";
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : String(value);
};

const toOccurredAt = (
  dateValue: string,
  previous: string | null | undefined,
) => {
  if (!dateValue) return "";
  const prev = String(previous ?? "");
  const time = prev.includes("T") ? prev.slice(prev.indexOf("T")) : "T00:00:00";
  return `${dateValue}${time.startsWith("T") ? time : "T00:00:00"}`;
};

const inferTaxEventType = (amount: string | null | undefined): TaxEventType => {
  const numeric = Number(amount ?? "");
  return numeric > 0 ? TaxEventTypeEnum.REFUND : TaxEventTypeEnum.PAYMENT;
};

type CategoryPickerProps = {
  value: string | null | undefined;
  categories: CategoryRead[];
  disabled?: boolean;
  missing?: boolean;
  suggesting?: boolean;
  onChange: (value: string | null) => void;
};

const CategoryPicker: React.FC<CategoryPickerProps> = ({
  value,
  categories,
  disabled,
  missing,
  suggesting,
  onChange,
}) => {
  const selected = value ? categories.find((cat) => cat.id === value) : null;
  const label = selected?.name ?? (suggesting ? "Suggesting…" : "No category");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-9 w-[240px] justify-start gap-2 px-2 text-sm font-normal",
            missing
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-slate-200 bg-white text-slate-800",
          )}
          disabled={disabled}
        >
          {selected
            ? renderCategoryIcon(
                selected.icon,
                selected.name,
                "inline-flex h-4 w-4 items-center justify-center leading-none",
              )
            : null}
          <span className="truncate">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[340px] w-[280px] overflow-auto"
      >
        <DropdownMenuItem
          onSelect={() => onChange(null)}
          className="text-slate-700"
        >
          <div className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600">
            ∅
          </div>
          No category
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {categories.map((cat) => (
          <DropdownMenuItem
            key={cat.id}
            onSelect={() => onChange(cat.id)}
            className="text-slate-800"
          >
            {renderCategoryIcon(
              cat.icon,
              cat.name,
              "inline-flex h-4 w-4 items-center justify-center leading-none",
            )}
            <span className="truncate">{cat.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

type TransferPickerProps = {
  value: string | null | undefined;
  currentAccountId: string;
  accounts: AccountWithBalance[];
  batchOptions: Array<{
    key: string;
    accountId: string;
    description: string;
    amount: string;
    occurredAt?: string | null;
    fileLabel?: string;
  }>;
  existingOptions: Array<{
    key: string;
    accountId: string;
    description: string;
    occurredAt?: string | null;
    categoryName?: string | null;
  }>;
  onSelectAccount: (accountId: string | null) => void;
  disabled?: boolean;
};

const TransferPicker: React.FC<TransferPickerProps> = ({
  value,
  currentAccountId,
  accounts,
  batchOptions,
  existingOptions,
  onSelectAccount,
  disabled,
}) => {
  const target = value ? accounts.find((acc) => acc.id === value) : null;
  const label = target ? target.name : "Mark as transfer";

  const renderOptionMeta = (
    description: string,
    occurredAt?: string | null,
    suffix?: string | null,
  ) => (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium text-slate-800">
        {description}
      </span>
      <span className="truncate text-[11px] text-slate-500">
        {occurredAt ? `${occurredAt.slice(0, 10)} • ` : ""}
        {suffix ?? ""}
      </span>
    </div>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          className="h-9 w-[240px] justify-start gap-2 px-2 text-sm font-normal"
          disabled={disabled}
        >
          <MoveRight className="h-4 w-4 text-slate-500" />
          <span className="truncate">
            {target ? `Transfer to ${label}` : label}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[420px] w-[340px] overflow-auto"
      >
        <DropdownMenuLabel className="text-[11px] text-slate-500">
          Transfer handling
        </DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={() => onSelectAccount(null)}
          className="text-slate-700"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-600">
              ∅
            </div>
            <span>Not a transfer</span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] text-slate-500">
          Link within this upload
        </DropdownMenuLabel>
        {batchOptions.length ? (
          batchOptions.map((option) => {
            const account = accounts.find((acc) => acc.id === option.accountId);
            return (
              <DropdownMenuItem
                key={option.key}
                onSelect={() => onSelectAccount(option.accountId)}
                className="flex items-start gap-2 text-slate-800"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-600">
                  {account?.name?.slice(0, 2).toUpperCase() ?? "AC"}
                </div>
                {renderOptionMeta(
                  option.description || "Transfer row",
                  option.occurredAt,
                  `${option.amount} ${option.fileLabel ? `• ${option.fileLabel}` : ""}`,
                )}
              </DropdownMenuItem>
            );
          })
        ) : (
          <DropdownMenuItem disabled className="text-slate-400">
            No other rows in this upload
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] text-slate-500">
          Link with existing transaction
        </DropdownMenuLabel>
        {existingOptions.length ? (
          existingOptions.map((option) => {
            const account = accounts.find((acc) => acc.id === option.accountId);
            return (
              <DropdownMenuItem
                key={option.key}
                onSelect={() => onSelectAccount(option.accountId)}
                className="flex items-start gap-2 text-slate-800"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-600">
                  {account?.name?.slice(0, 2).toUpperCase() ?? "AC"}
                </div>
                {renderOptionMeta(
                  option.description || "Existing transaction",
                  option.occurredAt,
                  option.categoryName ?? "Uncategorized",
                )}
              </DropdownMenuItem>
            );
          })
        ) : (
          <DropdownMenuItem disabled className="text-slate-400">
            No suggested matches in your history
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] text-slate-500">
          Create transfer event
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {accounts
            .filter((acc) => acc.id !== currentAccountId)
            .map((acc) => (
              <DropdownMenuItem
                key={acc.id}
                onSelect={() => onSelectAccount(acc.id)}
                className="flex items-start gap-2 text-slate-800"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-[10px] font-semibold text-slate-600">
                  {acc.name.slice(0, 2).toUpperCase()}
                </div>
                {renderOptionMeta(
                  acc.name,
                  null,
                  bankLabel(acc.bank_import_type),
                )}
              </DropdownMenuItem>
            ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

type SplitItem = {
  id: string;
  method: "amount" | "percent";
  value: string;
  description: string;
};

type SplitPreviewRow = ImportPreviewResponse["rows"][number] & {
  source_row_id: string;
  is_split: true;
};

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
  { key: 4, label: "Audit", description: "Review, adjust, and submit rows." },
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
  const [activeAuditFileId, setActiveAuditFileId] = useState<string | null>(
    null,
  );
  const [splitDialogOpen, setSplitDialogOpen] = useState(false);
  const [splitDraftItems, setSplitDraftItems] = useState<SplitItem[]>([]);
  const [splitBaseRow, setSplitBaseRow] = useState<{
    id: string;
    file_id: string;
    account_id: string;
    amount: string;
    description: string;
    occurred_at: string;
    row_index: number;
  } | null>(null);
  const [splitRows, setSplitRows] = useState<SplitPreviewRow[]>([]);
  const [splitRowIdsBySource, setSplitRowIdsBySource] = useState<
    Record<string, string[]>
  >({});

  const commitForm = useForm<CommitFormValues>({
    resolver: zodResolver(commitFormSchema),
    defaultValues: { rows: [] },
  });

  const watchedRows = commitForm.watch("rows");
  const missingCategoryCount = Array.isArray(watchedRows)
    ? watchedRows.reduce((count, row) => {
        if (!row) return count;
        if (row.delete) return count;
        if (row.tax_event_type) return count;
        if (row.transfer_account_id) return count;
        if (!row.category_id) return count + 1;
        return count;
      }, 0)
    : 0;
  const hasMissingCategories = missingCategoryCount > 0;

  const { fields: commitRows, replace: replaceCommitRows } = useFieldArray({
    control: commitForm.control,
    name: "rows",
    keyName: "fieldId",
  });

  useEffect(() => {
    fetchAccounts({});
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (preview) return;
    setSplitRows([]);
    setSplitRowIdsBySource({});
    setSplitBaseRow(null);
    setSplitDraftItems([]);
    setSplitDialogOpen(false);
  }, [preview]);

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
    commitForm.reset({ rows: [] });
    setSuggestionsRequested(false);
  }, [commitTriggered, saving, preview, error, commitForm]);

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
      const taxEvent = commitForm.getValues(`rows.${idx}.tax_event_type`);
      const transferAccount = commitForm.getValues(
        `rows.${idx}.transfer_account_id`,
      );
      if (taxEvent) return;
      if (transferAccount) return;
      const isDeleted = commitForm.getValues(`rows.${idx}.delete`);
      if (isDeleted) return;
      const categoryField = commitForm.getFieldState(
        `rows.${idx}.category_id`,
        commitForm.formState,
      );
      const shouldOverwrite =
        !categoryField.isDirty &&
        (currentCategory !== suggestion.category_id || !currentCategory);
      if (!shouldOverwrite) return;

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

  useEffect(() => {
    if (!preview) return;
    if (step !== 4) return;
    const firstId = preview.files[0]?.id ?? null;
    if (!firstId) return;
    setActiveAuditFileId((current) => {
      if (!current) return firstId;
      return preview.files.some((file) => file.id === current)
        ? current
        : firstId;
    });
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
  const unmappedCount = useMemo(
    () => files.filter((f) => !f.accountId).length,
    [files],
  );
  const mappedCount = files.length - unmappedCount;
  const mappedProgress = files.length
    ? Math.round((mappedCount / files.length) * 100)
    : 0;

  const previewHasErrors = useMemo(() => {
    if (!preview) return false;
    return preview.files.some((f) => (f.error_count ?? 0) > 0);
  }, [preview]);

  const canProceedToAudit = Boolean(preview) && !previewHasErrors;

  const categoriesById = useMemo(() => {
    const map = new Map<string, CategoryRead>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);
  const previewRowById = useMemo(() => {
    const map = new Map<string, ImportPreviewResponse["rows"][number]>();
    preview?.rows.forEach((row) => map.set(row.id, row));
    return map;
  }, [preview]);

  const commitIndexByRowId = useMemo(() => {
    const map = new Map<string, number>();
    commitRows.forEach((row, idx) => map.set(row.id, idx));
    return map;
  }, [commitRows]);

  const contextTxById = useMemo(() => {
    const map = new Map<
      string,
      {
        account_id?: string;
        category_name?: string | null;
        description: string;
        occurred_at?: string;
      }
    >();
    if (!preview) return map;
    preview.accounts?.forEach((ctx) => {
      [
        ...(ctx.recent_transactions ?? []),
        ...(ctx.similar_transactions ?? []),
      ].forEach((tx) => {
        map.set(tx.id, {
          account_id: tx.account_id,
          category_name: tx.category_name,
          description: tx.description,
          occurred_at: tx.occurred_at,
        });
      });
    });
    return map;
  }, [preview]);

  const similarIdsByRowId = useMemo(() => {
    const map = new Map<string, string[]>();
    if (!preview) return map;
    preview.accounts?.forEach((ctx) => {
      (ctx.similar_by_row ?? []).forEach((match) => {
        map.set(match.row_id, match.transaction_ids ?? []);
      });
    });
    return map;
  }, [preview]);

  const splitRowsByFile = useMemo(() => {
    const map = new Map<string, SplitPreviewRow[]>();
    splitRows.forEach((row) => {
      const list = map.get(row.file_id) ?? [];
      list.push(row);
      map.set(row.file_id, list);
    });
    return map;
  }, [splitRows]);

  const fileById = useMemo(() => {
    const map = new Map<string, PreviewFile>();
    if (!preview) return map;
    preview.files.forEach((file) => map.set(file.id, file));
    return map;
  }, [preview]);

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
  };

  const parse = useCallback(async () => {
    if (!token) {
      toast.error("Missing session", { description: "Please sign in again." });
      return;
    }
    if (!mappedFilesReady) return;

    setSuggestionsRequested(false);
    const filesPayload: ImportPreviewRequest["files"] = await Promise.all(
      files.map(async (f) => ({
        filename: f.filename,
        content_base64: await toBase64(f.file),
        account_id: f.accountId!,
      })),
    );
    previewImports({ files: filesPayload });
  }, [files, mappedFilesReady, previewImports, token]);

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

  const handleOpenSplitDialog = (
    row: ImportPreviewResponse["rows"][number],
  ) => {
    const idx = commitIndexByRowId.get(row.id);
    if (idx === undefined) {
      toast.error("Unable to open split dialog for this row.");
      return;
    }
    const baseRow = commitForm.getValues(`rows.${idx}`);
    const existingSplits = splitRows.filter(
      (item) => item.source_row_id === row.id,
    );
    const nextItems: SplitItem[] = existingSplits.length
      ? existingSplits.map((split) => ({
          id: split.id,
          method: "amount",
          value: Math.abs(Number(split.amount || 0)).toString(),
          description: split.description,
        }))
      : [
          {
            id: crypto.randomUUID(),
            method: "percent",
            value: "50",
            description: `${baseRow.description || row.description} (Split 1)`,
          },
          {
            id: crypto.randomUUID(),
            method: "percent",
            value: "50",
            description: `${baseRow.description || row.description} (Split 2)`,
          },
        ];

    setSplitDraftItems(nextItems);
    setSplitBaseRow({
      id: row.id,
      file_id: row.file_id,
      account_id: baseRow.account_id,
      amount: baseRow.amount,
      description: baseRow.description,
      occurred_at: baseRow.occurred_at,
      row_index: row.row_index,
    });
    setSplitDialogOpen(true);
  };

  const clearSplitsForRow = (sourceRowId: string) => {
    const splitIds = splitRowIdsBySource[sourceRowId] ?? [];
    if (!splitIds.length) return;
    const currentRows = commitForm.getValues("rows");
    const filtered = currentRows
      .filter((row) => !splitIds.includes(row.id))
      .map((row) => (row.id === sourceRowId ? { ...row, delete: false } : row));
    replaceCommitRows(filtered);
    commitForm.reset({ rows: filtered });
    setSplitRows((prev) =>
      prev.filter((row) => row.source_row_id !== sourceRowId),
    );
    setSplitRowIdsBySource((prev) => {
      const next = { ...prev };
      delete next[sourceRowId];
      return next;
    });
    toast.success("Splits removed and original row restored.");
  };

  const splitAmounts = useMemo(() => {
    if (!splitBaseRow) {
      return { computed: [] as number[], total: 0, remainder: 0 };
    }
    const baseAmount = Number(splitBaseRow.amount);
    const sign = baseAmount >= 0 ? 1 : -1;
    const computed = splitDraftItems.map((item) => {
      const raw = Number(item.value);
      if (!Number.isFinite(raw)) return 0;
      const normalized = Math.abs(raw);
      const amount =
        item.method === "percent"
          ? Math.abs(baseAmount) * (normalized / 100)
          : normalized;
      return amount * sign;
    });
    const total = computed.reduce((sum, value) => sum + value, 0);
    const remainder = baseAmount - total;
    return { computed, total, remainder };
  }, [splitBaseRow, splitDraftItems]);

  const applySplitDraft = () => {
    if (!splitBaseRow) return;
    const baseIdx = commitIndexByRowId.get(splitBaseRow.id);
    if (baseIdx === undefined) {
      toast.error("Unable to find row to split.");
      return;
    }
    const baseRows = commitForm.getValues("rows");
    const baseRow = baseRows[baseIdx];
    if (!baseRow) {
      toast.error("Unable to find row to split.");
      return;
    }
    const { computed, remainder } = splitAmounts;
    const validRemainder = Math.abs(remainder) < 0.01;
    const hasValues =
      splitDraftItems.length >= 2 &&
      splitDraftItems.every((item) => Number(item.value) > 0);
    if (!validRemainder || !hasValues) {
      toast.error(
        "Split must include at least two parts and the total must match the original amount.",
      );
      return;
    }

    const existingSplitIds = splitRowIdsBySource[splitBaseRow.id] ?? [];
    const withoutOldSplits = baseRows.filter(
      (row) => !existingSplitIds.includes(row.id),
    );
    const baseMarked = withoutOldSplits.map((row) =>
      row.id === splitBaseRow.id ? { ...row, delete: true } : row,
    );

    const newCommitRows: CommitFormValues["rows"] = [];
    const newPreviewRows: SplitPreviewRow[] = [];
    const basePreviewRow = previewRowById.get(splitBaseRow.id);
    const baseRowIndex = basePreviewRow?.row_index ?? splitBaseRow.row_index;

    computed.forEach((amount, idx) => {
      const splitId = crypto.randomUUID();
      const description =
        splitDraftItems[idx]?.description?.trim() ||
        `${splitBaseRow.description} (Split ${idx + 1})`;
      const amountText = amount.toFixed(2);
      const nextRow = {
        ...baseRow,
        id: splitId,
        amount: amountText,
        description,
        delete: false,
      };
      newCommitRows.push(nextRow);
      newPreviewRows.push({
        id: splitId,
        file_id: splitBaseRow.file_id,
        row_index: baseRowIndex + (idx + 1) / 10,
        account_id: splitBaseRow.account_id,
        occurred_at: splitBaseRow.occurred_at,
        amount: amountText,
        description,
        suggested_category_id: basePreviewRow?.suggested_category_id ?? null,
        suggested_category_name:
          basePreviewRow?.suggested_category_name ?? null,
        suggested_confidence: null,
        suggested_reason: null,
        suggested_subscription_id:
          basePreviewRow?.suggested_subscription_id ?? null,
        suggested_subscription_name:
          basePreviewRow?.suggested_subscription_name ?? null,
        suggested_subscription_confidence: null,
        suggested_subscription_reason: null,
        transfer_match: null,
        rule_applied: false,
        rule_type: null,
        rule_summary: null,
        source_row_id: splitBaseRow.id,
        is_split: true,
      });
    });

    const baseInsertIndex = baseMarked.findIndex(
      (row) => row.id === splitBaseRow.id,
    );
    const mergedRows = [
      ...baseMarked.slice(0, baseInsertIndex + 1),
      ...newCommitRows,
      ...baseMarked.slice(baseInsertIndex + 1),
    ];

    replaceCommitRows(mergedRows);
    commitForm.reset({ rows: mergedRows });
    setSplitRows((prev) => [
      ...prev.filter((row) => row.source_row_id !== splitBaseRow.id),
      ...newPreviewRows,
    ]);
    setSplitRowIdsBySource((prev) => ({
      ...prev,
      [splitBaseRow.id]: newCommitRows.map((row) => row.id),
    }));
    setSplitDialogOpen(false);
    toast.success("Split applied. Review the new rows below.");
  };

  const updateSplitItem = (id: string, changes: Partial<SplitItem>) => {
    setSplitDraftItems((items) =>
      items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  };

  const addSplitItem = () => {
    setSplitDraftItems((items) => [
      ...items,
      {
        id: crypto.randomUUID(),
        method: "amount",
        value: "0",
        description: `${splitBaseRow?.description ?? "Split"} (Part ${
          items.length + 1
        })`,
      },
    ]);
  };

  const removeSplitItem = (id: string) => {
    setSplitDraftItems((items) =>
      items.length <= 2 ? items : items.filter((item) => item.id !== id),
    );
  };

  const submit = commitForm.handleSubmit(async (values) => {
    if (!token) {
      toast.error("Missing session", { description: "Please sign in again." });
      return;
    }
    const payload: ImportCommitRequest = {
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
    <div className="grid gap-3 md:grid-cols-4">
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
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Map each file to an account
                    </p>
                    <p className="text-xs text-slate-600">
                      The selected account&apos;s statement format is used to
                      parse each file.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <Badge
                      variant="secondary"
                      className="border border-slate-200 bg-white text-slate-700"
                    >
                      {mappedCount}/{files.length} mapped
                    </Badge>
                    {unmappedCount ? (
                      <Badge className="bg-amber-100 text-amber-700">
                        {unmappedCount} left
                      </Badge>
                    ) : (
                      <Badge className="bg-emerald-100 text-emerald-700">
                        All mapped
                      </Badge>
                    )}
                  </div>
                </div>
                <Progress
                  className="mt-3"
                  value={mappedProgress}
                  indicatorClassName={
                    unmappedCount ? "bg-amber-500" : "bg-emerald-500"
                  }
                />
              </div>

              <div className="space-y-3">
                {files.map((f) => {
                  const account = f.accountId
                    ? accountById.get(f.accountId)
                    : undefined;
                  const bankType = account?.bank_import_type ?? null;
                  const isMapped = Boolean(account);
                  const statementLabel = account
                    ? bankLabel(bankType)
                    : "Select account to see format";
                  return (
                    <div
                      key={f.id}
                      className={cn(
                        "rounded-xl border p-4 transition",
                        isMapped
                          ? "border-slate-200 bg-white"
                          : "border-amber-200 bg-amber-50",
                      )}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                            File
                          </p>
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {f.filename}
                          </p>
                          <p className="text-xs text-slate-500">
                            {(f.file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-semibold",
                              isMapped
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700",
                            )}
                          >
                            {isMapped ? "Mapped" : "Needs account"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-slate-500"
                            onClick={() => removeFile(f.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr),220px] md:items-center">
                        <div>
                          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                            Account
                          </p>
                          <select
                            className="mt-1 w-full rounded border border-slate-200 bg-white px-3 py-2 text-sm"
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
                        </div>
                        <div
                          className={cn(
                            "rounded-lg border px-3 py-2 text-xs",
                            isMapped
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-white text-slate-600",
                          )}
                        >
                          <div className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                            Statement format
                          </div>
                          <div className="text-sm font-semibold text-slate-800">
                            {statementLabel}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                  {hasMissingCategories ? (
                    <Badge className="mt-2 w-fit bg-amber-100 text-amber-700">
                      {missingCategoryCount} row
                      {missingCategoryCount === 1 ? "" : "s"} missing category
                    </Badge>
                  ) : null}
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
              </div>

              <Tabs
                value={activeAuditFileId ?? preview.files[0]?.id ?? ""}
                onValueChange={setActiveAuditFileId}
              >
                {preview.files.length > 1 ? (
                  <TabsList className="h-auto w-full flex-wrap justify-start">
                    {preview.files.map((file) => {
                      const account = accountById.get(file.account_id);
                      return (
                        <TabsTrigger
                          key={file.id}
                          value={file.id}
                          className="max-w-[280px] flex-none flex-col items-start justify-start gap-0.5 px-3 py-2"
                        >
                          <span className="truncate">
                            {account?.name ?? "Account"}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {file.filename}
                          </span>
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                ) : null}

                {preview.files.map((file) => {
                  const account = accountById.get(file.account_id);
                  const baseFileRows = preview.rows
                    .filter((row) => row.file_id === file.id)
                    .sort((a, b) => a.row_index - b.row_index);
                  const splitFileRows = (
                    splitRowsByFile.get(file.id) ?? []
                  ).sort((a, b) => a.row_index - b.row_index);
                  const fileRows = [...baseFileRows, ...splitFileRows].sort(
                    (a, b) => a.row_index - b.row_index,
                  );

                  return (
                    <TabsContent key={file.id} value={file.id}>
                      {preview.files.length === 1 ? (
                        <div className="mb-2 text-sm font-medium text-slate-700">
                          {account?.name ?? "Account"} • {file.filename}
                        </div>
                      ) : null}

                      <div className="rounded border border-slate-200">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[56px]">Del</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Transfer</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Tax event</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {fileRows.map((previewRow) => {
                              const idx =
                                commitIndexByRowId.get(previewRow.id) ?? -1;
                              if (idx < 0) return null;

                              const suggestion = suggestions[previewRow.id];
                              const suggestedCategoryId =
                                suggestion?.category_id ?? null;
                              const suggestedCategory = suggestedCategoryId
                                ? (categoriesById.get(suggestedCategoryId) ??
                                  null)
                                : null;

                              const transferAccountId =
                                commitForm.watch(
                                  `rows.${idx}.transfer_account_id`,
                                ) ?? null;
                              const transferTarget = transferAccountId
                                ? (accountById.get(transferAccountId) ?? null)
                                : null;
                              const transferMatch = previewRow.transfer_match;
                              const transferPairValue =
                                transferMatch &&
                                typeof transferMatch === "object" &&
                                "paired_with" in transferMatch &&
                                (typeof transferMatch.paired_with ===
                                  "number" ||
                                  typeof transferMatch.paired_with === "string")
                                  ? String(transferMatch.paired_with)
                                  : null;
                              const transferReason =
                                transferMatch &&
                                typeof transferMatch === "object" &&
                                "reason" in transferMatch &&
                                typeof transferMatch.reason === "string"
                                  ? transferMatch.reason
                                  : null;
                              const isSplitRow =
                                (previewRow as SplitPreviewRow).is_split ===
                                true;
                              const splitSourceId = isSplitRow
                                ? (previewRow as SplitPreviewRow).source_row_id
                                : null;
                              const splitChildrenCount =
                                splitRowIdsBySource[previewRow.id]?.length ?? 0;

                              const rowSimilarIds =
                                similarIdsByRowId.get(previewRow.id) ?? [];
                              const firstSimilar = rowSimilarIds.length
                                ? (contextTxById.get(rowSimilarIds[0]) ?? null)
                                : null;

                              const occurredAt =
                                commitForm.watch(`rows.${idx}.occurred_at`) ??
                                "";
                              const amountValue =
                                commitForm.watch(`rows.${idx}.amount`) ?? "";

                              const currentCategoryId =
                                commitForm.watch(`rows.${idx}.category_id`) ??
                                null;
                              const taxEventType =
                                commitForm.watch(
                                  `rows.${idx}.tax_event_type`,
                                ) ?? null;
                              const isDeleted = Boolean(
                                commitForm.watch(`rows.${idx}.delete`),
                              );
                              const isMissingCategory =
                                !isDeleted &&
                                !taxEventType &&
                                !transferAccountId &&
                                !currentCategoryId;
                              const suggestionApplied =
                                Boolean(suggestedCategoryId) &&
                                currentCategoryId === suggestedCategoryId;

                              const confidencePct =
                                typeof suggestion?.confidence === "number"
                                  ? Math.round(
                                      suggestion.confidence > 1
                                        ? suggestion.confidence
                                        : suggestion.confidence * 100,
                                    )
                                  : null;

                              const batchTransferOptions = preview.rows
                                .filter((row) => row.id !== previewRow.id)
                                .map((row) => {
                                  const fileMeta = fileById.get(row.file_id);
                                  const fileLabel = fileMeta
                                    ? fileMeta.filename
                                    : undefined;
                                  return {
                                    key: row.id,
                                    accountId: row.account_id,
                                    description: row.description,
                                    amount: row.amount,
                                    occurredAt: row.occurred_at,
                                    fileLabel,
                                  };
                                });

                              const existingTransferOptions = rowSimilarIds
                                .map((txId) => {
                                  const tx = contextTxById.get(txId);
                                  if (!tx || !tx.account_id) return null;
                                  return {
                                    key: txId,
                                    accountId: tx.account_id,
                                    description: tx.description,
                                    occurredAt: tx.occurred_at,
                                    categoryName: tx.category_name,
                                  };
                                })
                                .filter(
                                  (
                                    option,
                                  ): option is NonNullable<typeof option> =>
                                    Boolean(option),
                                );

                              const setTransferAccount = (
                                accountId: string | null,
                              ) => {
                                commitForm.setValue(
                                  `rows.${idx}.transfer_account_id`,
                                  accountId,
                                  { shouldDirty: true },
                                );
                                if (accountId) {
                                  commitForm.setValue(
                                    `rows.${idx}.tax_event_type`,
                                    null,
                                    { shouldDirty: true },
                                  );
                                  commitForm.setValue(
                                    `rows.${idx}.category_id`,
                                    null,
                                    { shouldDirty: true },
                                  );
                                  commitForm.setValue(
                                    `rows.${idx}.subscription_id`,
                                    null,
                                    { shouldDirty: true },
                                  );
                                }
                              };

                              return (
                                <TableRow
                                  key={commitRows[idx].fieldId}
                                  className={cn(
                                    "align-top",
                                    isMissingCategory
                                      ? "bg-amber-50/60 hover:bg-amber-50/80"
                                      : null,
                                  )}
                                >
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      checked={isDeleted}
                                      onChange={(e) =>
                                        commitForm.setValue(
                                          `rows.${idx}.delete`,
                                          e.target.checked,
                                          { shouldDirty: true },
                                        )
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <input
                                      type="date"
                                      className="w-[148px] rounded border border-slate-200 bg-white px-2 py-1 text-sm"
                                      value={toDateInputValue(occurredAt)}
                                      onChange={(e) =>
                                        commitForm.setValue(
                                          `rows.${idx}.occurred_at`,
                                          toOccurredAt(
                                            e.target.value,
                                            occurredAt,
                                          ),
                                          { shouldDirty: true },
                                        )
                                      }
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <input
                                        className="w-full min-w-[260px] rounded border border-slate-200 bg-white px-2 py-1 text-sm"
                                        value={
                                          commitForm.watch(
                                            `rows.${idx}.description`,
                                          ) ?? ""
                                        }
                                        onChange={(e) =>
                                          commitForm.setValue(
                                            `rows.${idx}.description`,
                                            e.target.value,
                                            { shouldDirty: true },
                                          )
                                        }
                                      />
                                      {firstSimilar?.category_name ? (
                                        <p className="text-[11px] text-slate-500">
                                          Similar: {firstSimilar.category_name}{" "}
                                          • {firstSimilar.description}
                                        </p>
                                      ) : null}
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-7 gap-1 text-xs"
                                          onClick={() =>
                                            handleOpenSplitDialog(previewRow)
                                          }
                                          disabled={isDeleted || isSplitRow}
                                        >
                                          <Scissors className="h-3.5 w-3.5" />
                                          Split
                                        </Button>
                                        {splitChildrenCount ? (
                                          <Badge className="bg-indigo-100 text-indigo-700">
                                            Split into {splitChildrenCount} part
                                            {splitChildrenCount === 1
                                              ? ""
                                              : "s"}
                                          </Badge>
                                        ) : null}
                                        {isSplitRow && splitSourceId ? (
                                          <Badge variant="secondary">
                                            From row {splitSourceId}
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <input
                                      className="w-[120px] rounded border border-slate-200 bg-white px-2 py-1 text-sm"
                                      value={amountValue}
                                      onChange={(e) => {
                                        const nextAmount = e.target.value;
                                        commitForm.setValue(
                                          `rows.${idx}.amount`,
                                          nextAmount,
                                          { shouldDirty: true },
                                        );
                                        if (!taxEventType) return;
                                        const nextType =
                                          inferTaxEventType(nextAmount);
                                        if (nextType === taxEventType) return;
                                        commitForm.setValue(
                                          `rows.${idx}.tax_event_type`,
                                          nextType,
                                          { shouldDirty: true },
                                        );
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <TransferPicker
                                        value={transferAccountId}
                                        currentAccountId={
                                          commitRows[idx].account_id
                                        }
                                        accounts={accounts}
                                        batchOptions={batchTransferOptions}
                                        existingOptions={
                                          existingTransferOptions ?? []
                                        }
                                        onSelectAccount={setTransferAccount}
                                        disabled={
                                          isDeleted || Boolean(taxEventType)
                                        }
                                      />
                                      {transferPairValue ? (
                                        <p className="text-[11px] text-slate-500">
                                          Suggested pair: row{" "}
                                          {transferPairValue} •{" "}
                                          {transferReason ??
                                            "Possible transfer"}
                                        </p>
                                      ) : null}
                                      {transferTarget ? (
                                        <p className="text-[11px] text-slate-500">
                                          Will create transfer between{" "}
                                          {account?.name ?? "account"} and{" "}
                                          {transferTarget.name}.
                                        </p>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <CategoryPicker
                                        value={currentCategoryId}
                                        categories={categories}
                                        disabled={Boolean(
                                          taxEventType ||
                                            transferAccountId ||
                                            isDeleted,
                                        )}
                                        missing={isMissingCategory}
                                        suggesting={
                                          suggesting &&
                                          !suggestion &&
                                          !currentCategoryId
                                        }
                                        onChange={(next) =>
                                          commitForm.setValue(
                                            `rows.${idx}.category_id`,
                                            next,
                                            { shouldDirty: true },
                                          )
                                        }
                                      />

                                      {suggesting && !suggestion ? (
                                        <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                          Waiting for Bedrock…
                                        </div>
                                      ) : suggestion ? (
                                        <div className="space-y-0.5 text-[11px] text-slate-500">
                                          <div className="flex items-center gap-1">
                                            <Sparkles className="h-3 w-3" />
                                            {suggestedCategory ? (
                                              <span>
                                                Bedrock:{" "}
                                                <span
                                                  className={cn(
                                                    "font-semibold",
                                                    suggestionApplied
                                                      ? "text-emerald-700"
                                                      : "text-slate-700",
                                                  )}
                                                >
                                                  {renderCategoryIcon(
                                                    suggestedCategory.icon,
                                                    suggestedCategory.name,
                                                    "mr-1 inline-flex h-3 w-3 items-center justify-center leading-none",
                                                  )}
                                                  {suggestedCategory.name}
                                                </span>
                                              </span>
                                            ) : (
                                              <span>
                                                Bedrock: no suggestion
                                              </span>
                                            )}
                                            {confidencePct !== null ? (
                                              <span className="text-slate-400">
                                                ({confidencePct}%)
                                              </span>
                                            ) : null}
                                          </div>
                                          {suggestion.reason ? (
                                            <div className="text-slate-500">
                                              {suggestion.reason}
                                            </div>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      checked={Boolean(taxEventType)}
                                      disabled={Boolean(
                                        transferAccountId || isDeleted,
                                      )}
                                      onChange={(e) => {
                                        const nextValue = e.target.checked
                                          ? inferTaxEventType(amountValue)
                                          : null;
                                        commitForm.setValue(
                                          `rows.${idx}.tax_event_type`,
                                          nextValue,
                                          { shouldDirty: true },
                                        );
                                        if (e.target.checked) {
                                          commitForm.setValue(
                                            `rows.${idx}.transfer_account_id`,
                                            null,
                                            { shouldDirty: true },
                                          );
                                        }
                                      }}
                                      aria-label="Tax event"
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </>
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
                  className="gap-2"
                  onClick={() => void submit()}
                  disabled={
                    loading ||
                    saving ||
                    previewHasErrors ||
                    hasMissingCategories
                  }
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Submit
                </Button>
              ) : step < 4 ? (
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
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={splitDialogOpen} onOpenChange={setSplitDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Split transaction</DialogTitle>
            <DialogDescription>
              Divide a transaction into multiple parts by percentage or fixed
              amount. The total must match the original amount.
            </DialogDescription>
          </DialogHeader>

          {splitBaseRow ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge
                  variant="secondary"
                  className="bg-slate-100 text-slate-700"
                >
                  Original amount: {splitBaseRow.amount}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-slate-100 text-slate-700"
                >
                  Date: {toDateInputValue(splitBaseRow.occurred_at)}
                </Badge>
                <Badge
                  variant="secondary"
                  className="bg-slate-100 text-slate-700"
                >
                  Parts: {splitDraftItems.length}
                </Badge>
                <Badge
                  className={cn(
                    "text-xs",
                    Math.abs(splitAmounts.remainder) < 0.01
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-800",
                  )}
                >
                  Remainder: {splitAmounts.remainder.toFixed(2)}
                </Badge>
              </div>

              <div className="space-y-3">
                {splitDraftItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="space-y-3 rounded-lg border border-slate-200 bg-white p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                          {idx + 1}
                        </div>
                        <p className="text-sm font-semibold text-slate-800">
                          Split part {idx + 1}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-slate-600"
                        onClick={() => removeSplitItem(item.id)}
                        disabled={splitDraftItems.length <= 2}
                      >
                        Remove
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="md:col-span-2">
                        <Label className="text-xs text-slate-600">
                          Description
                        </Label>
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            updateSplitItem(item.id, {
                              description: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">Mode</Label>
                        <select
                          className="mt-1 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
                          value={item.method}
                          onChange={(e) =>
                            updateSplitItem(item.id, {
                              method: e.target.value as SplitItem["method"],
                            })
                          }
                        >
                          <option value="amount">Amount</option>
                          <option value="percent">Percent</option>
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs text-slate-600">
                          {item.method === "percent"
                            ? "Percent of total"
                            : "Amount"}
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.value}
                          onChange={(e) =>
                            updateSplitItem(item.id, { value: e.target.value })
                          }
                        />
                      </div>
                      <div className="text-sm text-slate-600 md:col-span-4">
                        Computed amount:{" "}
                        <span className="font-semibold text-slate-900">
                          {splitAmounts.computed[idx]?.toFixed(2) ?? "0.00"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 w-fit"
                  onClick={addSplitItem}
                >
                  Add another part
                </Button>
              </div>

              <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm text-slate-600">
                  Totals must match the original amount exactly. Percentages are
                  applied to the absolute value and keep the original sign.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {splitRowIdsBySource[splitBaseRow.id]?.length ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => clearSplitsForRow(splitBaseRow.id)}
                    >
                      Clear splits
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    onClick={applySplitDraft}
                    disabled={
                      splitDraftItems.length < 2 ||
                      splitDraftItems.some((item) => Number(item.value) <= 0) ||
                      Math.abs(splitAmounts.remainder) >= 0.01
                    }
                  >
                    Apply split
                  </Button>
                </div>
              </DialogFooter>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Select a row in the audit table to start a split.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </MotionPage>
  );
};
