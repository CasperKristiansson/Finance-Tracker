import {
  AlertCircle,
  Archive,
  Loader2,
  Plus,
  RefreshCw,
  Undo,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
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
import { useAccountsApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import { AccountType } from "@/types/api";
import { AccountModal } from "./children/account-modal";
import { LoanOverview } from "./children/loan-overview";

type SortKey = "order" | "type" | "status" | "balance";

const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const formatAccountType = (type: AccountType) => {
  switch (type) {
    case AccountType.DEBT:
      return "Debt";
    case AccountType.INVESTMENT:
      return "Investment";
    default:
      return "Cash";
  }
};

export const Accounts: React.FC = () => {
  const {
    items,
    loading,
    includeInactive,
    asOfDate,
    fetchAccounts,
    archiveAccount,
    updateAccount,
  } = useAccountsApi();
  const token = useAppSelector(selectToken);

  const [asOfInput, setAsOfInput] = useState<string>(asOfDate ?? "");
  const [showInactive, setShowInactive] = useState(includeInactive);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("order");
  const [sortAsc, setSortAsc] = useState(true);
  const [reconcileAccountId, setReconcileAccountId] = useState<string>("");
  const [reconcileAmount, setReconcileAmount] = useState<string>("");
  const [reconcileDate, setReconcileDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const needsReconcile = useMemo(
    () => items.some((acc) => acc.needs_reconciliation),
    [items],
  );

  useEffect(() => {
    fetchAccounts({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalBalance = useMemo(() => {
    return items.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
  }, [items]);

  const activeCount = useMemo(
    () => items.filter((acc) => acc.is_active).length,
    [items],
  );

  const editingAccount = useMemo(
    () => items.find((acc) => acc.id === editingId),
    [editingId, items],
  );

  const openCreate = () => {
    setEditingId(null);
    setModalOpen(true);
  };

  const handleArchiveToggle = (id: string, isActive: boolean) => {
    if (isActive) {
      archiveAccount(id);
      toast.success("Account archived");
    } else {
      updateAccount(id, { is_active: true });
      toast.success("Account restored");
    }
  };

  const handleApplyFilters = () => {
    fetchAccounts({
      includeInactive: showInactive,
      asOfDate: asOfInput || null,
    });
  };

  const submitReconciliation = async () => {
    if (!reconcileAccountId || !reconcileAmount || !reconcileDate) {
      toast.error("Pick account, amount, and date");
      return;
    }
    try {
      await apiFetch({
        path: `/accounts/${reconcileAccountId}/reconcile`,
        method: "POST",
        body: {
          captured_at: new Date(reconcileDate).toISOString(),
          reported_balance: reconcileAmount,
        },
        token,
      });
      toast.success("Reconciled");
      fetchAccounts({
        includeInactive: showInactive,
        asOfDate: asOfInput || null,
      });
      setReconcileAmount("");
    } catch (error) {
      toast.error("Reconciliation failed", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const direction = sortAsc ? 1 : -1;
      if (sortKey === "balance") {
        return (Number(a.balance) - Number(b.balance)) * direction;
      }
      if (sortKey === "order") {
        const aOrder = a.display_order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.display_order ?? Number.MAX_SAFE_INTEGER;
        return (aOrder - bOrder) * direction;
      }
      if (sortKey === "status") {
        return (Number(b.is_active) - Number(a.is_active)) * direction;
      }
      if (sortKey === "type") {
        return a.account_type.localeCompare(b.account_type) * direction;
      }
      return 0;
    });
    return copy;
  }, [items, sortAsc, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Accounts
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Balances and debt overview
          </h1>
          <p className="text-sm text-slate-500">
            Live balances with as-of filtering and archive controls.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="default" className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add account
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-800"
            onClick={() =>
              fetchAccounts({
                includeInactive: showInactive,
                asOfDate: asOfInput,
              })
            }
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {needsReconcile ? (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-[0_10px_30px_-24px_rgba(146,64,14,0.45)]">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <div className="font-semibold">Needs reconciliation</div>
          </div>
          <p className="text-amber-800">
            One or more accounts haven’t been reconciled recently or drifted
            from the last snapshot. Enter the latest end-of-month balance and
            I’ll post an adjustment.
          </p>
          <div className="grid gap-2 md:grid-cols-5 md:items-center">
            <select
              className="col-span-2 rounded-md border border-amber-200 bg-white px-3 py-2 text-sm"
              value={reconcileAccountId}
              onChange={(e) => setReconcileAccountId(e.target.value)}
            >
              <option value="">Select account</option>
              {items.map((acc, idx) => (
                <option key={acc.id} value={acc.id}>
                  {`Account ${idx + 1}`} • {formatAccountType(acc.account_type)}
                </option>
              ))}
            </select>
            <Input
              type="number"
              placeholder="Reported balance"
              value={reconcileAmount}
              onChange={(e) => setReconcileAmount(e.target.value)}
            />
            <Input
              type="date"
              value={reconcileDate}
              onChange={(e) => setReconcileDate(e.target.value)}
            />
            <Button
              variant="default"
              className="gap-2"
              disabled={!reconcileAccountId || !reconcileAmount}
              onClick={submitReconciliation}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Reconcile
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Total balance
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-900">
            {formatCurrency(totalBalance)}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">
              Active accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-900">
            {activeCount}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]">
          <CardHeader>
            <CardTitle className="text-sm text-slate-500">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-slate-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              Include inactive
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-500">
              As of date
              <Input
                type="date"
                value={asOfInput}
                onChange={(e) => setAsOfInput(e.target.value)}
              />
            </label>
            <Button size="sm" variant="outline" onClick={handleApplyFilters}>
              Apply
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.4)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold text-slate-900">
              Accounts
            </CardTitle>
            <p className="text-xs text-slate-500">
              Balances {asOfInput ? `as of ${asOfInput}` : "up to now"}
            </p>
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          <Separator />
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(4)].map((_, idx) => (
                <Skeleton key={idx} className="h-12 w-full" />
              ))}
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-center">
              <p className="text-sm font-semibold text-slate-900">
                No accounts yet
              </p>
              <p className="text-sm text-slate-500">
                Add an account or import data to see balances here.
              </p>
              <Button size="sm" onClick={openCreate}>
                Add account
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                      onClick={() => toggleSort("order")}
                    >
                      Order
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                      onClick={() => toggleSort("type")}
                    >
                      Type
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      className="flex items-center gap-1 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                      onClick={() => toggleSort("status")}
                    >
                      Status
                    </button>
                  </TableHead>
                  <TableHead className="text-right">
                    <button
                      className="ml-auto flex items-center gap-1 text-xs font-medium tracking-wide text-slate-500 uppercase"
                      onClick={() => toggleSort("balance")}
                    >
                      Balance
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedItems.map((account) => {
                  const isActive = account.is_active;
                  return (
                    <TableRow key={account.id} className="align-top">
                      <TableCell className="font-medium text-slate-900">
                        {account.display_order !== null &&
                        account.display_order !== undefined
                          ? `${account.display_order}. `
                          : ""}
                        {formatAccountType(account.account_type)} account
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {formatAccountType(account.account_type)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isActive ? "default" : "outline"}
                          className={
                            isActive
                              ? "bg-emerald-50 text-emerald-700"
                              : "border-slate-300 text-slate-600"
                          }
                        >
                          {isActive ? "Active" : "Archived"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900">
                        {formatCurrency(Number(account.balance))}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-slate-700"
                            onClick={() => {
                              setEditingId(account.id);
                              setModalOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-slate-700"
                            onClick={() =>
                              handleArchiveToggle(account.id, isActive)
                            }
                          >
                            {isActive ? (
                              <>
                                <Archive className="h-4 w-4" /> Archive
                              </>
                            ) : (
                              <>
                                <Undo className="h-4 w-4" /> Restore
                              </>
                            )}
                          </Button>
                        </div>
                        {account.account_type === AccountType.DEBT ? (
                          <div className="mt-3">
                            <LoanOverview account={account} />
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        account={editingAccount}
      />
    </div>
  );
};
