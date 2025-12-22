import React, { useEffect, useMemo, useState } from "react";
import type { FieldArrayWithId, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AccountWithBalance, ImportPreviewResponse } from "@/types/api";
import type { CommitFormValues } from "../imports";

type PreviewFile = ImportPreviewResponse["files"][number];

export type ReimbursementState = {
  originalAmount: string;
  reimbursementIds: string[];
};

export type ReimbursementDialogState = {
  rowId: string;
  commitIndex: number;
};

type ReimbursementDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogState: ReimbursementDialogState | null;
  setDialogState: (state: ReimbursementDialogState | null) => void;
  reimbursementsByRow: Record<string, ReimbursementState>;
  setReimbursementsByRow: React.Dispatch<
    React.SetStateAction<Record<string, ReimbursementState>>
  >;
  commitRows: FieldArrayWithId<CommitFormValues, "rows", "fieldId">[];
  commitForm: UseFormReturn<CommitFormValues>;
  previewRowById: Map<string, ImportPreviewResponse["rows"][number]>;
  fileById: Map<string, PreviewFile>;
  accountById: Map<string, AccountWithBalance>;
  splitRowIdsBySource: Record<string, string[]>;
  toDateInputValue: (value: string | null | undefined) => string;
};

const toNumeric = (value: string | number | null | undefined) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

