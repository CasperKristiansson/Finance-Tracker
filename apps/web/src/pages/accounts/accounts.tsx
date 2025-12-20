import { motion } from "framer-motion";
import { Archive, Loader2, Undo } from "lucide-react";
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
import { useAccountsApi, useInvestmentsApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import { AccountType, type YearlyOverviewResponse } from "@/types/api";
import { yearlyOverviewSchema } from "@/types/schemas";
import { AccountModal } from "./children/account-modal";
import {
  AccountHealthCard,
  type AccountHealth,
} from "./components/account-health-card";
import { AccountsHeader } from "./components/accounts-header";
import { ReconcileBanner } from "./components/reconcile-banner";
import {
  formatAccountType,
  formatCurrency,
  normalizeKey,
  renderAccountIcon,
  sparklinePath,
} from "./utils";

type SortKey = "name" | "type" | "status" | "balance";
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
  const {
    overview: investmentsOverview,
    loading: investmentsLoading,
    fetchOverview,
  } = useInvestmentsApi();
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
    if (!token) return;
    const hasInvestments = items.some(
      (acc) => acc.account_type === AccountType.INVESTMENT,
    );
    if (!hasInvestments) return;
    if (investmentsOverview) return;
    fetchOverview();
  }, [fetchOverview, investmentsOverview, items, token]);

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

  const accountHealth = useMemo<AccountHealth>(() => {
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

  const investmentTrendById = useMemo(() => {
    const map = new Map<string, number[]>();
    const accounts = investmentsOverview?.accounts ?? [];
    if (!accounts.length) return map;

    const baseDate = asOfDate ? new Date(asOfDate) : new Date();
    const asOfTime = baseDate.getTime();

    accounts.forEach((account) => {
      const points = (account.series ?? [])
        .map((p) => ({
          date: new Date(p.date),
          value: Number(p.value),
        }))
        .filter(
          (p) =>
            Number.isFinite(p.date.getTime()) &&
            p.date.getTime() <= asOfTime &&
            Number.isFinite(p.value),
        );

      if (points.length < 2) return;

      const byMonth = new Map<number, { t: number; value: number }>();
      points.forEach((p) => {
        const monthKey = p.date.getFullYear() * 12 + p.date.getMonth();
        const t = p.date.getTime();
        const existing = byMonth.get(monthKey);
        if (!existing || t > existing.t) {
          byMonth.set(monthKey, { t, value: p.value });
        }
      });

      const monthValues = [...byMonth.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([, v]) => v.value);

      const series = monthValues.slice(-6);
      if (series.length >= 2) {
        map.set(account.account_id, series);
        map.set(`name:${normalizeKey(account.name)}`, series);
      }
    });

    return map;
  }, [asOfDate, investmentsOverview?.accounts]);
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
      <StaggerWrap>
        <motion.div variants={fadeInUp}>
          <AccountsHeader
            onAddAccount={openCreate}
            onReconcile={() => setReconcileOpen(true)}
            onRefresh={() =>
              fetchAccounts({
                includeInactive: showInactive,
                asOfDate: asOfInput,
              })
            }
            reconcileLoading={reconcileLoading}
          />
        </motion.div>
      </StaggerWrap>

      <ReconcileBanner
        visible={needsReconcile}
        reconcileLoading={reconcileLoading}
        onReconcile={() => setReconcileOpen(true)}
      />

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
        <AccountHealthCard
          asOfDate={asOfDate}
          includeInactive={includeInactive}
          loading={yearlyOverviewLoading}
          health={accountHealth}
        />
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
                      const series =
                        accountTrendById.get(account.id) ??
                        investmentTrendById.get(account.id) ??
                        investmentTrendById.get(
                          `name:${normalizeKey(account.name)}`,
                        ) ??
                        [];
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
                            <Link
                              to={`${PageRoutes.accounts}/${account.id}`}
                              className="flex items-center gap-3 hover:underline"
                            >
                              {renderAccountIcon(account.icon, account.name)}
                              <span>{account.name}</span>
                            </Link>
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
                            {yearlyOverviewLoading ||
                            (account.account_type === AccountType.INVESTMENT &&
                              investmentsLoading) ? (
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
