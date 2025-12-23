import { zodResolver } from "@hookform/resolvers/zod";
import {
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Link2,
  Loader2,
  MoreHorizontal,
  MoveRight,
  Scissors,
  Square,
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
  useTransactionsApi,
} from "@/hooks/use-api";
import { renderCategoryIcon } from "@/lib/category-icons";
import { currency } from "@/lib/format";
import { getDisplayTransactionType, isTaxEvent } from "@/lib/transactions";
import { cn } from "@/lib/utils";
import type {
  AccountWithBalance,
  CategoryRead,
  ImportCommitRequest,
  ImportPreviewResponse,
  ImportPreviewRequest,
  TaxEventType,
  TransactionRead,
} from "@/types/api";
import { TaxEventType as TaxEventTypeEnum, TransactionType } from "@/types/api";
import {
  ReimbursementDialog,
  type ReimbursementDialogState,
  type ReimbursementState,
} from "./components/reimbursement-dialog";

type StepKey = 1 | 2 | 3 | 4;

type LocalFile = {
  id: string;
  file: File;
  filename: string;
  accountId: string | null;
  contentBase64?: string;
  contentType?: string | null;
  previewFileId?: string | null;
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

type SplitMode = "amount" | "percent";

type SplitItem = {
  id: string;
  value: string;
  description: string;
};

type TransferOption = {
  key: string;
  accountId: string;
  description: string;
  occurredAt?: string | null;
  categoryName?: string | null;
  amount?: string;
  fileLabel?: string;
};

type TransferDialogState = {
  rowId: string;
  commitIndex: number;
  currentAccountId: string;
  value: string | null;
  batchOptions: TransferOption[];
  existingOptions: TransferOption[];
};

type SplitPreviewRow = ImportPreviewResponse["rows"][number] & {
  source_row_id: string;
  is_split: true;
};

const commitRowSchema = z.object({
  id: z.string(),
  file_id: z.string().nullable().optional(),
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

export type CommitFormValues = z.infer<typeof commitFormSchema>;

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
    items: transferTransactions,
    loading: transferTransactionsLoading,
    error: transferTransactionsError,
    pagination: transferTransactionsPagination,
    fetchTransactions: fetchTransferTransactions,
  } = useTransactionsApi();
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
  const [splitMode, setSplitMode] = useState<SplitMode>("percent");
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
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferDialogState, setTransferDialogState] =
    useState<TransferDialogState | null>(null);
  const [transferSearch, setTransferSearch] = useState("");
  const [transferStartDate, setTransferStartDate] = useState("");
  const [transferEndDate, setTransferEndDate] = useState("");
  const [transferAccountFilter, setTransferAccountFilter] = useState("");
  const [transferCategoryFilter, setTransferCategoryFilter] = useState("");
  const [transferMinAmount, setTransferMinAmount] = useState("");
  const [transferMaxAmount, setTransferMaxAmount] = useState("");
  const [transferTab, setTransferTab] = useState("upload");
  const [reimbursementDialogOpen, setReimbursementDialogOpen] = useState(false);
  const [reimbursementDialogState, setReimbursementDialogState] =
    useState<ReimbursementDialogState | null>(null);
  const [reimbursementsByRow, setReimbursementsByRow] = useState<
    Record<string, ReimbursementState>
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

  const accountLookup = useMemo(
    () => Object.fromEntries(accounts.map((acc) => [acc.id, acc.name])),
    [accounts],
  );

  useEffect(() => {
    if (preview) return;
    setSplitRows([]);
    setSplitRowIdsBySource({});
    setSplitBaseRow(null);
    setSplitDraftItems([]);
    setSplitDialogOpen(false);
    setTransferDialogOpen(false);
    setTransferDialogState(null);
    setTransferSearch("");
    setTransferStartDate("");
    setTransferEndDate("");
    setTransferAccountFilter("");
    setTransferCategoryFilter("");
    setTransferMinAmount("");
    setTransferMaxAmount("");
    setTransferTab("upload");
    setReimbursementDialogOpen(false);
    setReimbursementDialogState(null);
    setReimbursementsByRow({});
  }, [preview]);

  useEffect(() => {
    if (!transferDialogOpen || transferTab !== "existing") return;
    const debounce = setTimeout(() => {
      fetchTransferTransactions({
        limit: transferTransactionsPagination.limit,
        offset: 0,
        search: transferSearch.trim() || undefined,
        accountIds: transferAccountFilter ? [transferAccountFilter] : undefined,
        categoryIds: transferCategoryFilter
          ? [transferCategoryFilter]
          : undefined,
        startDate: transferStartDate || undefined,
        endDate: transferEndDate || undefined,
        minAmount: transferMinAmount || undefined,
        maxAmount: transferMaxAmount || undefined,
        sortBy: "occurred_at",
        sortDir: "desc",
      });
    }, 250);
    return () => clearTimeout(debounce);
  }, [
    fetchTransferTransactions,
    transferAccountFilter,
    transferCategoryFilter,
    transferDialogOpen,
    transferEndDate,
    transferMaxAmount,
    transferMinAmount,
    transferSearch,
    transferStartDate,
    transferTab,
    transferTransactionsPagination.limit,
  ]);

  useEffect(() => {
    if (!preview) return;
    if (commitRows.length) return;
    const defaults: CommitFormValues["rows"] = preview.rows.map((row) => ({
      id: row.id,
      file_id: row.file_id ?? null,
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
    if (!preview) return;
    setFiles((current) =>
      current.map((file) => {
        const matched =
          preview.files.find(
            (previewFile) =>
              previewFile.filename === file.filename &&
              previewFile.account_id === file.accountId,
          ) ??
          preview.files.find(
            (previewFile) => previewFile.account_id === file.accountId,
          );
        if (!matched) return file;
        return { ...file, previewFileId: matched.id };
      }),
    );
  }, [preview]);

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
    const prepared = await Promise.all(
      files.map(async (f) => {
        const contentBase64 = await toBase64(f.file);
        return {
          localId: f.id,
          contentBase64,
          contentType: f.file.type || null,
          payload: {
            filename: f.filename,
            content_base64: contentBase64,
            account_id: f.accountId!,
          },
        };
      }),
    );
    const filesPayload: ImportPreviewRequest["files"] = prepared.map(
      (item) => item.payload,
    );
    setFiles((prev) =>
      prev.map((file) => {
        const match = prepared.find((p) => p.localId === file.id);
        if (!match) return file;
        return {
          ...file,
          contentBase64: match.contentBase64,
          contentType: match.contentType,
        };
      }),
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
    const hasExisting = existingSplits.length > 0;
    const nextItems: SplitItem[] = hasExisting
      ? existingSplits.map((split) => ({
          id: split.id,
          value: Math.abs(Number(split.amount || 0)).toString(),
          description: split.description,
        }))
      : [
          {
            id: crypto.randomUUID(),
            value: "50",
            description: `${baseRow.description || row.description} (Split 1)`,
          },
          {
            id: crypto.randomUUID(),
            value: "50",
            description: `${baseRow.description || row.description} (Split 2)`,
          },
        ];

    setSplitDraftItems(nextItems);
    setSplitMode(hasExisting ? "amount" : "percent");
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
      return {
        computed: [] as number[],
        total: 0,
        remainder: 0,
        percentTotal: 0,
        percentRemainder: 0,
      };
    }
    const baseAmount = Number(splitBaseRow.amount);
    const baseAbs = Math.abs(baseAmount);
    const sign = baseAmount >= 0 ? 1 : -1;
    const values = splitDraftItems.map((item) => {
      const raw = Number(item.value);
      if (!Number.isFinite(raw)) return 0;
      return Math.abs(raw);
    });

    const percentTotal =
      splitMode === "percent"
        ? values.reduce((sum, value) => sum + value, 0)
        : 0;
    const percentRemainder = splitMode === "percent" ? 100 - percentTotal : 0;

    const computedRaw = values.map((value, idx) => {
      if (splitMode === "percent") {
        const normalizedPercent =
          idx === values.length - 1
            ? Math.max(value + percentRemainder, 0)
            : value;
        return baseAbs * (normalizedPercent / 100);
      }
      return value;
    });

    const rounded = computedRaw.map((value, idx) => {
      if (splitMode === "percent" && idx === computedRaw.length - 1) {
        const previous = computedRaw
          .slice(0, idx)
          .reduce((sum, val) => sum + Number(val.toFixed(2)), 0);
        const last = Math.max(baseAbs - previous, 0);
        return Number(last.toFixed(2));
      }
      return Number(value.toFixed(2));
    });

    const computed = rounded.map((value) => value * sign);
    const total = computed.reduce((sum, value) => sum + value, 0);
    const remainder = baseAmount - total;

    return { computed, total, remainder, percentTotal, percentRemainder };
  }, [splitBaseRow, splitDraftItems, splitMode]);

  const formatTransferCurrency = (value: number) =>
    currency(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getTransferDisplayAmount = (tx: TransactionRead) => {
    const knownLegs = tx.legs.filter((leg) =>
      Boolean(accountLookup[leg.account_id]),
    );
    if (transferAccountFilter) {
      return knownLegs
        .filter((leg) => leg.account_id === transferAccountFilter)
        .reduce((sum, leg) => sum + Number(leg.amount), 0);
    }

    const sumKnown = knownLegs.reduce(
      (sum, leg) => sum + Number(leg.amount),
      0,
    );
    if (sumKnown !== 0) return sumKnown;

    const largest = knownLegs.reduce<null | { amount: number }>((best, leg) => {
      const numeric = Number(leg.amount);
      if (!best) return { amount: numeric };
      return Math.abs(numeric) > Math.abs(best.amount)
        ? { amount: numeric }
        : best;
    }, null);
    return largest ? Math.abs(largest.amount) : 0;
  };

  const getTransferAccountsLabel = (tx: TransactionRead) => {
    const knownLegs = tx.legs.filter((leg) =>
      Boolean(accountLookup[leg.account_id]),
    );
    if (tx.transaction_type === TransactionType.TRANSFER) {
      const fromLeg =
        knownLegs.find((leg) => Number(leg.amount) < 0) ?? knownLegs[0];
      const toLeg =
        knownLegs.find((leg) => Number(leg.amount) > 0) ?? knownLegs[1];

      const fromName = fromLeg ? accountLookup[fromLeg.account_id] : undefined;
      const toName = toLeg ? accountLookup[toLeg.account_id] : undefined;

      if (fromName && toName) return `${fromName} → ${toName}`;
      if (fromName) return `${fromName} → (unknown)`;
      if (toName) return `(unknown) → ${toName}`;
      return "Internal transfer";
    }

    const primary = knownLegs[0];
    if (!primary) return "Internal transfer";
    return accountLookup[primary.account_id] ?? "Internal transfer";
  };

  const getTransferTargetAccountId = (tx: TransactionRead) => {
    const currentAccountId = transferDialogState?.currentAccountId;
    if (!tx.legs.length) return null;
    if (currentAccountId) {
      const otherLeg = tx.legs.find(
        (leg) => leg.account_id !== currentAccountId,
      );
      if (otherLeg) return otherLeg.account_id;
    }
    return tx.legs[0]?.account_id ?? null;
  };

  const loadMoreTransferTransactions = () => {
    if (
      !transferTransactionsPagination.hasMore ||
      transferTransactionsLoading
    ) {
      return;
    }
    fetchTransferTransactions({
      offset:
        transferTransactionsPagination.offset +
        transferTransactionsPagination.limit,
      limit: transferTransactionsPagination.limit,
    });
  };

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
    const { computed, remainder, percentRemainder } = splitAmounts;
    const validRemainder = Math.abs(remainder) < 0.01;
    const validPercent =
      splitMode === "amount" || Math.abs(percentRemainder) < 5;
    const hasValues =
      splitDraftItems.length >= 2 &&
      splitDraftItems.every((item) => Number(item.value) > 0);
    if (!validRemainder || !validPercent || !hasValues) {
      toast.error(
        "Split must include at least two parts and totals must match the original amount.",
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
    setSplitDraftItems((items) => {
      const nextIndex = items.length + 1;
      const sharedPercent =
        splitMode === "percent" ? (100 / nextIndex).toFixed(2) : "0";
      return [
        ...items,
        {
          id: crypto.randomUUID(),
          value: sharedPercent,
          description: `${splitBaseRow?.description ?? "Split"} (Part ${nextIndex})`,
        },
      ];
    });
  };

  const removeSplitItem = (id: string) => {
    setSplitDraftItems((items) =>
      items.length <= 2 ? items : items.filter((item) => item.id !== id),
    );
  };

  const changeSplitMode = (mode: SplitMode) => {
    if (mode === splitMode || !splitBaseRow) return;
    const baseAmount = Math.abs(Number(splitBaseRow.amount) || 0);
    setSplitDraftItems((items) =>
      items.map((item) => {
        const raw = Math.abs(Number(item.value)) || 0;
        if (mode === "percent") {
          if (baseAmount === 0) return { ...item, value: "0" };
          const percent = ((raw / baseAmount) * 100).toFixed(2);
          return { ...item, value: percent };
        }
        const amount = ((raw / 100) * baseAmount).toFixed(2);
        return { ...item, value: amount };
      }),
    );
    setSplitMode(mode);
  };

  const [transferDraftValue, setTransferDraftValue] = useState<string | null>(
    null,
  );

  const handleOpenTransferDialog = (
    row: ImportPreviewResponse["rows"][number],
    commitIndex: number,
    batchOptions: TransferOption[],
    existingOptions: TransferOption[],
    currentValue: string | null,
  ) => {
    setTransferDialogState({
      rowId: row.id,
      commitIndex,
      currentAccountId: commitRows[commitIndex].account_id,
      value: currentValue,
      batchOptions,
      existingOptions,
    });
    setTransferDraftValue(currentValue);
    setTransferSearch("");
    setTransferStartDate("");
    setTransferEndDate("");
    setTransferAccountFilter("");
    setTransferCategoryFilter("");
    setTransferMinAmount("");
    setTransferMaxAmount("");
    setTransferTab(batchOptions.length ? "upload" : "existing");
    setTransferDialogOpen(true);
  };

  const applyTransferSelection = (accountId: string | null) => {
    if (!transferDialogState) return;
    const { commitIndex } = transferDialogState;
    commitForm.setValue(`rows.${commitIndex}.transfer_account_id`, accountId, {
      shouldDirty: true,
    });
    if (accountId) {
      commitForm.setValue(`rows.${commitIndex}.tax_event_type`, null, {
        shouldDirty: true,
      });
      commitForm.setValue(`rows.${commitIndex}.category_id`, null, {
        shouldDirty: true,
      });
      commitForm.setValue(`rows.${commitIndex}.subscription_id`, null, {
        shouldDirty: true,
      });
    }
    setTransferDialogOpen(false);
    setTransferDialogState(null);
  };

  const handleOpenReimbursementDialog = (
    row: ImportPreviewResponse["rows"][number],
    commitIndex: number,
  ) => {
    setReimbursementDialogState({ rowId: row.id, commitIndex });
    setReimbursementDialogOpen(true);
  };

  const handleToggleTaxEvent = (
    commitIndex: number,
    checked: boolean | "indeterminate",
  ) => {
    if (checked === "indeterminate") return;
    const amountValue =
      commitForm.getValues(`rows.${commitIndex}.amount`) ??
      commitRows[commitIndex]?.amount ??
      "0";
    if (checked) {
      const inferredType = inferTaxEventType(amountValue);
      commitForm.setValue(`rows.${commitIndex}.tax_event_type`, inferredType, {
        shouldDirty: true,
      });
      commitForm.setValue(`rows.${commitIndex}.transfer_account_id`, null, {
        shouldDirty: true,
      });
      return;
    }
    commitForm.setValue(`rows.${commitIndex}.tax_event_type`, null, {
      shouldDirty: true,
    });
  };

  const submit = commitForm.handleSubmit(async (values) => {
    if (!token) {
      toast.error("Missing session", { description: "Please sign in again." });
      return;
    }
    const commitFiles =
      preview?.files
        .map((file) => {
          const local =
            files.find((item) => item.previewFileId === file.id) ??
            files.find(
              (item) =>
                item.filename === file.filename &&
                item.accountId === file.account_id,
            );
          if (!local?.contentBase64) return null;
          return {
            id: file.id,
            filename: file.filename,
            account_id: file.account_id,
            row_count: file.row_count,
            error_count: file.error_count,
            bank_import_type: file.bank_import_type ?? null,
            content_base64: local.contentBase64,
            content_type: local.contentType ?? undefined,
          };
        })
        .filter(Boolean) ?? [];
    const payload: ImportCommitRequest = {
      rows: values.rows.map((row) => ({
        id: row.id,
        file_id: row.file_id ?? null,
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
    if (commitFiles.length) {
      payload.files = commitFiles as NonNullable<ImportCommitRequest["files"]>;
    }
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
                              <TableHead>Category</TableHead>
                              <TableHead className="w-[160px]">
                                Actions
                              </TableHead>
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
                              const reimbursementLink =
                                reimbursementsByRow[previewRow.id];
                              const reimbursementCount =
                                reimbursementLink?.reimbursementIds.length ?? 0;

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
                                        {transferTarget ? (
                                          <Badge className="bg-emerald-100 text-emerald-700">
                                            Transfer → {transferTarget.name}
                                          </Badge>
                                        ) : null}
                                        {reimbursementCount ? (
                                          <Badge className="bg-blue-100 text-blue-800">
                                            Reimbursed by {reimbursementCount}{" "}
                                            payment
                                            {reimbursementCount === 1
                                              ? ""
                                              : "s"}
                                          </Badge>
                                        ) : null}
                                        {taxEventType ? (
                                          <Badge className="bg-amber-100 text-amber-800">
                                            Tax {taxEventType.toLowerCase()}
                                          </Badge>
                                        ) : null}
                                      </div>
                                      {transferPairValue ? (
                                        <p className="text-[11px] text-slate-500">
                                          Suggested pair: row{" "}
                                          {transferPairValue} •{" "}
                                          {transferReason ??
                                            "Possible transfer"}
                                        </p>
                                      ) : null}
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
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          className="h-8 w-full justify-between px-3 text-xs"
                                          disabled={isDeleted}
                                        >
                                          Actions
                                          <ChevronRight className="h-3.5 w-3.5" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        align="end"
                                        className="w-[240px]"
                                      >
                                        <DropdownMenuLabel className="text-[11px] text-slate-500">
                                          Row actions
                                        </DropdownMenuLabel>
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            handleOpenSplitDialog(previewRow)
                                          }
                                          disabled={isSplitRow}
                                          className="flex items-center gap-2"
                                        >
                                          <Scissors className="h-3.5 w-3.5" />
                                          Split transaction
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            handleOpenReimbursementDialog(
                                              previewRow,
                                              idx,
                                            )
                                          }
                                          disabled={isDeleted}
                                          className="flex items-center gap-2"
                                        >
                                          <Link2 className="h-3.5 w-3.5" />
                                          Reimbursement links
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            handleOpenTransferDialog(
                                              previewRow,
                                              idx,
                                              batchTransferOptions,
                                              existingTransferOptions ?? [],
                                              transferAccountId,
                                            )
                                          }
                                          disabled={Boolean(taxEventType)}
                                          className="flex items-center gap-2"
                                        >
                                          <MoveRight className="h-3.5 w-3.5" />
                                          Manage transfer
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            handleToggleTaxEvent(
                                              idx,
                                              !taxEventType,
                                            )
                                          }
                                          disabled={Boolean(transferAccountId)}
                                          className="flex items-center justify-between gap-2"
                                        >
                                          <div className="flex items-center gap-2">
                                            <Sparkles className="h-3.5 w-3.5" />
                                            <span>Tax event</span>
                                          </div>
                                          {taxEventType ? (
                                            <CheckSquare className="h-4 w-4 text-slate-700" />
                                          ) : (
                                            <Square className="h-4 w-4 text-slate-400" />
                                          )}
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onSelect={() => {
                                            commitForm.setValue(
                                              `rows.${idx}.transfer_account_id`,
                                              null,
                                              { shouldDirty: true },
                                            );
                                          }}
                                          disabled={!transferAccountId}
                                        >
                                          Clear transfer
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
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
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
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
                {splitMode === "percent" ? (
                  <Badge
                    variant="secondary"
                    className="bg-indigo-100 text-indigo-700"
                  >
                    Percent remainder applied to last part:{" "}
                    {(splitAmounts.percentRemainder || 0).toFixed(2)}%
                  </Badge>
                ) : null}
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-800">
                      Split mode
                    </p>
                    <p className="text-xs text-slate-500">
                      All parts share the same mode. Percentages auto-balance to
                      100% and rounding is applied to the last part.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={splitMode === "percent" ? "default" : "outline"}
                      onClick={() => changeSplitMode("percent")}
                    >
                      Percent
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={splitMode === "amount" ? "default" : "outline"}
                      onClick={() => changeSplitMode("amount")}
                    >
                      Amount
                    </Button>
                  </div>
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
                          <Label className="text-xs text-slate-600">
                            {splitMode === "percent"
                              ? "Percent of total"
                              : "Amount"}
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.value}
                            onChange={(e) =>
                              updateSplitItem(item.id, {
                                value: e.target.value,
                              })
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
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Add more parts as needed.
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9"
                    onClick={addSplitItem}
                  >
                    Add another part
                  </Button>
                </div>
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

      <Dialog
        open={transferDialogOpen}
        onOpenChange={(open) => {
          setTransferDialogOpen(open);
          if (!open) {
            setTransferDialogState(null);
            setTransferDraftValue(null);
            setTransferSearch("");
            setTransferStartDate("");
            setTransferEndDate("");
            setTransferAccountFilter("");
            setTransferCategoryFilter("");
            setTransferMinAmount("");
            setTransferMaxAmount("");
            setTransferTab("upload");
          }
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage transfer</DialogTitle>
            <DialogDescription>
              Link this row to another transaction or mark it as a transfer
              between accounts.
            </DialogDescription>
          </DialogHeader>

          {transferDialogState ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-slate-100">
                    Current:{" "}
                    {transferDialogState.value
                      ? (accounts.find(
                          (acc) => acc.id === transferDialogState.value,
                        )?.name ?? "Selected account")
                      : "Not a transfer"}
                  </Badge>
                  <Badge variant="secondary" className="bg-slate-100">
                    From account:{" "}
                    {accounts.find(
                      (acc) => acc.id === transferDialogState.currentAccountId,
                    )?.name ?? "Unknown"}
                  </Badge>
                </div>
              </div>

              <Tabs value={transferTab} onValueChange={setTransferTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="upload">This upload</TabsTrigger>
                  <TabsTrigger value="existing">Existing</TabsTrigger>
                  <TabsTrigger value="create">New transfer</TabsTrigger>
                </TabsList>
                <TabsContent value="upload" className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Pair with another row from the same upload.
                  </p>
                  <div className="rounded-lg border border-slate-200">
                    {transferDialogState.batchOptions.length ? (
                      <div className="max-h-[360px] overflow-auto">
                        <Table className="min-w-[720px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Account</TableHead>
                              <TableHead>File</TableHead>
                              <TableHead className="text-right">
                                Select
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transferDialogState.batchOptions.map((option) => {
                              const account = accounts.find(
                                (acc) => acc.id === option.accountId,
                              );
                              const selected =
                                transferDraftValue === option.accountId;
                              return (
                                <TableRow
                                  key={option.key}
                                  className="cursor-pointer"
                                  data-state={selected ? "selected" : undefined}
                                  onClick={() =>
                                    setTransferDraftValue(option.accountId)
                                  }
                                >
                                  <TableCell className="font-semibold text-slate-900">
                                    {option.description || "Transfer row"}
                                  </TableCell>
                                  <TableCell className="text-slate-600">
                                    {option.occurredAt?.slice(0, 10) ??
                                      "Unknown"}
                                  </TableCell>
                                  <TableCell className="text-slate-600">
                                    {option.amount ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-slate-600">
                                    {account?.name ?? "Account"}
                                  </TableCell>
                                  <TableCell className="text-slate-600">
                                    {option.fileLabel ?? "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={selected ? "default" : "outline"}
                                    >
                                      {selected ? "Selected" : "Select"}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="p-3 text-sm text-slate-500">
                        No other rows in this upload.
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="existing" className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Search description, category, date…"
                      value={transferSearch}
                      onChange={(e) => setTransferSearch(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTransferSearch("")}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-[13px] shadow-[0_6px_16px_-12px_rgba(15,23,42,0.3)]">
                    <input
                      type="date"
                      className="h-8 rounded border border-slate-200 px-2 text-slate-800"
                      value={transferStartDate}
                      onChange={(e) => setTransferStartDate(e.target.value)}
                    />
                    <span className="text-slate-500">to</span>
                    <input
                      type="date"
                      className="h-8 rounded border border-slate-200 px-2 text-slate-800"
                      value={transferEndDate}
                      onChange={(e) => setTransferEndDate(e.target.value)}
                    />
                    <select
                      className="h-8 rounded border border-slate-200 bg-white px-2 text-slate-800"
                      value={transferAccountFilter}
                      onChange={(e) => setTransferAccountFilter(e.target.value)}
                    >
                      <option value="">All accounts</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className="h-8 rounded border border-slate-200 bg-white px-2 text-slate-800"
                      value={transferCategoryFilter}
                      onChange={(e) =>
                        setTransferCategoryFilter(e.target.value)
                      }
                    >
                      <option value="">All categories</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Min"
                      className="h-8 w-24 rounded border border-slate-200 px-2 text-slate-800"
                      value={transferMinAmount}
                      onChange={(e) => setTransferMinAmount(e.target.value)}
                    />
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Max"
                      className="h-8 w-24 rounded border border-slate-200 px-2 text-slate-800"
                      value={transferMaxAmount}
                      onChange={(e) => setTransferMaxAmount(e.target.value)}
                    />
                  </div>
                  <div className="rounded-lg border border-slate-200">
                    {transferTransactions.length ? (
                      <div className="max-h-[360px] overflow-auto">
                        <Table className="min-w-[720px]">
                          <TableHeader>
                            <TableRow>
                              <TableHead>Description</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Category</TableHead>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right">
                                Amount
                              </TableHead>
                              <TableHead className="text-right">
                                Select
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {transferTransactions.map((tx) => {
                              const displayType = getDisplayTransactionType(tx);
                              const taxLinked = isTaxEvent(tx);
                              const targetAccountId =
                                getTransferTargetAccountId(tx);
                              const selected =
                                Boolean(targetAccountId) &&
                                transferDraftValue === targetAccountId;
                              const categoryLabel = tx.category_id
                                ? categoriesById.get(tx.category_id)?.name
                                : null;
                              return (
                                <TableRow
                                  key={tx.id}
                                  className="cursor-pointer"
                                  data-state={selected ? "selected" : undefined}
                                  onClick={() =>
                                    targetAccountId
                                      ? setTransferDraftValue(targetAccountId)
                                      : null
                                  }
                                >
                                  <TableCell className="font-semibold text-slate-900">
                                    {tx.description || "Existing transaction"}
                                  </TableCell>
                                  <TableCell className="text-slate-600">
                                    {tx.occurred_at?.slice(0, 10) ?? "Unknown"}
                                  </TableCell>
                                  <TableCell className="text-slate-600">
                                    {displayType === TransactionType.TRANSFER &&
                                    !taxLinked
                                      ? "—"
                                      : (categoryLabel ?? "Uncategorized")}
                                  </TableCell>
                                  <TableCell className="text-slate-600">
                                    {getTransferAccountsLabel(tx)}
                                  </TableCell>
                                  <TableCell className="text-right text-slate-600">
                                    {formatTransferCurrency(
                                      getTransferDisplayAmount(tx),
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant={selected ? "default" : "outline"}
                                      disabled={!targetAccountId}
                                    >
                                      {selected ? "Selected" : "Select"}
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : transferTransactionsLoading ? (
                      <div className="p-3 text-sm text-slate-500">
                        Loading transactions…
                      </div>
                    ) : transferTransactionsError ? (
                      <div className="p-3 text-sm text-slate-500">
                        Unable to load transactions.
                      </div>
                    ) : (
                      <div className="p-3 text-sm text-slate-500">
                        No matching transactions found.
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-2 border-slate-300 text-slate-700"
                      onClick={loadMoreTransferTransactions}
                      disabled={
                        !transferTransactionsPagination.hasMore ||
                        transferTransactionsLoading
                      }
                    >
                      {transferTransactionsLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreHorizontal className="h-4 w-4" />
                      )}
                      {transferTransactionsPagination.hasMore
                        ? "Load more"
                        : "End of list"}
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="create" className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Create a transfer to another account.
                  </p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {accounts
                      .filter(
                        (acc) =>
                          acc.id !== transferDialogState.currentAccountId,
                      )
                      .map((acc) => {
                        const selected = transferDraftValue === acc.id;
                        return (
                          <Button
                            key={acc.id}
                            variant={selected ? "default" : "outline"}
                            className="h-auto justify-start gap-3 text-left"
                            onClick={() => setTransferDraftValue(acc.id)}
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-700">
                              {acc.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-900">
                                {acc.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {bankLabel(acc.bank_import_type)}
                              </span>
                            </div>
                          </Button>
                        );
                      })}
                  </div>
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  Only one transfer target can be active. Applying will clear
                  category and subscription.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTransferDraftValue(null);
                      applyTransferSelection(null);
                    }}
                  >
                    Clear transfer
                  </Button>
                  <Button
                    type="button"
                    onClick={() => applyTransferSelection(transferDraftValue)}
                  >
                    Apply
                  </Button>
                </div>
              </DialogFooter>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Select a row in the audit table to manage transfer options.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <ReimbursementDialog
        open={reimbursementDialogOpen}
        onOpenChange={(open) => {
          setReimbursementDialogOpen(open);
          if (!open) {
            setReimbursementDialogState(null);
          }
        }}
        dialogState={reimbursementDialogState}
        setDialogState={setReimbursementDialogState}
        reimbursementsByRow={reimbursementsByRow}
        setReimbursementsByRow={setReimbursementsByRow}
        commitRows={commitRows}
        commitForm={commitForm}
        previewRowById={previewRowById}
        fileById={fileById}
        accountById={accountById}
        splitRowIdsBySource={splitRowIdsBySource}
        toDateInputValue={toDateInputValue}
      />
    </MotionPage>
  );
};
