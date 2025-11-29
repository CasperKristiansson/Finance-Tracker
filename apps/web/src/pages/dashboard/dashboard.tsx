import {
  ArrowDownRight,
  ArrowUpRight,
  PiggyBank,
  Plus,
  Upload,
} from "lucide-react";
import React, { useEffect, useMemo, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { useAppSelector } from "@/app/hooks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { selectIsAuthenticated } from "@/features/auth/authSlice";
import {
  useBudgetsApi,
  useCategoriesApi,
  useReportsApi,
  useTransactionsApi,
} from "@/hooks/use-api";

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
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const formatDelta = (value: number) => {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${currency(Math.abs(value))}`;
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
    <CardContent className="h-72">
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
    items: budgets,
    loading: budgetsLoading,
    fetchBudgets,
    totals: budgetTotals,
    budgetsByUsage,
  } = useBudgetsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || hasFetched.current) return;

    hasFetched.current = true;
    const year = new Date().getFullYear();
    fetchMonthlyReport({ year });
    fetchYearlyReport();
    fetchTotalReport();
    fetchNetWorthReport();
    fetchRecentTransactions({ limit: 5 });
    fetchBudgets();
    fetchCategories();
  }, [
    fetchMonthlyReport,
    fetchYearlyReport,
    fetchTotalReport,
    fetchNetWorthReport,
    fetchRecentTransactions,
    fetchBudgets,
    fetchCategories,
    isAuthenticated,
  ]);

  const kpis: KPI[] = useMemo(() => {
    const net = numberFromString(total.data?.net);
    const income = numberFromString(total.data?.income);
    const expense = numberFromString(total.data?.expense);
    const savingsRate =
      income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
    const budgetPercent =
      budgetTotals.budgetTotal > 0
        ? Math.round((budgetTotals.spentTotal / budgetTotals.budgetTotal) * 100)
        : 0;

    return [
      {
        title: "Net worth",
        value: currency(net),
        trend: net >= 0 ? "up" : "down",
        helper: "As of now",
      },
      {
        title: "Cash flow (YTD)",
        value: currency(income - expense),
        delta: formatDelta(income - expense),
        trend: income - expense >= 0 ? "up" : "down",
      },
      {
        title: "Savings rate",
        value: `${savingsRate}%`,
        helper: "Income retained",
        trend: savingsRate >= 0 ? "up" : "down",
      },
      {
        title: "Budget usage",
        value: `${budgetPercent}%`,
        helper: `${currency(budgetTotals.spentTotal)} / ${currency(budgetTotals.budgetTotal || 0)}`,
        trend: budgetPercent > 100 ? "down" : "neutral",
      },
    ];
  }, [total.data, budgetTotals]);

  const incomeExpenseChart = useMemo(() => {
    return (monthly.data || []).map((entry) => ({
      month: new Date(entry.period).toLocaleString("en-US", { month: "short" }),
      income: Number(entry.income),
      expense: Number(entry.expense) * -1,
    }));
  }, [monthly.data]);

  const categoryBreakdown = useMemo(() => {
    const yearlyTotals = yearly.data || [];
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
    const data = monthly.data || [];
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
  }, [monthly.data]);

  const netWorthData = useMemo(() => {
    const points = netWorth.data || [];
    if (points.length === 0) {
      return [
        { date: "2024-01-01", net: 12000 },
        { date: "2024-02-01", net: 13200 },
        { date: "2024-03-01", net: 14100 },
        { date: "2024-04-01", net: 15050 },
      ];
    }
    return points.map((point) => ({
      date: point.period,
      net: Number(point.net_worth),
    }));
  }, [netWorth.data]);

  const budgetProgressData = useMemo(() => {
    if (!budgets.length) return [];
    return (budgetsByUsage.length ? budgetsByUsage : budgets)
      .map((b) => {
        const cat = categories.find((c) => c.id === b.category_id);
        const category = cat?.name ?? "Uncategorized";
        const icon = cat?.icon ?? "🏷️";
        const color = cat?.color_hex ?? "#0f172a";
        const percent = Math.min(150, Math.max(0, Number(b.percent_used || 0)));
        return {
          id: b.id,
          label: `${icon ? `${icon} ` : ""}${category}`,
          percent,
          remaining: Number(b.remaining),
          spent: Number(b.spent),
          total: Number(b.amount),
          color,
        };
      })
      .slice(0, 5);
  }, [budgets, budgetsByUsage, categories]);

  const recentTransactions = useMemo(() => {
    if (recent.items.length === 0) {
      return [
        {
          id: "placeholder-1",
          description: "Demo transaction",
          amount: 120.5,
          occurred_at: "2024-01-10",
          account_id: "",
          category: "Groceries",
          status: "imported",
        },
      ];
    }
    return recent.items.map((tx) => ({
      id: tx.id,
      description: tx.description || "Transaction",
      amount: tx.legs?.reduce((sum, leg) => sum + Number(leg.amount), 0) ?? 0,
      occurred_at: tx.occurred_at,
      account_id: tx.legs[0]?.account_id || "",
      category: tx.category_id || "—",
      status: "reviewed",
    }));
  }, [recent.items]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Overview
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Your money at a glance
          </h1>
          <p className="text-sm text-slate-500">
            Live net worth, cash flow, and savings snapshot.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card
            key={kpi.title}
            className="border-slate-200 bg-white shadow-[0_10px_30px_-24px_rgba(30,64,175,0.6)]"
          >
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
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <ChartCard
          title="Income vs Expense"
          description="Stacked by month"
          loading={monthly.loading}
        >
          <ChartContainer
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

        <ChartCard
          title="Net Worth"
          description="Trajectory over time"
          loading={netWorth.loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={netWorthData}>
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
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="net"
                stroke="#4f46e5"
                fill="url(#netFill)"
                strokeWidth={2}
                name="Net worth"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr_1fr]">
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

        <ChartCard
          title="Budgets vs actual"
          description="Top categories by utilization"
          loading={budgetsLoading}
          action={<Badge variant="outline">{budgets.length} tracked</Badge>}
        >
          <div className="space-y-3">
            {budgetProgressData.length === 0 ? (
              <p className="text-sm text-slate-500">
                No budgets yet. Add one to start tracking progress.
              </p>
            ) : (
              budgetProgressData.map((row) => (
                <div key={row.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-slate-800">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: row.color }}
                      />
                      {row.label}
                    </span>
                    <span className="text-slate-600">{row.percent}%</span>
                  </div>
                  <Progress
                    value={row.percent}
                    className="h-2"
                    indicatorStyle={{ backgroundColor: row.color }}
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Spent {currency(row.spent)}</span>
                    <span>Remaining {currency(row.remaining)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </ChartCard>

        <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.25)]">
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
              variant="outline"
              className="w-full justify-start gap-2"
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
              className="w-full justify-start gap-2"
              onClick={() =>
                toast.info("Import file", {
                  description: "Upload flow coming soon.",
                })
              }
            >
              <Upload className="h-4 w-4" />
              Import bank file
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-slate-700"
              onClick={() =>
                toast.info("Goals", {
                  description: "Goals experience coming soon.",
                })
              }
            >
              <PiggyBank className="h-4 w-4" />
              Start a goal (coming soon)
            </Button>
          </CardContent>
        </Card>
      </div>

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
          <Tabs defaultValue="all" className="w-auto">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="income">Income</TabsTrigger>
              <TabsTrigger value="expense">Expense</TabsTrigger>
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
          ) : (
            <div className="space-y-2">
              {recentTransactions.map((tx) => (
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
    </div>
  );
};
