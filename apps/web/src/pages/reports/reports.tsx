import { Loader2, Sparkles } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
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
import { useAccountsApi, useReportsApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import type {
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
} from "@/types/api";
import {
  yearlyCategoryDetailSchema,
  yearlyOverviewSchema,
} from "@/types/schemas";

type ReportMode = "year_overview" | "all_years";

type DetailDialogState =
  | {
      kind: "investments";
      title: string;
      asOf: string;
      monthly: Array<{ month: string; value: number }>;
      accounts: Array<{
        name: string;
        start: number;
        end: number;
        change: number;
      }>;
      summary: {
        start: number;
        end: number;
        change: number;
        changePct: number | null;
        contributions: number;
        withdrawals: number;
      };
    }
  | {
      kind: "debt";
      title: string;
      monthly: Array<{ month: string; value: number }>;
      startDebt: number;
      endDebt: number;
      delta: number;
    }
  | {
      kind: "account";
      title: string;
      accountType: string;
      startBalance: number;
      endBalance: number;
      change: number;
      monthly: Array<{
        month: string;
        income: number;
        expense: number;
        transfersIn: number;
        transfersOut: number;
        change: number;
      }>;
    }
  | {
      kind: "source";
      title: string;
      subtitle: string;
      monthly: Array<{ month: string; total: number }>;
      total: number;
      txCount: number;
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

const monthLabel = (dateString: string) =>
  new Date(dateString).toLocaleDateString("sv-SE", { month: "short" });

const monthName = (year: number, month: number) =>
  new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("sv-SE", {
    month: "long",
  });

const percent = (value: number) =>
  `${value.toLocaleString("sv-SE", { maximumFractionDigits: 0 })}%`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const ChartCard: React.FC<{
  title: string;
  description?: string;
  children: React.ReactNode;
  loading?: boolean;
}> = ({ title, description, children, loading }) => (
  <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
    <CardHeader className="pb-2">
      <CardTitle className="text-base font-semibold text-slate-900">
        {title}
      </CardTitle>
      {description ? (
        <p className="text-xs text-slate-500">{description}</p>
      ) : null}
    </CardHeader>
    <CardContent className="h-80">
      {loading ? <Skeleton className="h-full w-full" /> : children}
    </CardContent>
  </Card>
);

export const Reports: React.FC = () => {
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { yearly, fetchYearlyReport } = useReportsApi();
  const token = useAppSelector(selectToken);
  const [mode, setMode] = useState<ReportMode>("year_overview");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [overview, setOverview] = useState<YearlyOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedCategoryFlow, setSelectedCategoryFlow] = useState<
    "expense" | "income"
  >("expense");
  const [categoryDetail, setCategoryDetail] =
    useState<YearlyCategoryDetailResponse | null>(null);
  const [categoryDetailLoading, setCategoryDetailLoading] = useState(false);
  const [detailDialog, setDetailDialog] = useState<DetailDialogState | null>(
    null,
  );
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, idx) => current - idx);
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    const loadOverview = async () => {
      if (!token) return;
      if (mode !== "year_overview") return;
      setOverviewLoading(true);
      try {
        const accountIds = selectedAccounts.length
          ? selectedAccounts.join(",")
          : undefined;
        const { data } = await apiFetch<YearlyOverviewResponse>({
          path: "/reports/yearly-overview",
          schema: yearlyOverviewSchema,
          query: accountIds ? { year, account_ids: accountIds } : { year },
          token,
        });
        setOverview(data);
      } catch (error) {
        console.error(error);
        setOverview(null);
      } finally {
        setOverviewLoading(false);
      }
    };
    void loadOverview();
  }, [mode, selectedAccounts, token, year]);

  useEffect(() => {
    if (mode !== "all_years") return;
    fetchYearlyReport({ accountIds: selectedAccounts });
  }, [fetchYearlyReport, mode, selectedAccounts]);

  useEffect(() => {
    const loadCategoryDetail = async () => {
      if (!token) return;
      if (!selectedCategoryId) return;
      setCategoryDetailLoading(true);
      setCategoryDetail(null);
      try {
        const accountIds = selectedAccounts.length
          ? selectedAccounts.join(",")
          : undefined;
        const query = accountIds
          ? {
              year,
              category_id: selectedCategoryId,
              account_ids: accountIds,
              flow: selectedCategoryFlow,
            }
          : {
              year,
              category_id: selectedCategoryId,
              flow: selectedCategoryFlow,
            };
        const { data } = await apiFetch<YearlyCategoryDetailResponse>({
          path: "/reports/yearly-category-detail",
          schema: yearlyCategoryDetailSchema,
          query,
          token,
        });
        setCategoryDetail(data);
      } catch (error) {
        console.error(error);
        setCategoryDetail(null);
      } finally {
        setCategoryDetailLoading(false);
      }
    };
    void loadCategoryDetail();
  }, [selectedAccounts, selectedCategoryFlow, selectedCategoryId, token, year]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((acc) => acc !== id) : [...prev, id],
    );
  };

  const allYearsChart = useMemo(
    () =>
      yearly.data.map((row) => ({
        year: row.year,
        income: Number(row.income),
        expense: Math.abs(Number(row.expense)),
        net: Number(row.net),
      })),
    [yearly.data],
  );

  const yearOverviewMonthChart = useMemo(
    () =>
      (overview?.monthly || []).map((row) => ({
        month: monthLabel(row.date),
        income: Number(row.income),
        expense: Number(row.expense),
        net: Number(row.net),
      })),
    [overview?.monthly],
  );

  const netWorthChart = useMemo(
    () =>
      (overview?.net_worth || []).map((row) => ({
        date: row.date,
        net: Number(row.net_worth),
        year: new Date(row.date).getFullYear(),
      })),
    [overview?.net_worth],
  );

  const netWorthDomain = useMemo<[number, number]>(() => {
    if (!netWorthChart.length) return [0, 0];
    const values = netWorthChart.map((d) => d.net);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const upperPad = Math.abs(max) * 0.05 || 1;
    const lower = min;
    const upper = max + upperPad;
    return [lower, upper];
  }, [netWorthChart]);

  const netWorthQuarterMarkers = useMemo(() => {
    const quarterStartMonths = new Set([1, 4, 7, 10]);
    return netWorthChart
      .map((point) => {
        const date = new Date(point.date);
        const month = date.getMonth() + 1;
        const quarter = Math.floor((month - 1) / 3) + 1;
        return { date: point.date, month, quarter };
      })
      .filter((point) => quarterStartMonths.has(point.month))
      .map((point) => ({ date: point.date, label: `Q${point.quarter}` }));
  }, [netWorthChart]);

  const debtChart = useMemo(
    () =>
      (overview?.debt || []).map((row) => ({
        month: monthLabel(row.date),
        debt: Number(row.debt),
      })),
    [overview?.debt],
  );

  const categoryChartData = useMemo(() => {
    if (!overview?.category_breakdown) return [];
    return overview.category_breakdown.map((item) => ({
      id: item.category_id ?? null,
      name: item.name,
      total: Number(item.total),
      color: item.color_hex ?? "#ef4444",
      monthly: item.monthly.map((v) => Number(v)),
    }));
  }, [overview?.category_breakdown]);

  const heatmap = useMemo(() => {
    if (!categoryChartData.length) return { rows: [], max: 0 };
    const max = Math.max(
      ...categoryChartData.flatMap((item) => item.monthly),
      0,
    );
    return { rows: categoryChartData, max };
  }, [categoryChartData]);

  const incomeCategoryChartData = useMemo(() => {
    if (!overview?.income_category_breakdown) return [];
    return overview.income_category_breakdown.map((item) => ({
      id: item.category_id ?? null,
      name: item.name,
      total: Number(item.total),
      color: item.color_hex ?? "#10b981",
      monthly: item.monthly.map((v) => Number(v)),
    }));
  }, [overview?.income_category_breakdown]);

  const incomeHeatmap = useMemo(() => {
    if (!incomeCategoryChartData.length) return { rows: [], max: 0 };
    const max = Math.max(
      ...incomeCategoryChartData.flatMap((item) => item.monthly),
      0,
    );
    return { rows: incomeCategoryChartData, max };
  }, [incomeCategoryChartData]);

  const savings = overview?.savings
    ? {
        income: Number(overview.savings.income),
        expense: Number(overview.savings.expense),
        saved: Number(overview.savings.saved),
        rate: overview.savings.savings_rate_pct
          ? Number(overview.savings.savings_rate_pct)
          : null,
      }
    : null;

  const investmentsSummary = useMemo(() => {
    if (!overview?.investments_summary) return null;
    const monthly = overview.investments_summary.monthly_values.map(
      (value, idx) => ({
        month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
        value: Number(value),
      }),
    );
    const accounts = overview.investments_summary.accounts
      .map((row) => ({
        name: row.account_name,
        start: Number(row.start_value),
        end: Number(row.end_value),
        change: Number(row.change),
      }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    return {
      asOf: overview.investments_summary.as_of,
      start: Number(overview.investments_summary.start_value),
      end: Number(overview.investments_summary.end_value),
      change: Number(overview.investments_summary.change),
      changePct: overview.investments_summary.change_pct
        ? Number(overview.investments_summary.change_pct)
        : null,
      contributions: Number(overview.investments_summary.contributions),
      withdrawals: Number(overview.investments_summary.withdrawals),
      monthly,
      accounts,
    };
  }, [overview?.investments_summary, year]);

  const debtOverviewRows = useMemo(() => {
    if (!overview?.debt_overview) return [];
    return overview.debt_overview
      .map((row) => ({
        id: row.account_id,
        name: row.name || "Debt account",
        startDebt: Number(row.start_debt),
        endDebt: Number(row.end_debt),
        delta: Number(row.delta),
        monthly: row.monthly_debt.map((v, idx) => ({
          month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
          value: Number(v),
        })),
      }))
      .sort((a, b) => b.endDebt - a.endDebt);
  }, [overview?.debt_overview, year]);

  const accountFlowRows = useMemo(() => {
    if (!overview?.account_flows) return [];
    return overview.account_flows
      .map((row) => {
        const monthly = Array.from({ length: 12 }, (_, idx) => ({
          month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
          income: Number(row.monthly_income[idx] ?? 0),
          expense: Number(row.monthly_expense[idx] ?? 0),
          transfersIn: Number(row.monthly_transfers_in[idx] ?? 0),
          transfersOut: Number(row.monthly_transfers_out[idx] ?? 0),
          change: Number(row.monthly_change[idx] ?? 0),
        }));
        return {
          id: row.account_id,
          name: row.name || "Account",
          accountType: row.account_type,
          startBalance: Number(row.start_balance),
          endBalance: Number(row.end_balance),
          change: Number(row.change),
          netOperating: Number(row.net_operating),
          netTransfers: Number(row.net_transfers),
          income: Number(row.income),
          expense: Number(row.expense),
          transfersIn: Number(row.transfers_in),
          transfersOut: Number(row.transfers_out),
          monthly,
        };
      })
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [overview?.account_flows, year]);

  const incomeSourceRows = useMemo(() => {
    if (!overview?.income_sources) return [];
    return overview.income_sources
      .map((row) => ({
        source: row.source,
        total: Number(row.total),
        txCount: row.transaction_count,
        monthly: row.monthly.map((v, idx) => ({
          month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
          total: Number(v),
        })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [overview?.income_sources, year]);

  const expenseSourceRows = useMemo(() => {
    if (!overview?.expense_sources) return [];
    return overview.expense_sources
      .map((row) => ({
        source: row.source,
        total: Number(row.total),
        txCount: row.transaction_count,
        monthly: row.monthly.map((v, idx) => ({
          month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
          total: Number(v),
        })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [overview?.expense_sources, year]);

  const openDetailDialog = (state: DetailDialogState) => {
    setDetailDialog(state);
    setDetailDialogOpen(true);
  };

  return (
    <MotionPage className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Reports
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Income, expense, and net
          </h1>
          <p className="text-sm text-slate-500">
            Yearly overview, trends, and high-signal breakdowns.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="w-[110px]">
            {mode === "year_overview" ? (
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {yearOptions.map((optionYear) => (
                  <option key={optionYear} value={optionYear}>
                    {optionYear}
                  </option>
                ))}
              </select>
            ) : (
              <div className="h-9" />
            )}
          </div>
          <Button
            variant={mode === "year_overview" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("year_overview")}
          >
            Year overview
          </Button>
          <Button
            variant={mode === "all_years" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("all_years")}
          >
            All years
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-sm text-slate-700">Filters</CardTitle>
            <p className="text-sm text-slate-500">
              Pick accounts to focus all report sections.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-700 md:justify-end">
            {accounts.map((account) => (
              <button
                key={account.id}
                type="button"
                onClick={() => toggleAccount(account.id)}
                className={
                  selectedAccounts.includes(account.id)
                    ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-700"
                }
              >
                {account.name}
              </button>
            ))}
            {accounts.length === 0 ? (
              <Skeleton className="h-6 w-24 rounded-full" />
            ) : null}
          </div>
        </CardHeader>
        {mode === "year_overview" && overview ? (
          <CardContent className="grid gap-3 md:grid-cols-4">
            {[
              {
                label: "Income",
                value: Number(overview.stats.total_income),
                color: "text-emerald-700",
              },
              {
                label: "Expense",
                value: Number(overview.stats.total_expense),
                color: "text-rose-700",
              },
              {
                label: "Net saved",
                value: Number(overview.stats.net_savings),
                color: "text-slate-900",
              },
              {
                label: "Savings rate",
                value: overview.stats.savings_rate_pct
                  ? Number(overview.stats.savings_rate_pct)
                  : null,
                color: "text-slate-900",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-4"
              >
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  {item.label}
                </p>
                <div className={`text-2xl font-semibold ${item.color}`}>
                  {item.value === null
                    ? "—"
                    : item.label === "Savings rate"
                      ? `${Math.round(item.value)}%`
                      : currency(item.value)}
                </div>
              </div>
            ))}
          </CardContent>
        ) : null}
      </Card>

      {mode === "year_overview" ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title={`Income vs expense (${year})`}
              description="Two bars per month."
              loading={overviewLoading}
            >
              {!overview && !overviewLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-600">
                  <Sparkles className="h-6 w-6 text-slate-500" />
                  <p className="text-center">
                    No data for {year} yet. Import files or add transactions.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild size="sm">
                      <Link to={PageRoutes.imports}>Go to Imports</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to={PageRoutes.transactions}>Add transactions</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearOverviewMonthChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const label = payload[0]?.payload?.month;
                        return (
                          <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                            <p className="font-semibold text-slate-800">
                              {label}
                            </p>
                            {payload.map((item) => (
                              <p
                                key={String(item.dataKey)}
                                className="text-slate-600"
                              >
                                {item.name}: {currency(Number(item.value))}
                              </p>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Bar
                      dataKey="income"
                      name="Income"
                      fill="#10b981"
                      radius={[6, 6, 4, 4]}
                      barSize={12}
                    />
                    <Bar
                      dataKey="expense"
                      name="Expense"
                      fill="#ef4444"
                      radius={[6, 6, 4, 4]}
                      barSize={12}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Net worth growth"
              description={
                selectedAccounts.length
                  ? "Filtered to selected accounts."
                  : "Includes investment snapshots when available."
              }
              loading={overviewLoading}
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
                  data={netWorthChart}
                  margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="netFillReports"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
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
                  {netWorthQuarterMarkers.map((marker) => (
                    <ReferenceLine
                      key={marker.label}
                      x={marker.date}
                      stroke="#cbd5e1"
                      strokeDasharray="4 4"
                      label={{
                        value: marker.label,
                        position: "insideTopLeft",
                        fill: "#475569",
                        fontSize: 10,
                      }}
                    />
                  ))}
                  <Area
                    type="monotoneX"
                    connectNulls
                    dataKey="net"
                    stroke="#4f46e5"
                    fill="url(#netFillReports)"
                    strokeWidth={2}
                    name="Net worth"
                  />
                </AreaChart>
              </ChartContainer>
            </ChartCard>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <ChartCard
              title="Debt"
              description="Total debt over the year."
              loading={overviewLoading}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={debtChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <YAxis hide />
                  <Tooltip
                    formatter={(value) => currency(Number(value))}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="debt"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Saving rate
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Income, expense, and what you kept.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!savings ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Savings rate
                        </p>
                        <p className="text-3xl font-semibold text-slate-900">
                          {savings.rate === null
                            ? "—"
                            : `${Math.round(savings.rate)}%`}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>{currency(savings.saved)} saved</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Income</span>
                          <span className="font-semibold text-emerald-700">
                            {currency(savings.income)}
                          </span>
                        </div>
                        <Progress value={100} className="h-2" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Expense</span>
                          <span className="font-semibold text-rose-700">
                            {currency(savings.expense)}
                          </span>
                        </div>
                        <Progress
                          value={
                            savings.income > 0
                              ? Math.min(
                                  100,
                                  (savings.expense / savings.income) * 100,
                                )
                              : 0
                          }
                          className="h-2"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Saved</span>
                          <span className="font-semibold text-slate-900">
                            {currency(savings.saved)}
                          </span>
                        </div>
                        <Progress
                          value={
                            savings.income > 0
                              ? Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (savings.saved / savings.income) * 100,
                                  ),
                                )
                              : 0
                          }
                          className="h-2"
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Summary
                </CardTitle>
                <p className="text-xs text-slate-500">
                  High-signal totals and highlights.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!overview ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total income</span>
                      <span className="font-semibold text-emerald-700">
                        {currency(Number(overview.stats.total_income))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total expenses</span>
                      <span className="font-semibold text-rose-700">
                        {currency(Number(overview.stats.total_expense))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Net savings</span>
                      <span className="font-semibold text-slate-900">
                        {currency(Number(overview.stats.net_savings))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Savings rate</span>
                      <span className="font-semibold text-slate-900">
                        {overview.stats.savings_rate_pct
                          ? `${Math.round(Number(overview.stats.savings_rate_pct))}%`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Avg monthly spend</span>
                      <span className="font-semibold text-slate-900">
                        {currency(Number(overview.stats.avg_monthly_spend))}
                      </span>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                      <p className="font-semibold">Biggest months</p>
                      <p>
                        Income:{" "}
                        {monthName(
                          year,
                          overview.stats.biggest_income_month.month,
                        )}{" "}
                        (
                        {currency(
                          Number(overview.stats.biggest_income_month.amount),
                        )}
                        )
                      </p>
                      <p>
                        Expense:{" "}
                        {monthName(
                          year,
                          overview.stats.biggest_expense_month.month,
                        )}{" "}
                        (
                        {currency(
                          Number(overview.stats.biggest_expense_month.amount),
                        )}
                        )
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Investments summary
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Snapshot-based (not a spending category).
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!overview || !investmentsSummary}
                  onClick={() => {
                    if (!investmentsSummary) return;
                    openDetailDialog({
                      kind: "investments",
                      title: `Investments (${year})`,
                      asOf: investmentsSummary.asOf,
                      monthly: investmentsSummary.monthly,
                      accounts: investmentsSummary.accounts.map((row) => ({
                        name: row.name,
                        start: row.start,
                        end: row.end,
                        change: row.change,
                      })),
                      summary: {
                        start: investmentsSummary.start,
                        end: investmentsSummary.end,
                        change: investmentsSummary.change,
                        changePct: investmentsSummary.changePct,
                        contributions: investmentsSummary.contributions,
                        withdrawals: investmentsSummary.withdrawals,
                      },
                    });
                  }}
                >
                  Details
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {!overview || !investmentsSummary ? (
                  <Skeleton className="h-56 w-full" />
                ) : selectedAccounts.length ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    Clear the account filter to include investment snapshots.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          As of
                        </p>
                        <p className="font-semibold text-slate-900">
                          {new Date(investmentsSummary.asOf).toLocaleDateString(
                            "sv-SE",
                          )}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Value
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(investmentsSummary.end)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {investmentsSummary.change >= 0 ? "+" : "−"}
                          {currency(Math.abs(investmentsSummary.change))}{" "}
                          {investmentsSummary.changePct !== null
                            ? `(${percent(investmentsSummary.changePct)})`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Contributions
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(investmentsSummary.contributions)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Withdrawals
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(investmentsSummary.withdrawals)}
                        </p>
                      </div>
                    </div>

                    <div className="h-44 rounded-md border border-slate-100 bg-white p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={investmentsSummary.monthly}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            formatter={(value) => currency(Number(value))}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#4f46e5"
                            fill="rgba(79,70,229,0.15)"
                            strokeWidth={2}
                            name="Portfolio"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="rounded-md border border-slate-100">
                      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                        Accounts
                      </div>
                      <div className="max-h-44 overflow-auto">
                        {investmentsSummary.accounts.length ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Account</TableHead>
                                <TableHead className="text-right">
                                  End
                                </TableHead>
                                <TableHead className="text-right">
                                  Change
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {investmentsSummary.accounts.map((row) => (
                                <TableRow
                                  key={row.name}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    openDetailDialog({
                                      kind: "investments",
                                      title: `${row.name} (${year})`,
                                      asOf: investmentsSummary.asOf,
                                      monthly: investmentsSummary.monthly,
                                      accounts: [
                                        {
                                          name: row.name,
                                          start: row.start,
                                          end: row.end,
                                          change: row.change,
                                        },
                                      ],
                                      summary: {
                                        start: row.start,
                                        end: row.end,
                                        change: row.change,
                                        changePct:
                                          row.start > 0
                                            ? (row.change / row.start) * 100
                                            : null,
                                        contributions: 0,
                                        withdrawals: 0,
                                      },
                                    });
                                  }}
                                >
                                  <TableCell className="font-medium">
                                    {row.name}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {currency(row.end)}
                                  </TableCell>
                                  <TableCell className="text-right text-xs">
                                    <span
                                      className={
                                        row.change >= 0
                                          ? "text-emerald-700"
                                          : "text-rose-700"
                                      }
                                    >
                                      {row.change >= 0 ? "+" : "−"}
                                      {currency(Math.abs(row.change))}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="p-3 text-sm text-slate-500">
                            No investment accounts captured yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Debt overview
                </CardTitle>
                <p className="text-xs text-slate-500">
                  End balance and change this year.
                </p>
              </CardHeader>
              <CardContent className="max-h-[32rem] overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : debtOverviewRows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">End</TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          Δ
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debtOverviewRows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() => {
                            openDetailDialog({
                              kind: "debt",
                              title: `${row.name} (${year})`,
                              monthly: row.monthly,
                              startDebt: row.startDebt,
                              endDebt: row.endDebt,
                              delta: row.delta,
                            });
                          }}
                        >
                          <TableCell className="max-w-[180px] truncate font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(row.endDebt)}
                          </TableCell>
                          <TableCell className="hidden text-right text-xs md:table-cell">
                            <span
                              className={
                                row.delta <= 0
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                              }
                            >
                              {row.delta >= 0 ? "+" : "−"}
                              {currency(Math.abs(row.delta))}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No debt accounts found for this selection.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Account flows
              </CardTitle>
              <p className="text-xs text-slate-500">
                Net operating (income − expense) vs net transfers. Click a row
                for monthly detail.
              </p>
            </CardHeader>
            <CardContent className="max-h-[32rem] overflow-auto">
              {!overview ? (
                <Skeleton className="h-56 w-full" />
              ) : accountFlowRows.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        Net operating
                      </TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        Net transfers
                      </TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountFlowRows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => {
                          openDetailDialog({
                            kind: "account",
                            title: `${row.name} (${year})`,
                            accountType: row.accountType,
                            startBalance: row.startBalance,
                            endBalance: row.endBalance,
                            change: row.change,
                            monthly: row.monthly,
                          });
                        }}
                      >
                        <TableCell className="max-w-[220px] truncate font-medium">
                          {row.name}
                          <span className="ml-2 text-xs text-slate-500">
                            ({row.accountType})
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          {currency(row.netOperating)}
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          {currency(row.netTransfers)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <span
                            className={
                              row.change >= 0
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }
                          >
                            {row.change >= 0 ? "+" : "−"}
                            {currency(Math.abs(row.change))}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  No account flows available.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Income sources
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Grouped by description. Click for seasonality.
                </p>
              </CardHeader>
              <CardContent className="max-h-[26rem] overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : incomeSourceRows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          Tx
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeSourceRows.slice(0, 14).map((row) => (
                        <TableRow
                          key={row.source}
                          className="cursor-pointer"
                          onClick={() => {
                            openDetailDialog({
                              kind: "source",
                              title: row.source,
                              subtitle: `Income • ${year}`,
                              monthly: row.monthly,
                              total: row.total,
                              txCount: row.txCount,
                            });
                          }}
                        >
                          <TableCell className="max-w-[220px] truncate font-medium">
                            {row.source}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(row.total)}
                          </TableCell>
                          <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                            {row.txCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No income sources yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Expense sources
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Grouped by description. Click for seasonality.
                </p>
              </CardHeader>
              <CardContent className="max-h-[26rem] overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : expenseSourceRows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          Tx
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenseSourceRows.slice(0, 14).map((row) => (
                        <TableRow
                          key={row.source}
                          className="cursor-pointer"
                          onClick={() => {
                            openDetailDialog({
                              kind: "source",
                              title: row.source,
                              subtitle: `Expense • ${year}`,
                              monthly: row.monthly,
                              total: row.total,
                              txCount: row.txCount,
                            });
                          }}
                        >
                          <TableCell className="max-w-[220px] truncate font-medium">
                            {row.source}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(row.total)}
                          </TableCell>
                          <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                            {row.txCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No expense sources yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title="Category breakdown (expenses)"
              description="Top categories + Other. Click to drill down."
              loading={overviewLoading}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryChartData.map((row) => ({
                    ...row,
                    total: row.total,
                  }))}
                  layout="vertical"
                  margin={{ left: 16, right: 12, top: 8, bottom: 8 }}
                  onClick={(
                    state: {
                      activePayload?: Array<{ payload?: { id?: unknown } }>;
                    } | null,
                  ) => {
                    const id = state?.activePayload?.[0]?.payload?.id;
                    if (typeof id === "string" && id.length) {
                      setSelectedCategoryFlow("expense");
                      setSelectedCategoryId(id);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={120}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0]?.payload;
                      if (!isRecord(item)) return null;
                      const name =
                        typeof item.name === "string" ? item.name : "Category";
                      const total = Number(item.total ?? 0);
                      return (
                        <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-semibold text-slate-800">{name}</p>
                          <p className="text-slate-600">{currency(total)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 6, 6]}>
                    {categoryChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Spending heatmap
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Seasonality by category and month.
                </p>
              </CardHeader>
              <CardContent className="overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <div className="min-w-[560px]">
                    <div className="grid grid-cols-[160px_repeat(12,minmax(28px,1fr))] gap-1 text-[11px] text-slate-600">
                      <div />
                      {Array.from({ length: 12 }, (_, idx) => (
                        <div key={idx} className="text-center">
                          {monthLabel(
                            new Date(Date.UTC(year, idx, 1)).toISOString(),
                          )}
                        </div>
                      ))}
                      {heatmap.rows.map((row) => (
                        <React.Fragment key={row.name}>
                          <div className="truncate pr-2 text-slate-700">
                            {row.name}
                          </div>
                          {row.monthly.map((value, idx) => {
                            const intensity =
                              heatmap.max > 0 ? value / heatmap.max : 0;
                            const bg = `rgba(239, 68, 68, ${Math.min(0.08 + intensity * 0.6, 0.7)})`;
                            return (
                              <div
                                key={idx}
                                title={`${row.name} — ${monthName(year, idx + 1)}: ${currency(value)}`}
                                className="h-7 rounded-sm border border-slate-100"
                                style={{
                                  backgroundColor: value > 0 ? bg : undefined,
                                }}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title="Category breakdown (income)"
              description="Top categories + Other. Click to drill down."
              loading={overviewLoading}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={incomeCategoryChartData.map((row) => ({
                    ...row,
                    total: row.total,
                  }))}
                  layout="vertical"
                  margin={{ left: 16, right: 12, top: 8, bottom: 8 }}
                  onClick={(
                    state: {
                      activePayload?: Array<{ payload?: { id?: unknown } }>;
                    } | null,
                  ) => {
                    const id = state?.activePayload?.[0]?.payload?.id;
                    if (typeof id === "string" && id.length) {
                      setSelectedCategoryFlow("income");
                      setSelectedCategoryId(id);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={120}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0]?.payload;
                      if (!isRecord(item)) return null;
                      const name =
                        typeof item.name === "string" ? item.name : "Category";
                      const total = Number(item.total ?? 0);
                      return (
                        <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-semibold text-slate-800">{name}</p>
                          <p className="text-slate-600">{currency(total)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 6, 6]}>
                    {incomeCategoryChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Income heatmap
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Seasonality by category and month.
                </p>
              </CardHeader>
              <CardContent className="overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <div className="min-w-[560px]">
                    <div className="grid grid-cols-[160px_repeat(12,minmax(28px,1fr))] gap-1 text-[11px] text-slate-600">
                      <div />
                      {Array.from({ length: 12 }, (_, idx) => (
                        <div key={idx} className="text-center">
                          {monthLabel(
                            new Date(Date.UTC(year, idx, 1)).toISOString(),
                          )}
                        </div>
                      ))}
                      {incomeHeatmap.rows.map((row) => (
                        <React.Fragment key={row.name}>
                          <div className="truncate pr-2 text-slate-700">
                            {row.name}
                          </div>
                          {row.monthly.map((value, idx) => {
                            const intensity =
                              incomeHeatmap.max > 0
                                ? value / incomeHeatmap.max
                                : 0;
                            const bg = `rgba(16, 185, 129, ${Math.min(0.08 + intensity * 0.6, 0.7)})`;
                            return (
                              <div
                                key={idx}
                                title={`${row.name} — ${monthName(year, idx + 1)}: ${currency(value)}`}
                                className="h-7 rounded-sm border border-slate-100"
                                style={{
                                  backgroundColor: value > 0 ? bg : undefined,
                                }}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Top merchants
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Amount spent per merchant.
                </p>
              </CardHeader>
              <CardContent className="max-h-[22rem] overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Merchant</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.top_merchants.slice(0, 8).map((row) => (
                        <TableRow key={row.merchant}>
                          <TableCell className="max-w-[160px] truncate font-medium">
                            {row.merchant}
                          </TableCell>
                          <TableCell className="text-right">
                            {currency(Number(row.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Largest transactions
                </CardTitle>
                <p className="text-xs text-slate-500">
                  High-impact items with category and note.
                </p>
              </CardHeader>
              <CardContent className="max-h-[22rem] overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.largest_transactions.slice(0, 8).map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="max-w-[160px] truncate font-medium">
                            {row.merchant}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate text-xs text-slate-600">
                            {row.category_name}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(Number(row.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Insights
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Auto-generated, small and actionable.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                {!overview ? (
                  <Skeleton className="h-40 w-full" />
                ) : overview.insights.length ? (
                  overview.insights.map((text, idx) => (
                    <div
                      key={idx}
                      className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs"
                    >
                      {text}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No insights yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Category changes
              </CardTitle>
              <p className="text-xs text-slate-500">
                Ranked by increased spend vs last year.
              </p>
            </CardHeader>
            <CardContent className="max-h-80 overflow-auto">
              {!overview ? (
                <Skeleton className="h-56 w-full" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                      <TableHead className="text-right">This year</TableHead>
                      <TableHead className="text-right">YoY</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.category_changes.map((row) => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {currency(Number(row.delta))}
                        </TableCell>
                        <TableCell className="text-right">
                          {currency(Number(row.amount))}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-600">
                          {row.delta_pct
                            ? `${Math.round(Number(row.delta_pct))}%`
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Dialog
            open={detailDialogOpen}
            onOpenChange={(open) => {
              setDetailDialogOpen(open);
              if (!open) setDetailDialog(null);
            }}
          >
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{detailDialog?.title ?? "Details"}</DialogTitle>
              </DialogHeader>
              {!detailDialog ? null : detailDialog.kind === "investments" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          As of
                        </p>
                        <p className="font-semibold text-slate-900">
                          {new Date(detailDialog.asOf).toLocaleDateString(
                            "sv-SE",
                          )}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Value
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(detailDialog.summary.end)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {detailDialog.summary.change >= 0 ? "+" : "−"}
                          {currency(Math.abs(detailDialog.summary.change))}{" "}
                          {detailDialog.summary.changePct !== null
                            ? `(${percent(detailDialog.summary.changePct)})`
                            : ""}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Contributions
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(detailDialog.summary.contributions)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Withdrawals
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(detailDialog.summary.withdrawals)}
                        </p>
                      </div>
                    </div>
                    <div className="h-60 rounded-md border border-slate-100 bg-white p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={detailDialog.monthly}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            formatter={(value) => currency(Number(value))}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#4f46e5"
                            fill="rgba(79,70,229,0.15)"
                            strokeWidth={2}
                            name="Portfolio"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-semibold">What this means</p>
                      <p className="text-xs text-slate-600">
                        Investments are tracked via snapshots, so they should
                        not appear as an expense category.
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100">
                      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                        Accounts
                      </div>
                      <div className="max-h-[22rem] overflow-auto">
                        {detailDialog.accounts.length ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Account</TableHead>
                                <TableHead className="text-right">
                                  Start
                                </TableHead>
                                <TableHead className="text-right">
                                  End
                                </TableHead>
                                <TableHead className="text-right">
                                  Change
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detailDialog.accounts.map((row) => (
                                <TableRow key={row.name}>
                                  <TableCell className="max-w-[200px] truncate font-medium">
                                    {row.name}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {currency(row.start)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {currency(row.end)}
                                  </TableCell>
                                  <TableCell className="text-right text-xs">
                                    <span
                                      className={
                                        row.change >= 0
                                          ? "text-emerald-700"
                                          : "text-rose-700"
                                      }
                                    >
                                      {row.change >= 0 ? "+" : "−"}
                                      {currency(Math.abs(row.change))}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="p-3 text-sm text-slate-500">
                            No investment accounts available.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : detailDialog.kind === "debt" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Start
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(detailDialog.startDebt)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          End
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(detailDialog.endDebt)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3 sm:col-span-2">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Change
                        </p>
                        <p className="font-semibold text-slate-900">
                          {detailDialog.delta >= 0 ? "+" : "−"}
                          {currency(Math.abs(detailDialog.delta))}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                      A negative change means you paid down debt during the
                      year.
                    </div>
                  </div>
                  <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={detailDialog.monthly}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          name="Debt"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : detailDialog.kind === "account" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      { label: "Start", value: detailDialog.startBalance },
                      { label: "End", value: detailDialog.endBalance },
                      { label: "Change", value: detailDialog.change },
                      {
                        label: "Type",
                        value: detailDialog.accountType,
                        text: true,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-md border border-slate-100 bg-slate-50 p-3"
                      >
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          {item.label}
                        </p>
                        <p className="font-semibold text-slate-900">
                          {"text" in item && item.text
                            ? String(item.value)
                            : currency(Number(item.value))}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={detailDialog.monthly.map((m) => ({
                            ...m,
                            expenseNeg: -m.expense,
                            transfersOutNeg: -m.transfersOut,
                          }))}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            formatter={(value) => currency(Number(value))}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Bar
                            dataKey="income"
                            name="Income"
                            fill="#10b981"
                            radius={[4, 4, 4, 4]}
                          />
                          <Bar
                            dataKey="expenseNeg"
                            name="Expense"
                            fill="#ef4444"
                            radius={[4, 4, 4, 4]}
                          />
                          <Bar
                            dataKey="transfersIn"
                            name="Transfers in"
                            fill="#0ea5e9"
                            radius={[4, 4, 4, 4]}
                          />
                          <Bar
                            dataKey="transfersOutNeg"
                            name="Transfers out"
                            fill="#a855f7"
                            radius={[4, 4, 4, 4]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={detailDialog.monthly}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            formatter={(value) => currency(Number(value))}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="change"
                            name="Monthly change"
                            stroke="#334155"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        {detailDialog.subtitle}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {currency(detailDialog.total)}
                      </p>
                      <p className="text-xs text-slate-600">
                        {detailDialog.txCount} transactions
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                      This is grouped by transaction description (good for
                      spotting recurring sources and merchants).
                    </div>
                  </div>
                  <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={detailDialog.monthly}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar
                          dataKey="total"
                          name="Total"
                          fill="#334155"
                          radius={[6, 6, 4, 4]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog
            open={Boolean(selectedCategoryId)}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedCategoryId(null);
                setSelectedCategoryFlow("expense");
                setCategoryDetail(null);
              }
            }}
          >
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {categoryDetail?.category_name || "Category"}
                </DialogTitle>
              </DialogHeader>
              {categoryDetailLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : categoryDetail ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={categoryDetail.monthly.map((m) => ({
                          month: monthLabel(m.date),
                          amount: Number(m.amount),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis hide />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar
                          dataKey="amount"
                          fill={
                            selectedCategoryFlow === "income"
                              ? "#10b981"
                              : "#ef4444"
                          }
                          radius={[6, 6, 6, 6]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <p className="mb-2 text-xs font-semibold text-slate-700 uppercase">
                      Top merchants
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Merchant</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Tx</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryDetail.top_merchants.map((row) => (
                          <TableRow key={row.merchant}>
                            <TableCell className="max-w-[180px] truncate font-medium">
                              {row.merchant}
                            </TableCell>
                            <TableCell className="text-right">
                              {currency(Number(row.amount))}
                            </TableCell>
                            <TableCell className="text-right text-xs text-slate-600">
                              {row.transaction_count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No details available.</p>
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base text-slate-800">
                All years
              </CardTitle>
              <p className="text-sm text-slate-500">
                Trend across years (stacked income vs expense).
              </p>
            </div>
            {yearly.loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            ) : null}
          </CardHeader>
          <CardContent className="h-[360px]">
            {yearly.loading && !allYearsChart.length ? (
              <Skeleton className="h-full w-full" />
            ) : !allYearsChart.length ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-600">
                <Sparkles className="h-6 w-6 text-slate-500" />
                <p className="text-center">No report data yet.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button asChild size="sm">
                    <Link to={PageRoutes.imports}>Go to Imports</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={PageRoutes.transactions}>Add transactions</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={allYearsChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const label = payload[0]?.payload?.year;
                      return (
                        <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-semibold text-slate-800">
                            {label}
                          </p>
                          {payload.map((item) => (
                            <p
                              key={String(item.dataKey)}
                              className="text-slate-600"
                            >
                              {item.name}: {currency(Number(item.value))}
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="income"
                    name="Income"
                    fill="#10b981"
                    radius={[6, 6, 4, 4]}
                  />
                  <Bar
                    dataKey="expense"
                    name="Expense"
                    fill="#ef4444"
                    radius={[6, 6, 4, 4]}
                  />
                  <Line
                    type="monotone"
                    dataKey="net"
                    name="Net"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    dot={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      )}
    </MotionPage>
  );
};

export default Reports;
