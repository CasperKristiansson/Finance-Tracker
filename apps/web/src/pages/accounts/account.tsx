import { motion } from "framer-motion";
import {
  Archive,
  ArrowLeft,
  Edit,
  Loader2,
  RefreshCw,
  Undo,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { ChartContainer } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageRoutes } from "@/data/routes";
import { selectToken } from "@/features/auth/authSlice";
import { useAccountsApi, useInvestmentsApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import {
  AccountType,
  type TransactionListResponse,
  type TransactionRead,
  type YearlyOverviewResponse,
} from "@/types/api";
import { transactionListSchema, yearlyOverviewSchema } from "@/types/schemas";
import { AccountModal } from "./children/account-modal";

const formatCurrency = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });

const compactCurrency = (value: number) =>
  new Intl.NumberFormat("sv-SE", {
    notation: "compact",
    maximumFractionDigits: 1,
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

const startOfYear = (year: number) => `${year}-01-01`;
const todayIso = () => new Date().toISOString().slice(0, 10);

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "");

export const AccountDetails: React.FC = () => {
  const { accountId } = useParams();
  const token = useAppSelector(selectToken);
  const [activeTab, setActiveTab] = useState<
    "overview" | "transactions" | "settings"
  >("overview");
  const [refreshSeq, setRefreshSeq] = useState(0);

  const {
    items: accounts,
    loading: accountsLoading,
    asOfDate,
    includeInactive,
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
    fetchOverview: fetchInvestmentsOverview,
  } = useInvestmentsApi();

  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const year = useMemo(() => new Date().getFullYear(), []);
  const ytdStart = useMemo(() => startOfYear(year), [year]);
  const ytdEnd = useMemo(() => todayIso(), []);

  const account = useMemo(
    () => accounts.find((acc) => acc.id === accountId) ?? null,
    [accountId, accounts],
  );

  useEffect(() => {
    if (accounts.length) return;
    fetchAccounts({ includeInactive: true });
  }, [accounts.length, fetchAccounts]);

  useEffect(() => {
    if (!token) return;
    if (!accountId) return;
    if (account?.account_type !== AccountType.INVESTMENT) return;
    if (investmentsOverview) return;
    fetchInvestmentsOverview();
  }, [
    account?.account_type,
    accountId,
    fetchInvestmentsOverview,
    investmentsOverview,
    token,
  ]);

  const [yearlyOverview, setYearlyOverview] =
    useState<YearlyOverviewResponse | null>(null);
  const [yearlyOverviewLoading, setYearlyOverviewLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      if (!accountId) return;
      setYearlyOverviewLoading(true);
      try {
        const { data } = await apiFetch<YearlyOverviewResponse>({
          path: "/reports/yearly-overview",
          schema: yearlyOverviewSchema,
          query: { year, account_ids: accountId },
          token,
        });
        setYearlyOverview(data);
      } catch (err) {
        console.error("Failed to fetch yearly overview for account", err);
        setYearlyOverview(null);
      } finally {
        setYearlyOverviewLoading(false);
      }
    };
    void load();
  }, [accountId, refreshSeq, token, year]);

  const accountFlow = useMemo(() => {
    const flows = yearlyOverview?.account_flows ?? [];
    return flows.find((f) => f.account_id === accountId) ?? flows[0] ?? null;
  }, [accountId, yearlyOverview?.account_flows]);

  const investmentSeries = useMemo(() => {
    if (!account) return null;
    const accounts = investmentsOverview?.accounts ?? [];
    if (!accounts.length) return null;

    const byId = accounts.find((a) => a.account_id === account.id);
    if (byId?.series?.length) return byId.series;

    const accountKey = normalizeKey(account.name);
    const byName = accounts.find((a) => normalizeKey(a.name) === accountKey);
    if (byName?.series?.length) return byName.series;

    return null;
  }, [account, investmentsOverview?.accounts]);

  const balanceSeries = useMemo(() => {
    const currentMonthIndex = new Date().getMonth();

    if (account?.account_type === AccountType.INVESTMENT && investmentSeries) {
      const byMonth = new Map<number, number>();
      investmentSeries.forEach((p) => {
        const date = new Date(p.date);
        if (date.getFullYear() !== year) return;
        const monthIndex = date.getMonth();
        const value = Number(p.value);
        if (Number.isFinite(value)) {
          byMonth.set(monthIndex, value);
        }
      });

      const known = [...byMonth.keys()];
      const maxKnown = known.length ? Math.max(...known) : -1;
      return Array.from({ length: 12 }, (_, monthIndex) => {
        const month = new Date(year, monthIndex, 1).toLocaleString("en-US", {
          month: "short",
        });
        if (monthIndex > Math.min(currentMonthIndex, maxKnown)) {
          return { month, balance: null as number | null };
        }
        return { month, balance: byMonth.get(monthIndex) ?? null };
      });
    }

    if (!accountFlow) return [];
    const startBalance = Number(accountFlow.start_balance);
    const changes = accountFlow.monthly_change.map((v) => Number(v) || 0);

    let running = Number.isFinite(startBalance) ? startBalance : 0;
    const balancesByMonth = changes.map((change) => {
      running += change;
      return running;
    });

    let lastMonthIndex = -1;
    for (let idx = balancesByMonth.length - 1; idx >= 0; idx -= 1) {
      if (Number.isFinite(balancesByMonth[idx])) {
        lastMonthIndex = idx;
        break;
      }
    }

    return Array.from({ length: 12 }, (_, monthIndex) => {
      const month = new Date(year, monthIndex, 1).toLocaleString("en-US", {
        month: "short",
      });
      if (monthIndex > Math.min(currentMonthIndex, lastMonthIndex)) {
        return { month, balance: null as number | null };
      }
      return { month, balance: balancesByMonth[monthIndex] ?? null };
    });
  }, [account?.account_type, accountFlow, investmentSeries, year]);

  const cashflowSeries = useMemo(() => {
    if (!accountFlow) return [];
    const maxMonth = new Date().getMonth();
    return Array.from({ length: 12 }, (_, monthIndex) => {
      const month = new Date(year, monthIndex, 1).toLocaleString("en-US", {
        month: "short",
      });
      if (monthIndex > maxMonth) {
        return {
          month,
          income: null as number | null,
          expense: null as number | null,
          transfersIn: null as number | null,
          transfersOut: null as number | null,
        };
      }
      return {
        month,
        income: Number(accountFlow.monthly_income[monthIndex] ?? 0),
        expense: Number(accountFlow.monthly_expense[monthIndex] ?? 0),
        transfersIn: Number(accountFlow.monthly_transfers_in[monthIndex] ?? 0),
        transfersOut: Number(
          accountFlow.monthly_transfers_out[monthIndex] ?? 0,
        ),
      };
    });
  }, [accountFlow, year]);

  const kpis = useMemo(() => {
    const balanceNow = account ? Number(account.balance) : 0;
    const changeYtd = accountFlow ? Number(accountFlow.change) : 0;
    const monthsElapsed = new Date().getMonth() + 1;
    const avgIncome = accountFlow
      ? Number(accountFlow.income) / monthsElapsed
      : 0;
    const avgExpense = accountFlow
      ? Number(accountFlow.expense) / monthsElapsed
      : 0;
    const net = avgIncome - avgExpense;
    return { balanceNow, changeYtd, avgIncome, avgExpense, net };
  }, [account, accountFlow]);

  const topExpenseCategories = useMemo(() => {
    const rows = yearlyOverview?.category_breakdown ?? [];
    return rows
      .map((row) => ({ name: row.name, total: Math.abs(Number(row.total)) }))
      .filter((row) => Number.isFinite(row.total) && row.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [yearlyOverview?.category_breakdown]);

  const topIncomeCategories = useMemo(() => {
    const rows = yearlyOverview?.income_category_breakdown ?? [];
    return rows
      .map((row) => ({ name: row.name, total: Math.abs(Number(row.total)) }))
      .filter((row) => Number.isFinite(row.total) && row.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [yearlyOverview?.income_category_breakdown]);

  const topMerchants = useMemo(() => {
    const rows = yearlyOverview?.top_merchants ?? [];
    return rows
      .map((row) => ({
        name: row.merchant,
        total: Math.abs(Number(row.amount)),
      }))
      .filter((row) => Number.isFinite(row.total) && row.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [yearlyOverview?.top_merchants]);

  const [txItems, setTxItems] = useState<TransactionRead[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txOffset, setTxOffset] = useState(0);
  const [txHasMore, setTxHasMore] = useState(true);
  const txLimit = 50;

  const loadTransactions = async (opts?: { reset?: boolean }) => {
    if (!token) return;
    if (!accountId) return;
    const reset = Boolean(opts?.reset);
    const nextOffset = reset ? 0 : txOffset;
    setTxLoading(true);
    setTxError(null);
    try {
      const query = {
        start_date: ytdStart,
        end_date: ytdEnd,
        account_ids: accountId,
        limit: txLimit,
        offset: nextOffset,
      };
      const { data } = await apiFetch<TransactionListResponse>({
        path: "/transactions",
        schema: transactionListSchema,
        query,
        token,
      });
      const next = reset
        ? data.transactions
        : [...txItems, ...data.transactions];
      setTxItems(next);
      setTxOffset(nextOffset + data.transactions.length);
      setTxHasMore(data.transactions.length >= txLimit);
    } catch (err) {
      console.error("Failed to load account transactions", err);
      setTxError("Failed to load transactions.");
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    void loadTransactions({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, refreshSeq, token, ytdEnd, ytdStart]);

  if (!accountId) {
    return (
      <MotionPage className="space-y-4">
        <Card className="border-slate-200">
          <CardContent className="p-6 text-sm text-slate-600">
            Missing account id.
          </CardContent>
        </Card>
      </MotionPage>
    );
  }

  return (
    <MotionPage className="space-y-4">
      <StaggerWrap className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <motion.div variants={fadeInUp} className="space-y-1">
          <Link
            to={PageRoutes.accounts}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to accounts
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              {account?.name ?? "Account"}
            </h1>
            {account ? (
              <>
                <Badge className="bg-slate-100 text-slate-700">
                  {formatAccountType(account.account_type)}
                </Badge>
                <Badge
                  variant={account.is_active ? "default" : "outline"}
                  className={
                    account.is_active
                      ? "bg-emerald-50 text-emerald-700"
                      : "border-slate-300 text-slate-600"
                  }
                >
                  {account.is_active ? "Active" : "Archived"}
                </Badge>
                {account.needs_reconciliation ? (
                  <Badge className="bg-amber-100 text-amber-800">Stale</Badge>
                ) : null}
              </>
            ) : null}
          </div>
          <p className="text-sm text-slate-500">
            YTD overview ({ytdStart} → {ytdEnd})
          </p>
          <p className="text-xs text-slate-500">
            {asOfDate ? `As of ${asOfDate}` : "Live balances"}{" "}
            {includeInactive ? "(including inactive enabled)" : ""}
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-700"
            onClick={() => {
              fetchAccounts({ includeInactive: true });
              setRefreshSeq((v) => v + 1);
              toast.message("Refreshing…");
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-700"
            onClick={() => setReconcileOpen(true)}
            disabled={!account || reconcileLoading}
          >
            {reconcileLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Reconcile
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-700"
            onClick={() => setEditOpen(true)}
            disabled={!account}
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          {account ? (
            <Button
              variant="outline"
              className="gap-2 border-slate-300 text-slate-700"
              onClick={() => {
                if (account.is_active) {
                  archiveAccount(account.id);
                  toast.success("Account archived");
                } else {
                  updateAccount(account.id, { is_active: true });
                  toast.success("Account restored");
                }
              }}
            >
              {account.is_active ? (
                <>
                  <Archive className="h-4 w-4" /> Archive
                </>
              ) : (
                <>
                  <Undo className="h-4 w-4" /> Restore
                </>
              )}
            </Button>
          ) : null}
        </motion.div>
      </StaggerWrap>

      <ReconcileAccountsDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        accounts={accounts}
        targets={account ? [account] : []}
        mode="targets"
        loading={reconcileLoading}
        error={reconcileError}
        description={`Reconciled from ${account?.name ?? "Account"}`}
        onReconcile={reconcileAccounts}
        onSuccess={() => fetchAccounts({ includeInactive: true })}
      />

      <AccountModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        account={account ?? undefined}
      />

      <StaggerWrap className="grid gap-3 md:grid-cols-4">
        {[
          {
            label: "Balance",
            value: formatCurrency(kpis.balanceNow),
            tone: "text-slate-900",
          },
          {
            label: "Change (YTD)",
            value: `${kpis.changeYtd >= 0 ? "+" : "−"}${formatCurrency(
              Math.abs(kpis.changeYtd),
            )}`,
            tone: kpis.changeYtd >= 0 ? "text-emerald-700" : "text-rose-700",
          },
          {
            label: "Avg income / mo",
            value: formatCurrency(kpis.avgIncome),
            tone: "text-emerald-700",
          },
          {
            label: "Avg expense / mo",
            value: formatCurrency(kpis.avgExpense),
            tone: "text-rose-700",
          },
        ].map((kpi) => (
          <motion.div key={kpi.label} variants={fadeInUp} {...subtleHover}>
            <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
              <CardContent className="p-4">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  {kpi.label}
                </p>
                {accountsLoading ? (
                  <Skeleton className="mt-2 h-8 w-36" />
                ) : (
                  <p className={cn("mt-2 text-2xl font-semibold", kpi.tone)}>
                    {kpi.value}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </StaggerWrap>

      <motion.div variants={fadeInUp} {...subtleHover}>
        <Card className="border-slate-200 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.25)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Account details
              </CardTitle>
              <p className="text-xs text-slate-500">
                Trends and activity for this account (YTD).
              </p>
            </div>
            {(yearlyOverviewLoading ||
              (account?.account_type === AccountType.INVESTMENT &&
                investmentsLoading)) && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Separator />
            <div className="p-4">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              >
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="overview" className="cursor-pointer">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="transactions" className="cursor-pointer">
                    Transactions
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="cursor-pointer">
                    Settings
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {activeTab === "overview" ? (
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <Card className="border-slate-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-500">
                      Balance trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    {yearlyOverviewLoading || accountsLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : balanceSeries.length ? (
                      <ChartContainer
                        className="h-full w-full"
                        config={{
                          balance: {
                            label: "Balance",
                            color: "var(--chart-balance, #0ea5e9)",
                          },
                        }}
                      >
                        <AreaChart
                          data={balanceSeries}
                          margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="balanceFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-balance)"
                                stopOpacity={0.35}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-balance)"
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                            tickMargin={12}
                            width={90}
                          />
                          <ReferenceLine
                            y={0}
                            stroke="#cbd5e1"
                            strokeDasharray="4 4"
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const point = payload[0].payload as {
                                month?: string;
                                balance?: number | null;
                              };
                              const value = point.balance;
                              return (
                                <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                                  <p className="font-semibold text-slate-800">
                                    {point.month}
                                  </p>
                                  <p className="text-slate-600">
                                    Balance:{" "}
                                    <span className="font-semibold text-slate-800 tabular-nums">
                                      {value === null || value === undefined
                                        ? "—"
                                        : formatCurrency(Number(value))}
                                    </span>
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Area
                            type="monotoneX"
                            dataKey="balance"
                            stroke="var(--color-balance)"
                            fill="url(#balanceFill)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                          />
                        </AreaChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        No balance history yet.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-500">
                      Cashflow (YTD)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    {yearlyOverviewLoading || accountsLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : cashflowSeries.length ? (
                      <ChartContainer
                        className="h-full w-full"
                        config={{
                          income: { label: "Income", color: "#10b981" },
                          expense: { label: "Expense", color: "#ef4444" },
                          transfersIn: {
                            label: "Transfers in",
                            color: "#0ea5e9",
                          },
                          transfersOut: {
                            label: "Transfers out",
                            color: "#94a3b8",
                          },
                        }}
                      >
                        <BarChart
                          data={cashflowSeries}
                          margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="cfIncome"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-income)"
                                stopOpacity={0.95}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-income)"
                                stopOpacity={0.35}
                              />
                            </linearGradient>
                            <linearGradient
                              id="cfExpense"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-expense)"
                                stopOpacity={0.9}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-expense)"
                                stopOpacity={0.3}
                              />
                            </linearGradient>
                            <linearGradient
                              id="cfTin"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-transfersIn)"
                                stopOpacity={0.85}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-transfersIn)"
                                stopOpacity={0.25}
                              />
                            </linearGradient>
                            <linearGradient
                              id="cfTout"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-transfersOut)"
                                stopOpacity={0.85}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-transfersOut)"
                                stopOpacity={0.25}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                            tickMargin={12}
                            width={90}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const p = payload[0].payload as {
                                month?: string;
                                income?: number | null;
                                expense?: number | null;
                                transfersIn?: number | null;
                                transfersOut?: number | null;
                              };
                              return (
                                <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                                  <p className="font-semibold text-slate-800">
                                    {p.month}
                                  </p>
                                  <div className="mt-1 space-y-0.5 text-slate-700">
                                    <div className="flex justify-between gap-6">
                                      <span>Income</span>
                                      <span className="font-semibold tabular-nums">
                                        {formatCurrency(Number(p.income ?? 0))}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                      <span>Expense</span>
                                      <span className="font-semibold tabular-nums">
                                        {formatCurrency(Number(p.expense ?? 0))}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                      <span>Transfers in</span>
                                      <span className="font-semibold tabular-nums">
                                        {formatCurrency(
                                          Number(p.transfersIn ?? 0),
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                      <span>Transfers out</span>
                                      <span className="font-semibold tabular-nums">
                                        {formatCurrency(
                                          Number(p.transfersOut ?? 0),
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar
                            dataKey="income"
                            fill="url(#cfIncome)"
                            radius={[6, 6, 0, 0]}
                            barSize={12}
                          />
                          <Bar
                            dataKey="expense"
                            fill="url(#cfExpense)"
                            radius={[6, 6, 0, 0]}
                            barSize={12}
                          />
                          <Bar
                            dataKey="transfersIn"
                            fill="url(#cfTin)"
                            radius={[6, 6, 0, 0]}
                            barSize={12}
                          />
                          <Bar
                            dataKey="transfersOut"
                            fill="url(#cfTout)"
                            radius={[6, 6, 0, 0]}
                            barSize={12}
                          />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        No cashflow data yet.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-500">
                      Top categories (YTD)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {yearlyOverviewLoading ? (
                      <Skeleton className="h-28 w-full" />
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-100 bg-white p-3">
                          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Income
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {topIncomeCategories.length ? (
                              topIncomeCategories.map((row) => (
                                <div
                                  key={row.name}
                                  className="flex items-center justify-between gap-4 text-sm"
                                >
                                  <span className="min-w-0 truncate text-slate-700">
                                    {row.name}
                                  </span>
                                  <span className="font-semibold text-slate-900 tabular-nums">
                                    {formatCurrency(row.total)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500">
                                No income categories yet.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-white p-3">
                          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Expenses
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {topExpenseCategories.length ? (
                              topExpenseCategories.map((row) => (
                                <div
                                  key={row.name}
                                  className="flex items-center justify-between gap-4 text-sm"
                                >
                                  <span className="min-w-0 truncate text-slate-700">
                                    {row.name}
                                  </span>
                                  <span className="font-semibold text-slate-900 tabular-nums">
                                    {formatCurrency(row.total)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500">
                                No expense categories yet.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-500">
                      Top merchants (YTD)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {yearlyOverviewLoading ? (
                      <Skeleton className="h-28 w-full" />
                    ) : topMerchants.length ? (
                      topMerchants.map((row) => (
                        <div
                          key={row.name}
                          className="flex items-center justify-between gap-4 text-sm"
                        >
                          <span className="min-w-0 truncate text-slate-700">
                            {row.name}
                          </span>
                          <span className="font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(row.total)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        No merchant data yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {activeTab === "transactions" ? (
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Transactions
                    </p>
                    <p className="text-xs text-slate-500">
                      Showing YTD transactions for this account.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 border-slate-300 text-slate-700"
                    onClick={() => loadTransactions({ reset: true })}
                    disabled={txLoading}
                  >
                    {txLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                </div>

                <Separator className="my-4" />

                {txError ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    {txError}
                  </div>
                ) : null}

                {txLoading && txItems.length === 0 ? (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, idx) => (
                      <Skeleton key={idx} className="h-12 w-full" />
                    ))}
                  </div>
                ) : txItems.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    No transactions in this range.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {txItems.map((tx) => {
                      const leg = tx.legs?.find(
                        (l) => l.account_id === accountId,
                      );
                      const amount = Number(leg?.amount ?? 0);
                      const isPositive = amount >= 0;
                      return (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.25)]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {tx.description?.trim() || "Transaction"}
                            </p>
                            <p className="text-xs text-slate-500">
                              {new Date(tx.occurred_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </p>
                          </div>
                          <div
                            className={cn(
                              "text-sm font-semibold tabular-nums",
                              isPositive ? "text-emerald-700" : "text-rose-700",
                            )}
                          >
                            {isPositive ? "+" : "−"}
                            {formatCurrency(Math.abs(amount))}
                          </div>
                        </div>
                      );
                    })}

                    <div className="pt-2">
                      <Button
                        variant="outline"
                        className="w-full border-slate-300 text-slate-700"
                        onClick={() => loadTransactions({ reset: false })}
                        disabled={txLoading || !txHasMore}
                      >
                        {txLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {txHasMore ? "Load more" : "No more transactions"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "settings" ? (
              <div className="p-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Account settings
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Edit, archive, and reconciliation actions are available in
                    the header.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="gap-2 border-slate-300 text-slate-700"
                      onClick={() => setEditOpen(true)}
                      disabled={!account}
                    >
                      <Edit className="h-4 w-4" />
                      Edit account
                    </Button>
                    {account?.account_type === AccountType.DEBT ? (
                      <Button
                        asChild
                        variant="outline"
                        className="border-slate-300 text-slate-700"
                      >
                        <Link to={`${PageRoutes.loans}/${account.id}`}>
                          Open loan page
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>
    </MotionPage>
  );
};
