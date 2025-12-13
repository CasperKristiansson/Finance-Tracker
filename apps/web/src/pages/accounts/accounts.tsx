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
import { useAppSelector } from "@/app/hooks";
import {
  MotionPage,
  StaggerWrap,
  fadeInUp,
  subtleHover,
} from "@/components/motion-presets";
import { ReconcileAccountsDialog } from "@/components/reconcile-accounts-dialog";
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
import { PageRoutes } from "@/data/routes";
import { selectToken } from "@/features/auth/authSlice";
import { useAccountsApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import { AccountType, type YearlyOverviewResponse } from "@/types/api";
import { yearlyOverviewSchema } from "@/types/schemas";
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

const sparklinePath = (values: number[], width: number, height: number) => {
  if (values.length < 2) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const xStep = (width - pad * 2) / (values.length - 1);

  return values
    .map((value, idx) => {
      const x = pad + idx * xStep;
      const y = pad + (1 - (value - min) / range) * (height - pad * 2);
      return `${idx === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
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
  const token = useAppSelector(selectToken);
  const [asOfInput, setAsOfInput] = useState<string>(asOfDate ?? "");
  const [showInactive, setShowInactive] = useState(includeInactive);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [yearlyOverview, setYearlyOverview] =
    useState<YearlyOverviewResponse | null>(null);
  const [yearlyOverviewLoading, setYearlyOverviewLoading] = useState(false);

  useEffect(() => {
    fetchAccounts({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadYearlyOverview = async () => {
      if (!token) return;
      const baseDate = asOfDate ? new Date(asOfDate) : new Date();
      const year = baseDate.getFullYear();
      setYearlyOverviewLoading(true);
      try {
        const { data } = await apiFetch<YearlyOverviewResponse>({
          path: "/reports/yearly-overview",
          schema: yearlyOverviewSchema,
          query: { year },
          token,
        });
        setYearlyOverview(data);
      } catch (err) {
        console.error("Failed to fetch yearly overview", err);
        setYearlyOverview(null);
      } finally {
        setYearlyOverviewLoading(false);
      }
    };
    void loadYearlyOverview();
  }, [asOfDate, token]);

  const accountHealth = useMemo(() => {
    const balances = items.map((acc) => ({
      type: acc.account_type,
      balance: Number(acc.balance) || 0,
      active: Boolean(acc.is_active),
    }));

    const visible = balances;
    const cash = visible
      .filter(
        (acc) =>
          acc.type !== AccountType.DEBT && acc.type !== AccountType.INVESTMENT,
      )
      .reduce((sum, acc) => sum + acc.balance, 0);
    const investments = visible
      .filter((acc) => acc.type === AccountType.INVESTMENT)
      .reduce((sum, acc) => sum + acc.balance, 0);
    const debt = visible
      .filter((acc) => acc.type === AccountType.DEBT)
      .reduce((sum, acc) => sum + Math.abs(acc.balance), 0);
    const netWorth = cash + investments - debt;

    return { cash, investments, debt, netWorth };
  }, [items]);

  const accountTrendById = useMemo(() => {
    if (!yearlyOverview) return new Map<string, number[]>();
    const baseDate = asOfDate ? new Date(asOfDate) : new Date();
    const isPastYear = baseDate.getFullYear() < new Date().getFullYear();
    const endMonthIndex = isPastYear ? 11 : baseDate.getMonth();
    const startMonthIndex = Math.max(0, endMonthIndex - 5);
    const monthRange = Array.from(
      { length: endMonthIndex - startMonthIndex + 1 },
      (_, i) => startMonthIndex + i,
    );

    const map = new Map<string, number[]>();
    yearlyOverview.account_flows.forEach((flow) => {
      const startBalance = Number(flow.start_balance);
      const changes = flow.monthly_change.map((v) => Number(v) || 0);
      const balancesByMonth = changes.reduce<number[]>((acc, change, idx) => {
        const prev = idx === 0 ? startBalance : (acc[idx - 1] ?? startBalance);
        acc[idx] = prev + change;
        return acc;
      }, []);
      const series = monthRange.map(
        (monthIdx) => balancesByMonth[monthIdx] ?? 0,
      );
      map.set(flow.account_id, series);
    });
    return map;
  }, [asOfDate, yearlyOverview]);
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

      <ReconcileAccountsDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        accounts={items}
        targets={reconcileTargets}
        mode="all"
        loading={reconcileLoading}
        error={reconcileError}
        description="Reconciled from Accounts"
        onReconcile={reconcileAccounts}
        onSuccess={() =>
          fetchAccounts({
            includeInactive: showInactive,
            asOfDate: asOfInput || null,
          })
        }
      />

      <motion.div variants={fadeInUp} {...subtleHover}>
        <Card className="border-slate-200 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.4)]">
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-sm text-slate-500">
                Account health
              </CardTitle>
              <p className="text-xs text-slate-500">
                {asOfDate ? `As of ${asOfDate}` : "As of today"}
                {includeInactive ? " (including inactive)" : ""}
              </p>
            </div>
            {yearlyOverviewLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            ) : null}
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-[0_10px_30px_-28px_rgba(14,116,144,0.45)]">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Cash
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatCurrency(accountHealth.cash)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-[0_10px_30px_-28px_rgba(88,28,135,0.45)]">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Investments
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatCurrency(accountHealth.investments)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-[0_10px_30px_-28px_rgba(190,18,60,0.45)]">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Debt
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatCurrency(accountHealth.debt)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white px-4 py-3 shadow-[0_10px_30px_-28px_rgba(30,64,175,0.45)]">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Net worth
              </p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">
                {formatCurrency(accountHealth.netWorth)}
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

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
                      <TableHead className="hidden px-4 text-right lg:table-cell">
                        <span className="ml-auto flex items-center justify-end text-xs font-medium tracking-wide text-slate-500 uppercase">
                          Trend
                        </span>
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
                      const series = accountTrendById.get(account.id) ?? [];
                      const hasSeries = series.length >= 2;
                      const delta = hasSeries
                        ? series[series.length - 1] - series[0]
                        : 0;
                      const deltaPct =
                        hasSeries && series[0] !== 0
                          ? (delta / Math.abs(series[0])) * 100
                          : null;
                      const trendUp = delta >= 0;
                      const trendColor = trendUp ? "#10b981" : "#ef4444";
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
                          <TableCell className="hidden px-4 text-right lg:table-cell">
                            {yearlyOverviewLoading ? (
                              <div className="ml-auto h-8 w-28 animate-pulse rounded-md bg-slate-100" />
                            ) : hasSeries ? (
                              <div className="ml-auto flex w-28 flex-col items-end gap-1">
                                <svg
                                  width="112"
                                  height="28"
                                  viewBox="0 0 112 28"
                                  className="overflow-visible"
                                >
                                  <path
                                    d={sparklinePath(series, 112, 28)}
                                    fill="none"
                                    stroke={trendColor}
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                                <span
                                  className={`text-[11px] font-semibold tabular-nums ${
                                    trendUp
                                      ? "text-emerald-600"
                                      : "text-rose-600"
                                  }`}
                                >
                                  {deltaPct !== null
                                    ? `${trendUp ? "+" : ""}${deltaPct.toFixed(1)}%`
                                    : formatCurrency(delta)}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
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
