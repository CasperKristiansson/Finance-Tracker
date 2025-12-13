import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AccountWithBalance } from "@/types/api";

type ReconcileAccountsDialogMode = "all" | "targets";

export type ReconcileAccountsPayload = {
  items: Array<{
    accountId: string;
    capturedAt: string;
    reportedBalance: string;
    description?: string;
    categoryId?: string | null;
  }>;
};

type ReconcileAccountsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountWithBalance[];
  targets: AccountWithBalance[];
  mode?: ReconcileAccountsDialogMode;
  loading?: boolean;
  error?: string;
  description?: string;
  categoryId?: string | null;
  onReconcile: (payload: ReconcileAccountsPayload) => void;
  onSuccess?: () => void;
};

const formatCurrency = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const needsReconciliation = (account: AccountWithBalance) =>
  Boolean(account.needs_reconciliation);

export function ReconcileAccountsDialog({
  open,
  onOpenChange,
  accounts,
  targets,
  mode = "targets",
  loading = false,
  error,
  description,
  categoryId = null,
  onReconcile,
  onSuccess,
}: ReconcileAccountsDialogProps) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  const displayAccounts = useMemo(
    () => (mode === "all" ? accounts : targets),
    [accounts, mode, targets],
  );

  const selectedAccounts = useMemo(() => {
    if (mode !== "all") return targets;
    return accounts.filter((acc) => selectedIds.has(acc.id));
  }, [accounts, mode, selectedIds, targets]);

  useEffect(() => {
    if (!open) return;
    const nextDisplayAccounts = mode === "all" ? accounts : targets;
    setDrafts(
      Object.fromEntries(
        nextDisplayAccounts.map((acc) => [acc.id, acc.balance]),
      ),
    );
    setSelectedIds(new Set(targets.map((acc) => acc.id)));
    setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open || !submitted) return;
    if (loading) return;
    if (error) return;
    onOpenChange(false);
    setSubmitted(false);
    onSuccess?.();
  }, [error, loading, onOpenChange, onSuccess, open, submitted]);

  const emptyText =
    mode === "all"
      ? "No accounts available to reconcile."
      : "No accounts currently require reconciliation.";

  const submitDisabled =
    loading ||
    (mode === "all" ? selectedAccounts.length === 0 : targets.length === 0);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (loading) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Reconcile accounts</DialogTitle>
          <DialogDescription>
            Enter the current balance from your bank/provider. Any difference
            will be posted as an adjustment transaction.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {displayAccounts.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {emptyText}
            </div>
          ) : (
            displayAccounts.map((account) => (
              <div
                key={account.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  {mode === "all" ? (
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(account.id)}
                        onChange={(e) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) {
                              next.add(account.id);
                            } else {
                              next.delete(account.id);
                            }
                            return next;
                          });
                        }}
                        disabled={loading}
                      />
                      <span className="truncate font-medium text-slate-900">
                        {account.name}
                      </span>
                      {needsReconciliation(account) ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Stale
                        </span>
                      ) : null}
                    </label>
                  ) : (
                    <div className="truncate font-medium text-slate-900">
                      {account.name}
                    </div>
                  )}
                  <div className="text-xs text-slate-500">
                    Ledger balance: {formatCurrency(Number(account.balance))}
                  </div>
                </div>
                <div className="sm:w-52">
                  <Label
                    htmlFor={`reconcile-balance-${account.id}`}
                    className="text-xs tracking-wide text-slate-500 uppercase"
                  >
                    Reported balance
                  </Label>
                  <Input
                    id={`reconcile-balance-${account.id}`}
                    inputMode="decimal"
                    value={drafts[account.id] ?? ""}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [account.id]: e.target.value,
                      }))
                    }
                    placeholder={account.balance}
                    disabled={
                      loading ||
                      (mode === "all" && !selectedIds.has(account.id))
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>

        {error ? <div className="text-sm text-rose-600">{error}</div> : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={() => {
              const capturedAt = new Date().toISOString();
              onReconcile({
                items: selectedAccounts.map((acc) => ({
                  accountId: acc.id,
                  capturedAt,
                  reportedBalance: drafts[acc.id]?.trim() || acc.balance,
                  description,
                  categoryId,
                })),
              });
              setSubmitted(true);
            }}
            disabled={submitDisabled}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Reconcile now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