export const ReimbursementDialog: React.FC<ReimbursementDialogProps> = ({
  open,
  onOpenChange,
  dialogState,
  setDialogState,
  reimbursementsByRow,
  setReimbursementsByRow,
  commitRows,
  commitForm,
  previewRowById,
  fileById,
  accountById,
  splitRowIdsBySource,
  toDateInputValue,
}) => {
  const [selections, setSelections] = useState<string[]>([]);

  const commitIndexByRowId = useMemo(() => {
    const map = new Map<string, number>();
    commitRows.forEach((row, idx) => map.set(row.id, idx));
    return map;
  }, [commitRows]);

  useEffect(() => {
    if (!dialogState) {
      setSelections([]);
      return;
    }
    setSelections(
      reimbursementsByRow[dialogState.rowId]?.reimbursementIds ?? [],
    );
  }, [dialogState, reimbursementsByRow]);

  const handleDialogChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setDialogState(null);
      setSelections([]);
    }
  };

  const applySelection = (nextSelection?: string[]) => {
    if (!dialogState) return;
    const { rowId, commitIndex } = dialogState;
    const baseRow = commitForm.getValues(`rows.${commitIndex}`);
    if (!baseRow) return;

    const selection = nextSelection ?? selections;
    const originalAmount =
      reimbursementsByRow[rowId]?.originalAmount ??
      commitForm.getValues(`rows.${commitIndex}.amount`) ??
      baseRow.amount ??
      "0";

    const reimbursementTotal = selection.reduce((sum, reimbursementId) => {
      const idx = commitIndexByRowId.get(reimbursementId);
      if (idx === undefined) return sum;
      const amountValue =
        commitForm.getValues(`rows.${idx}.amount`) ??
        commitRows[idx]?.amount ??
        "0";
      return sum + toNumeric(amountValue);
    }, 0);

    const previousSelection =
      reimbursementsByRow[rowId]?.reimbursementIds ?? [];
    previousSelection
      .filter((id) => !selection.includes(id))
      .forEach((id) => {
        const idx = commitIndexByRowId.get(id);
        if (idx === undefined) return;
        commitForm.setValue(`rows.${idx}.delete`, false, {
          shouldDirty: true,
        });
      });

    selection.forEach((id) => {
      const idx = commitIndexByRowId.get(id);
      if (idx === undefined) return;
      commitForm.setValue(`rows.${idx}.delete`, true, {
        shouldDirty: true,
      });
    });

    const updatedAmount = toNumeric(originalAmount) - reimbursementTotal;
    const formattedAmount = updatedAmount.toFixed(2);

    commitForm.setValue(`rows.${commitIndex}.amount`, formattedAmount, {
      shouldDirty: true,
    });

    setReimbursementsByRow((prev) => {
      if (!selection.length) {
        const next = { ...prev };
        delete next[rowId];
        return next;
      }
      return {
        ...prev,
        [rowId]: {
          originalAmount: String(originalAmount ?? "0"),
          reimbursementIds: selection,
        },
      };
    });
    setSelections(selection);
    handleDialogChange(false);
    toast.success(
      selection.length ? "Reimbursements applied." : "Reimbursements cleared.",
    );
  };

  const dialogContent = (() => {
    if (!dialogState) {
      return (
        <p className="text-sm text-slate-600">
          Select a row in the audit table to link reimbursements.
        </p>
      );
    }

    const baseRow = commitRows[dialogState.commitIndex] ?? null;
    if (!baseRow) {
      return (
        <p className="text-sm text-slate-600">
          This row is no longer available. Close and try again.
        </p>
      );
    }

    const basePreview = previewRowById.get(baseRow.id);
    const baseAccount = accountById.get(baseRow.account_id);
    const baseDescription =
      commitForm.watch(`rows.${dialogState.commitIndex}.description`) ??
      baseRow.description;
    const baseAmountValue =
      commitForm.watch(`rows.${dialogState.commitIndex}.amount`) ??
      baseRow.amount;
    const baseOriginalAmount =
      reimbursementsByRow[baseRow.id]?.originalAmount ?? baseAmountValue;
    const baseOccurredAt =
      commitForm.watch(`rows.${dialogState.commitIndex}.occurred_at`) ??
      baseRow.occurred_at;

    const candidateRows = commitRows
      .map((row, idx) => {
        const amountValue =
          commitForm.watch(`rows.${idx}.amount`) ?? row.amount ?? "0";
        const descriptionValue =
          commitForm.watch(`rows.${idx}.description`) ?? row.description;
        const occurredAtValue =
          commitForm.watch(`rows.${idx}.occurred_at`) ?? row.occurred_at;
        const previewMeta = previewRowById.get(row.id);
        const fileMeta = previewMeta
          ? fileById.get(previewMeta.file_id)
          : undefined;
        return {
          id: row.id,
          accountId: row.account_id,
          accountName: accountById.get(row.account_id)?.name ?? "Account",
          amountValue,
          amountNumber: toNumeric(amountValue),
          description: descriptionValue,
          occurredAt: occurredAtValue,
          fileLabel: fileMeta?.filename,
          isDeleted: commitForm.watch(`rows.${idx}.delete`) ?? false,
        };
      })
      .filter(
        (row) =>
          row.id !== baseRow.id &&
          row.amountNumber > 0 &&
          !splitRowIdsBySource[row.id],
      );

    const selectedTotal = selections.reduce((sum, id) => {
      const candidate = candidateRows.find((row) => row.id === id);
      return sum + (candidate?.amountNumber ?? 0);
    }, 0);
    const remainingAmount = toNumeric(baseOriginalAmount) - selectedTotal;

    return (
      <>
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Selected expense
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
            <Badge variant="secondary" className="bg-slate-100">
              {baseAccount?.name ?? "Account"}
            </Badge>
            <Badge variant="secondary" className="bg-slate-100">
              {toDateInputValue(baseOccurredAt)}
            </Badge>
            <Badge variant="secondary" className="bg-slate-100">
              Current amount: {baseOriginalAmount}
            </Badge>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              Reimbursed: {selectedTotal.toFixed(2)}
            </Badge>
            <Badge
              variant="secondary"
              className={cn(
                "text-xs",
                remainingAmount <= toNumeric(baseOriginalAmount)
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800",
              )}
            >
              Remaining: {remainingAmount.toFixed(2)}
            </Badge>
          </div>
          <p className="text-sm text-slate-600">
            {baseDescription ||
              basePreview?.description ||
              "Expense description"}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Select reimbursement payments
              </p>
              <p className="text-xs text-slate-500">
                Choose Swish/Venmo repayments to offset this expense even if
                they are on another account.
              </p>
            </div>
            {reimbursementsByRow[baseRow.id]?.reimbursementIds?.length ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => applySelection([])}
              >
                Clear reimbursements
              </Button>
            ) : null}
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            {candidateRows.length ? (
              candidateRows.map((row) => {
                const selected = selections.includes(row.id);
                const badgeLabel = row.accountName.slice(0, 2).toUpperCase();
                return (
                  <Button
                    key={row.id}
                    variant={selected ? "default" : "outline"}
                    className="h-auto justify-start gap-3 text-left"
                    onClick={() =>
                      setSelections((prev) =>
                        prev.includes(row.id)
                          ? prev.filter((id) => id !== row.id)
                          : [...prev, row.id],
                      )
                    }
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-slate-100 text-xs font-semibold text-slate-700">
                      {badgeLabel}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900">
                        {row.description || "Reimbursement"}
                      </span>
                      <span className="text-xs text-slate-500">
                        {toDateInputValue(row.occurredAt)} • {row.amountValue} •{" "}
                        {row.accountName}{" "}
                        {row.fileLabel ? `• ${row.fileLabel}` : ""}
                        {row.isDeleted ? " • Marked deleted" : ""}
                      </span>
                    </div>
                  </Button>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">
                No incoming payments found in this upload. Look for positive
                amounts to offset the expense.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Applying will reduce the expense by the selected amount and mark
            those reimbursement rows as removed from the import.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => applySelection([])}
              disabled={!selections.length && !reimbursementsByRow[baseRow.id]}
            >
              Remove links
            </Button>
            <Button
              type="button"
              onClick={() => applySelection()}
              disabled={!selections.length}
            >
              Apply reimbursements
            </Button>
          </div>
        </DialogFooter>
      </>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Link reimbursements</DialogTitle>
          <DialogDescription>
            Pair the selected expense with incoming Swish or Venmo repayments.
            The expense will be reduced and the matched reimbursement rows will
            be removed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">{dialogContent}</div>
      </DialogContent>
    </Dialog>
  );
};
