import { motion } from "framer-motion";
import {
  AlertCircle,
  Archive,
  Loader2,
  Plus,
  RefreshCw,
  Undo,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  MotionPage,
  StaggerWrap,
  fadeInUp,
  subtleHover,
} from "@/components/motion-presets";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { PageRoutes } from "@/data/routes";
import { useAccountsApi } from "@/hooks/use-api";
import { AccountType } from "@/types/api";
import { AccountModal } from "./children/account-modal";

type SortKey = "name" | "type" | "status" | "balance";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(value);

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

const renderAccountIcon = (icon: string | null | undefined, name: string) => {
  if (icon?.startsWith("lucide:")) {
    const key = icon.slice("lucide:".length);
    const IconComp = (
      LucideIcons as unknown as Record<string, LucideIcon | undefined>
    )[key];
    if (IconComp) {
      const Icon = IconComp as LucideIcon;
      return (
        <Icon className="h-8 w-8 rounded-full border border-slate-100 bg-white p-1 text-slate-700" />
      );
    }
  }
  if (icon) {
    return (
      <img
        src={`/${icon}`}
        alt={name}
        className="h-8 w-8 rounded-full border border-slate-100 bg-white object-contain p-1"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700">
      {name.charAt(0)}
    </div>
  );
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
    reconcileAccounts,
    reconcileLoading,
    reconcileError,
  } = useAccountsApi();
  const [asOfInput, setAsOfInput] = useState<string>(asOfDate ?? "");
  const [showInactive, setShowInactive] = useState(includeInactive);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcileDrafts, setReconcileDrafts] = useState<
    Record<string, string>
  >({});
  const [reconcileSelectedIds, setReconcileSelectedIds] = useState<Set<string>>(
    new Set(),
  );
  const [reconcileSubmitted, setReconcileSubmitted] = useState(false);

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

  const needsReconcile = useMemo(
    () => items.some((acc) => acc.needs_reconciliation),
    [items],
  );

  const reconcileTargets = useMemo(
    () => items.filter((acc) => acc.needs_reconciliation),
    [items],
  );
  const reconcileSelectedTargets = useMemo(
    () => items.filter((acc) => reconcileSelectedIds.has(acc.id)),
    [items, reconcileSelectedIds],
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

  useEffect(() => {
    if (!reconcileOpen) return;
    const defaults = Object.fromEntries(
      items.map((acc) => [acc.id, acc.balance]),
    );
    setReconcileDrafts(defaults);
    setReconcileSelectedIds(
      new Set(reconcileTargets.map((account) => account.id)),
    );
    setReconcileSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reconcileOpen]);

  useEffect(() => {
    if (!reconcileOpen || !reconcileSubmitted) return;
    if (reconcileLoading) return;
    if (reconcileError) return;
    setReconcileOpen(false);
    setReconcileSubmitted(false);
    fetchAccounts({
      includeInactive: showInactive,
      asOfDate: asOfInput || null,
    });
  }, [
    reconcileOpen,
    reconcileSubmitted,
    reconcileLoading,
    reconcileError,
    fetchAccounts,
    showInactive,
    asOfInput,
  ]);

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const direction = sortAsc ? 1 : -1;
      if (sortKey === "balance") {
        return (Number(a.balance) - Number(b.balance)) * direction;
      }
      if (sortKey === "name") {
        return a.name.localeCompare(b.name) * direction;
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
    <MotionPage className="space-y-4">
      <StaggerWrap className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <motion.div variants={fadeInUp}>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Accounts
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Balances and debt overview
          </h1>
          <p className="text-sm text-slate-500">
            Live balances with as-of filtering and archive controls.
          </p>
        </motion.div>
        <motion.div variants={fadeInUp} className="flex flex-wrap gap-2">
          <Button variant="default" className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add account
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-800"
            onClick={() => setReconcileOpen(true)}
            disabled={reconcileLoading}
          >
            {reconcileLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            Reconcile
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
        </motion.div>
      </StaggerWrap>

      {needsReconcile ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 shadow-[0_8px_24px_-20px_rgba(146,64,14,0.45)]">
          <AlertCircle className="mt-0.5 h-5 w-5" />
          <div className="flex-1">
            <div className="font-semibold">Accounts need reconciliation</div>
            <p className="text-amber-800">
              Balances may be stale. Reconcile to keep running balances
              accurate.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-2 border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
            onClick={() => setReconcileOpen(true)}
            disabled={reconcileLoading}
          >
            {reconcileLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Reconcile
          </Button>
        </div>
      ) : null}

      <Dialog
        open={reconcileOpen}
        onOpenChange={(open) => {
          if (reconcileLoading) return;
          setReconcileOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Reconcile accounts</DialogTitle>
            <DialogDescription>
              Enter the current balance from your bank/provider. Any difference
              will be posted as an adjustment transaction.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                No accounts available to reconcile.
              </div>
            ) : (
              items.map((account) => (
                <div
                  key={account.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={reconcileSelectedIds.has(account.id)}
                        onChange={(e) => {
                          const next = new Set(reconcileSelectedIds);
                          if (e.target.checked) {
                            next.add(account.id);
                          } else {
                            next.delete(account.id);
                          }
                          setReconcileSelectedIds(next);
                        }}
                        disabled={reconcileLoading}
                      />
                      <span className="truncate font-medium text-slate-900">
                        {account.name}
                      </span>
                      {account.needs_reconciliation ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                          Stale
                        </span>
                      ) : null}
                    </label>
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
                      value={reconcileDrafts[account.id] ?? ""}
                      onChange={(e) =>
                        setReconcileDrafts((prev) => ({
                          ...prev,
                          [account.id]: e.target.value,
                        }))
                      }
                      placeholder={account.balance}
                      disabled={
                        reconcileLoading ||
                        !reconcileSelectedIds.has(account.id)
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {reconcileError ? (
            <div className="text-sm text-rose-600">{reconcileError}</div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReconcileOpen(false)}
              disabled={reconcileLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => {
                const capturedAt = new Date().toISOString();
                reconcileAccounts({
                  items: reconcileSelectedTargets.map((acc) => ({
                    accountId: acc.id,
                    capturedAt,
                    reportedBalance:
                      reconcileDrafts[acc.id]?.trim() || acc.balance,
                    description: "Reconciled from Accounts",
                    categoryId: null,
                  })),
                });
                setReconcileSubmitted(true);
              }}
              disabled={
                reconcileLoading || reconcileSelectedTargets.length === 0
              }
            >
              {reconcileLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Reconcile now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <StaggerWrap className="grid gap-3 md:grid-cols-2">
        <motion.div variants={fadeInUp} {...subtleHover}>
          <Card className="flex h-full flex-col border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]">
            <CardHeader>
              <CardTitle className="text-sm text-slate-500">
                Accounts overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-slate-900">
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-xs tracking-wide text-slate-500 uppercase">
                  Total balance
                </span>
                <span className="text-xl font-semibold">
                  {formatCurrency(totalBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span className="text-xs tracking-wide text-slate-500 uppercase">
                  Active accounts
                </span>
                <span className="text-xl font-semibold">{activeCount}</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={fadeInUp} {...subtleHover}>
          <Card className="flex h-full flex-col border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]">
            <CardHeader>
              <CardTitle className="text-sm text-slate-500">Filters</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm text-slate-700">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(e) => setShowInactive(e.target.checked)}
                />
                Include inactive
              </label>
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1 text-xs text-slate-500">
                  As of date
                  <Input
                    type="date"
                    value={asOfInput}
                    onChange={(e) => setAsOfInput(e.target.value)}
                    className="max-w-xs"
                  />
                </label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApplyFilters}
                  className="max-w-xs"
                >
                  Apply
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </StaggerWrap>

      <motion.div variants={fadeInUp} {...subtleHover}>
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
              <div className="rounded-xl border border-slate-100 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">
                        <button
                          className="flex items-center gap-1 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                          onClick={() => toggleSort("name")}
                        >
                          Name
                        </button>
                      </TableHead>
                      <TableHead className="px-4">
                        <button
                          className="flex items-center gap-1 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                          onClick={() => toggleSort("type")}
                        >
                          Type
                        </button>
                      </TableHead>
                      <TableHead className="px-4">
                        <button
                          className="flex items-center gap-1 text-left text-xs font-medium tracking-wide text-slate-500 uppercase"
                          onClick={() => toggleSort("status")}
                        >
                          Status
                        </button>
                      </TableHead>
                      <TableHead className="px-4 text-right">
                        <button
                          className="ml-auto flex items-center gap-1 text-xs font-medium tracking-wide text-slate-500 uppercase"
                          onClick={() => toggleSort("balance")}
                        >
                          Balance
                        </button>
                      </TableHead>
                      <TableHead className="px-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedItems.map((account) => {
                      const isActive = account.is_active;
                      return (
                        <TableRow key={account.id} className="align-top">
                          <TableCell className="px-4 font-medium text-slate-900">
                            <div className="flex items-center gap-3">
                              {renderAccountIcon(account.icon, account.name)}
                              <span>{account.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-4 text-slate-600">
                            {formatAccountType(account.account_type)}
                          </TableCell>
                          <TableCell className="px-4">
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
                          <TableCell className="px-4 text-right font-semibold text-slate-900">
                            {formatCurrency(Number(account.balance))}
                          </TableCell>
                          <TableCell className="px-4 text-right">
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
                              {account.account_type === AccountType.DEBT ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="gap-1 text-slate-700"
                                  asChild
                                >
                                  <Link
                                    to={`${PageRoutes.loans}/${account.id}`}
                                  >
                                    Loan page
                                  </Link>
                                </Button>
                              ) : null}
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
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AccountModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        account={editingAccount}
      />
    </MotionPage>
  );
};
