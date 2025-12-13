import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowUpRight,
  FileBarChart,
  PiggyBank,
  Plus,
  Receipt,
  Settings,
  Upload,
  Wallet,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageRoutes } from "@/data/routes";
import { selectIsAuthenticated, selectToken } from "@/features/auth/authSlice";
import {
  useAccountsApi,
  useReportsApi,
  useTransactionsApi,
} from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import {
  AccountType,
  type MonthlyReportEntry,
  type TransactionListResponse,
  TransactionType,
} from "@/types/api";
import { monthlyReportSchema, transactionListSchema } from "@/types/schemas";

type KPI = {
  title: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  helper?: string;
};

const numberFromString = (value?: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const currency = (value: number) =>
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

const formatDelta = (value: number) => {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${currency(Math.abs(value))}`;
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

const ChartCard: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  loading?: boolean;
}> = ({ title, description, children, action, loading }) => (
  <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
      <div>
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        {description ? (
          <p className="text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      {action}
    </CardHeader>
    <CardContent className="h-80 md:h-96">
      {loading ? <Skeleton className="h-full w-full" /> : children}
    </CardContent>
  </Card>
);

export const Dashboard: React.FC = () => {
  const {
    monthly,
    yearly,
    total,
    netWorth,
    fetchMonthlyReport,
    fetchYearlyReport,
    fetchTotalReport,
    fetchNetWorthReport,
  } = useReportsApi();
  const { recent, fetchRecentTransactions } = useTransactionsApi();
  const {
    items: accounts,
    loading: accountsLoading,
    fetchAccounts,
  } = useAccountsApi();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const token = useAppSelector(selectToken);
  const hasFetched = useRef(false);
  const [filteredMonthly, setFilteredMonthly] = useState<MonthlyReportEntry[]>(
    [],
  );
  const [accountDeltas, setAccountDeltas] = useState<Record<string, number>>(
    {},
  );
  const [recentTab, setRecentTab] = useState<"all" | "income" | "expense">(
    "all",
  );
  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) =>
          account.is_active !== false &&
          account.name !== "Offset" &&
          account.account_type !== AccountType.DEBT &&
          account.account_type !== AccountType.INVESTMENT,
      ),
    [accounts],
  );

  useEffect(() => {
    if (!isAuthenticated || hasFetched.current) return;
    hasFetched.current = true;
    const year = new Date().getFullYear();
    fetchMonthlyReport({ year });
    fetchYearlyReport();
    fetchTotalReport();
    fetchNetWorthReport();
    fetchAccounts();
  }, [
    fetchMonthlyReport,
    fetchYearlyReport,
    fetchTotalReport,
    fetchNetWorthReport,
    fetchAccounts,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const limit = 20;
    const transactionTypes =
      recentTab === "all"
        ? undefined
        : recentTab === "income"
          ? [TransactionType.INCOME]
          : [TransactionType.EXPENSE];
    fetchRecentTransactions({ limit, transactionTypes });
  }, [fetchRecentTransactions, isAuthenticated, recentTab]);

  useEffect(() => {
    const loadFilteredMonthly = async () => {
      if (!accounts.length || !token) return;
      const nonInvestmentIds = accounts
        .filter((acc) => acc.account_type !== AccountType.INVESTMENT)
        .map((acc) => acc.id);
      if (!nonInvestmentIds.length) return;
      const year = new Date().getFullYear();
      try {
        const { data } = await apiFetch<{ results: MonthlyReportEntry[] }>({
          path: "/reports/monthly",
          query: { year, account_ids: nonInvestmentIds },
          token,
          schema: monthlyReportSchema,
        });
        setFilteredMonthly(data.results ?? []);
      } catch (err) {
        console.error("Failed to fetch filtered monthly report", err);
      }
    };
    loadFilteredMonthly();
  }, [accounts, token]);

  useEffect(() => {
    const fetchDeltas = async () => {
      if (!activeAccounts.length || !token) return;
      const startOfYear = new Date(
        new Date().getFullYear(),
        0,
        1,
      ).toISOString();
      const accountIds = activeAccounts.map((a) => a.id).join(",");
      try {
        const { data } = await apiFetch<TransactionListResponse>({
          path: "/transactions",
          query: {
            start_date: startOfYear,
            account_ids: accountIds,
            limit: 200,
          },
          token,
          schema: transactionListSchema,
        });
        const deltaMap: Record<string, number> = {};
        (data.transactions || []).forEach((tx) => {
          tx.legs.forEach((leg) => {
            deltaMap[leg.account_id] =
              (deltaMap[leg.account_id] || 0) + Number(leg.amount);
          });
        });
        setAccountDeltas(deltaMap);
      } catch (err) {
        console.error("Failed to fetch account deltas", err);
      }
    };
    fetchDeltas();
  }, [activeAccounts, token]);

  const kpis: KPI[] = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const ytdSrc = filteredMonthly.length
      ? filteredMonthly
      : monthly.data || [];
    const ytd = ytdSrc.filter(
      (entry) => new Date(entry.period).getFullYear() === currentYear,
    );
    const ytdIncome = ytd.reduce((sum, entry) => sum + Number(entry.income), 0);
    const ytdExpense = ytd.reduce(
      (sum, entry) => sum + Number(entry.expense),
      0,
    );
    const ytdNet = ytdIncome - ytdExpense;
    const ytdSavingsRate =
      ytdIncome > 0 ? Math.round((ytdNet / ytdIncome) * 100) : 0;
    const netWorthNow = netWorth.data?.length
      ? Number(netWorth.data[netWorth.data.length - 1]?.net_worth)
      : numberFromString(total.data?.net);

    return [
      {
        title: "Net worth",
        value: currency(netWorthNow),
        trend: netWorthNow >= 0 ? "up" : "down",
        helper: "As of now",
      },
      {
        title: "Cash flow (YTD)",
        value: currency(ytdNet),
        delta: formatDelta(ytdNet),
        trend: ytdNet >= 0 ? "up" : "down",
        helper: `Year to date (${currentYear})`,
      },
      {
        title: "Savings rate",
        value: `${ytdSavingsRate}%`,
        helper: `Income retained YTD (${currentYear})`,
        trend: ytdSavingsRate >= 0 ? "up" : "down",
      },
    ];
  }, [filteredMonthly, monthly.data, netWorth.data, total.data]);

  const incomeExpenseChart = useMemo(() => {
    const src = filteredMonthly.length ? filteredMonthly : monthly.data || [];
    return src.map((entry) => ({
      month: new Date(entry.period).toLocaleString("en-US", { month: "short" }),
      income: Number(entry.income),
      expense: Number(entry.expense) * -1,
    }));
  }, [monthly.data, filteredMonthly]);

  const categoryBreakdown = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearlyTotals =
      (yearly.data || []).filter(
        (item) => "year" in item && Number(item.year) === currentYear,
      ) || [];
    const income = yearlyTotals.reduce(
      (acc, item) => acc + Number(item.income),
      0,
    );
    const expense = yearlyTotals.reduce(
      (acc, item) => acc + Number(item.expense),
      0,
    );
    return income || expense
      ? [
          { name: "Income", value: income },
          { name: "Expenses", value: expense },
        ]
      : [];
  }, [yearly.data]);

  const savingsRateData = useMemo(() => {
    const data = filteredMonthly.length ? filteredMonthly : monthly.data || [];
    return data.map((entry) => {
      const income = Number(entry.income);
      const expense = Number(entry.expense);
      const rate =
        income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
      return {
        month: new Date(entry.period).toLocaleString("en-US", {
          month: "short",
        }),
        rate,
      };
    });
  }, [monthly.data, filteredMonthly]);

  const netWorthData = useMemo(() => {
    const points = netWorth.data || [];
    return points.map((point) => ({
      date: point.period,
      net: Number(point.net_worth),
      year: new Date(point.period).getFullYear(),
    }));
  }, [netWorth.data]);

  const netWorthDomain = useMemo<[number, number]>(() => {
    if (!netWorthData.length) return [0, 0];
    const values = netWorthData.map((d) => d.net);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const upperPad = Math.abs(max) * 0.05 || 1;
    const lowerPad = Math.abs(min) * 0.1 || 1;
    const lower = min < 0 ? min - lowerPad : 0;
    const upper = max + upperPad;
    return [lower, upper];
  }, [netWorthData]);

  const cashOnHand = useMemo(
    () =>
      activeAccounts.reduce((sum, account) => {
        const bal = Number(account.balance);
        return sum + (Number.isFinite(bal) ? bal : 0);
      }, 0),
    [activeAccounts],
  );

  const runwayMetrics = useMemo(() => {
    const entries = monthly.data ? [...monthly.data] : [];
    if (!entries.length) {
      return {
        avgBurn: 0,
        avgIncome: 0,
        months: null as number | null,
        trend: "neutral" as "up" | "down" | "neutral",
        lastNet: 0,
        prevNet: 0,
        sparkline: [] as { month: string; balance: number }[],
      };
    }

    const sorted = entries.sort(
      (a, b) => new Date(a.period).getTime() - new Date(b.period).getTime(),
    );

    const avgBurn =
      sorted.reduce(
        (sum, entry) => sum + Math.max(Number(entry.expense), 0),
        0,
      ) / sorted.length;
    const avgIncome =
      sorted.reduce(
        (sum, entry) => sum + Math.max(Number(entry.income), 0),
        0,
      ) / sorted.length;
    const nets = sorted.map(
      (entry) => Number(entry.income) - Number(entry.expense),
    );
    const lastNet = nets[nets.length - 1] ?? 0;
    const prevNet = nets[nets.length - 2] ?? lastNet;
    const trend =
      lastNet > prevNet ? "up" : lastNet < prevNet ? "down" : "neutral";

    let running = 0;
    const sparkline = sorted.slice(-6).map((entry) => {
      running += Number(entry.income) - Number(entry.expense);
      return {
        month: new Date(entry.period).toLocaleString("en-US", {
          month: "short",
        }),
        balance: running,
      };
    });

    const months = avgBurn > 0 ? cashOnHand / avgBurn : null;

    return { avgBurn, avgIncome, months, trend, lastNet, prevNet, sparkline };
  }, [cashOnHand, monthly.data]);

  const recentTransactions = useMemo(() => {
    return recent.items.map((tx) => {
      const primaryLeg = tx.legs?.[0];
      const amount = primaryLeg ? Number(primaryLeg.amount) : 0;
      const txType =
        tx.transaction_type ||
        (amount >= 0 ? TransactionType.INCOME : TransactionType.EXPENSE);

      return {
        id: tx.id,
        description: tx.description?.trim() || "Transaction",
        amount,
        occurred_at: tx.occurred_at,
        account_id: primaryLeg?.account_id || "",
        category: tx.category_id || "—",
        type: txType,
        status: "reviewed",
      };
    });
  }, [recent.items]);

  const filteredRecentTransactions = useMemo(() => {
    if (recentTab === "all") return recentTransactions;
    return recentTransactions.filter((tx) =>
      tx.type === TransactionType.TRANSFER
        ? false
        : recentTab === "income"
          ? tx.type === TransactionType.INCOME || tx.amount > 0
          : tx.type === TransactionType.EXPENSE || tx.amount < 0,
    );
  }, [recentTab, recentTransactions]);

  return (
    <MotionPage className="space-y-4">
      <StaggerWrap className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <motion.div variants={fadeInUp}>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Overview
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Your money at a glance
          </h1>
          <p className="text-sm text-slate-500">
            Live net worth, cash flow, and savings snapshot.
          </p>
        </motion.div>
        <motion.div
          variants={fadeInUp}
          className="flex flex-wrap gap-2"
          {...subtleHover}
        >
          <Button
            variant="default"
            className="gap-2"
            onClick={() =>
              toast.info("Add transaction", {
                description: "Flow coming soon.",
              })
            }
          >
            <Plus className="h-4 w-4" />
            Add transaction
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-800"
            onClick={() =>
              toast.info("Import file", {
                description: "Upload flow coming soon.",
              })
            }
          >
            <Upload className="h-4 w-4" />
            Import file
          </Button>
        </motion.div>
      </StaggerWrap>

      <StaggerWrap className="grid gap-3 md:grid-cols-3">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            variants={fadeInUp}
            {...subtleHover}
            transition={{
              duration: 0.35,
              ease: "easeOut",
              delay: index * 0.05,
            }}
          >
            <Card className="border-slate-200 bg-white shadow-[0_10px_30px_-24px_rgba(30,64,175,0.6)]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                      {kpi.title}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {kpi.value}
                    </p>
                    {kpi.helper ? (
                      <p className="text-xs text-slate-500">{kpi.helper}</p>
                    ) : null}
                  </div>
                  {kpi.delta ? (
                    <span
                      className={`flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        kpi.trend === "up"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {kpi.trend === "up" ? (
                        <ArrowUpRight className="mr-1 h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="mr-1 h-4 w-4" />
                      )}
                      {kpi.delta}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </StaggerWrap>

      <StaggerWrap className="grid gap-4 md:grid-cols-2">
        <motion.div variants={fadeInUp}>
          <ChartCard
            title="Income vs Expense"
            description="Stacked by month"
            loading={monthly.loading}
          >
            <ChartContainer
              className="h-full w-full"
              config={{
                income: {
                  label: "Income",
                  color: "var(--chart-income, #22c55e)",
                },
                expense: {
                  label: "Expense",
                  color: "var(--chart-expense, #ef4444)",
                },
              }}
            >
              <AreaChart data={incomeExpenseChart}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#22c55e"
                  fill="url(#incomeFill)"
                  strokeWidth={2}
                  name="Income"
                />
                <Area
                  type="monotone"
                  dataKey="expense"
                  stroke="#ef4444"
                  fill="url(#expenseFill)"
                  strokeWidth={2}
                  name="Expense"
                />
              </AreaChart>
            </ChartContainer>
          </ChartCard>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <ChartCard
            title="Net Worth"
            description="Trajectory over time"
            loading={netWorth.loading}
          >
            <ChartContainer
              className="h-full w-full"
              config={{
                net: {
                  label: "Net worth",
                  color: "#4f46e5",
                },
              }}
            >
              <AreaChart
                data={netWorthData}
                margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                    })
                  }
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  domain={netWorthDomain}
                  allowDataOverflow
                  tickMargin={12}
                  width={90}
                  tickFormatter={(v) => compactCurrency(Number(v))}
                />
                <Tooltip content={<ChartTooltipContent />} />
                {Array.from(new Set(netWorthData.map((d) => d.year))).map(
                  (year) => {
                    const firstPoint = netWorthData.find(
                      (d) => d.year === year,
                    );
                    return firstPoint ? (
                      <ReferenceLine
                        key={year}
                        x={firstPoint.date}
                        stroke="#cbd5e1"
                        strokeDasharray="4 4"
                        label={{
                          value: `${year}`,
                          position: "insideTopLeft",
                          fill: "#475569",
                          fontSize: 10,
                        }}
                      />
                    ) : null;
                  },
                )}
                <Area
                  type="monotoneX"
                  connectNulls
                  dataKey="net"
                  stroke="#4f46e5"
                  fill="url(#netFill)"
                  strokeWidth={2}
                  name="Net worth"
                />
              </AreaChart>
            </ChartContainer>
          </ChartCard>
        </motion.div>
      </StaggerWrap>

      <StaggerWrap className="grid gap-4 xl:grid-cols-[1fr_1.5fr_1fr]">
        <motion.div variants={fadeInUp}>
          <ChartCard
            title="Category mix"
            description="Income vs expenses"
            loading={yearly.loading}
            action={
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Income
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-rose-500" />
                  Expenses
                </span>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={4}
                >
                  {categoryBreakdown.map((_, index) => (
                    <Cell
                      key={index}
                      fill={index === 0 ? "#10b981" : "#ef4444"}
                      stroke="transparent"
                    />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0];
                    return (
                      <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="font-semibold text-slate-800">
                          {item.name}
                        </p>
                        <p className="text-slate-600">
                          {currency(Number(item.value))}
                        </p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <ChartCard
            title="Savings rate"
            description="Per month"
            loading={monthly.loading}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={savingsRateData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const item = payload[0];
                    return (
                      <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                        <p className="font-semibold text-slate-800">
                          {item.payload.month}
                        </p>
                        <p className="text-slate-600">{item.value}%</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="rate" fill="#0ea5e9" radius={[6, 6, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </motion.div>

        <motion.div variants={fadeInUp} {...subtleHover}>
          <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Quick actions
                </CardTitle>
                <p className="text-xs text-slate-500">Jump into common flows</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Link
                  to={PageRoutes.transactions}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add transaction
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Link
                  to={PageRoutes.imports}
                  className="flex items-center gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Import bank file
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Link
                  to={PageRoutes.accounts}
                  className="flex items-center gap-2"
                >
                  <Wallet className="h-4 w-4" />
                  View accounts
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Link
                  to={PageRoutes.budgets}
                  className="flex items-center gap-2"
                >
                  <Receipt className="h-4 w-4" />
                  Budgets
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Link
                  to={PageRoutes.reports}
                  className="flex items-center gap-2"
                >
                  <FileBarChart className="h-4 w-4" />
                  Reports
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Link to={PageRoutes.goals} className="flex items-center gap-2">
                  <PiggyBank className="h-4 w-4" />
                  Goals
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="w-full justify-start gap-2"
              >
                <Link
                  to={PageRoutes.settings}
                  className="flex items-center gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </StaggerWrap>

      <StaggerWrap className="grid gap-4 md:grid-cols-2">
        <motion.div variants={fadeInUp}>
          <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Cash on hand
              </CardTitle>
              <p className="text-sm text-slate-500">Active accounts combined</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {accountsLoading ? (
                <Skeleton className="h-10 w-40" />
              ) : (
                <div className="text-3xl font-semibold text-slate-900">
                  {currency(cashOnHand)}
                </div>
              )}
              <div className="space-y-3">
                {activeAccounts.map((account) => {
                  const delta = accountDeltas[account.id] ?? 0;
                  const isPositive = delta >= 0;
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        {renderAccountIcon(account.icon, account.name)}
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {account.name}
                          </p>
                          <p
                            className={`text-xs ${isPositive ? "text-emerald-600" : "text-rose-600"}`}
                          >
                            {isPositive ? "+" : "−"}
                            {currency(Math.abs(delta))} this year
                          </p>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {currency(Number(account.balance))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Cash runway
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Based on average burn (non-investment accounts)
                </p>
              </div>
              {runwayMetrics.trend === "up" ? (
                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              ) : runwayMetrics.trend === "down" ? (
                <ArrowDownRight className="h-5 w-5 text-rose-500" />
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              {monthly.loading || accountsLoading ? (
                <Skeleton className="h-10 w-48" />
              ) : runwayMetrics.months === null ? (
                <p className="text-sm text-slate-500">
                  Add expense history to estimate runway.
                </p>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    Runway
                  </div>
                  <div className="text-3xl font-semibold text-slate-900">
                    {`${runwayMetrics.months.toFixed(1)} months`}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-xs text-slate-500">Avg monthly burn</p>
                  <p className="text-base font-semibold text-rose-600">
                    {currency(runwayMetrics.avgBurn)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-xs text-slate-500">Avg monthly income</p>
                  <p className="text-base font-semibold text-emerald-600">
                    {currency(runwayMetrics.avgIncome)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-xs text-slate-500">Last month net</p>
                  <p
                    className={`text-base font-semibold ${
                      runwayMetrics.lastNet >= 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {currency(runwayMetrics.lastNet)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-xs text-slate-500">Previous month net</p>
                  <p
                    className={`text-base font-semibold ${
                      runwayMetrics.prevNet >= 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {currency(runwayMetrics.prevNet)}
                  </p>
                </div>
              </div>
              {runwayMetrics.sparkline.length ? (
                <div className="rounded-lg border border-slate-100 p-3">
                  <ChartContainer
                    className="!aspect-auto h-36 w-full"
                    config={{
                      balance: { label: "Cash trend", color: "#0ea5e9" },
                    }}
                  >
                    <AreaChart
                      data={runwayMetrics.sparkline}
                      margin={{ left: 0, right: 0, top: 6, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="cashSpark"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#0ea5e9"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="95%"
                            stopColor="#0ea5e9"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" hide />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotoneX"
                        dataKey="balance"
                        stroke="#0ea5e9"
                        fill="url(#cashSpark)"
                        strokeWidth={2}
                        name="Cash trend"
                        dot={false}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              ) : (
                <Skeleton className="h-36 w-full" />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </StaggerWrap>

      <motion.div variants={fadeInUp}>
        <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Recent transactions
              </CardTitle>
              <p className="text-xs text-slate-500">
                Latest activity across tracked accounts
              </p>
            </div>
            <Tabs
              value={recentTab}
              onValueChange={(val) => setRecentTab(val as typeof recentTab)}
              className="w-auto"
            >
              <TabsList className="bg-slate-100">
                <TabsTrigger value="all" className="cursor-pointer">
                  All
                </TabsTrigger>
                <TabsTrigger value="income" className="cursor-pointer">
                  Income
                </TabsTrigger>
                <TabsTrigger value="expense" className="cursor-pointer">
                  Expense
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.loading ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, idx) => (
                  <Skeleton key={idx} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredRecentTransactions.length === 0 ? (
              <p className="text-sm text-slate-500">
                No recent transactions yet.
              </p>
            ) : (
              <div className="space-y-2">
                {filteredRecentTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-[0_8px_20px_-18px_rgba(15,23,42,0.4)]"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {tx.description}
                      </p>
                      <p className="text-xs text-slate-500">
                        {new Date(tx.occurred_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {tx.type === TransactionType.TRANSFER ? (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                          {currency(Math.abs(tx.amount))}
                        </span>
                      ) : (
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            tx.amount >= 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {tx.amount >= 0 ? "+" : "-"}
                          {currency(Math.abs(tx.amount))}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                        {tx.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </MotionPage>
  );
};
