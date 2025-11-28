import { Loader2, Sparkles } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageRoutes } from "@/data/routes";
import { useAppSelector } from "@/app/hooks";
import { selectToken } from "@/features/auth/authSlice";
import { apiFetch } from "@/lib/apiClient";
import { useAccountsApi, useReportsApi } from "@/hooks/use-api";
import type { QuarterlyReportEntry, SubscriptionSummaryResponse } from "@/types/api";

type Granularity = "monthly" | "quarterly" | "yearly";

type ChartPoint = {
  label: string | number;
  income: number;
  expense: number;
  net: number;
};

const currency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

export const Reports: React.FC = () => {
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const {
    monthly,
    quarterly,
    yearly,
    fetchMonthlyReport,
    fetchQuarterlyReport,
    fetchYearlyReport,
  } = useReportsApi();
  const token = useAppSelector(selectToken);
  const [subscriptionIds, setSubscriptionIds] = useState<string[]>([]);
  const [subscriptionSummaries, setSubscriptionSummaries] = useState<
    SubscriptionSummaryResponse["subscriptions"]
  >([]);
  const [subsLoading, setSubsLoading] = useState(false);

  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!token) return;
      setSubsLoading(true);
      try {
        const { data } = await apiFetch<SubscriptionSummaryResponse>({
          path: "/subscriptions/summary",
          token,
        });
        setSubscriptionSummaries(data.subscriptions || []);
      } catch (error) {
        console.error(error);
      } finally {
        setSubsLoading(false);
      }
    };
    void loadSubscriptions();
  }, [token]);

  useEffect(() => {
    const filters = {
      year: new Date().getFullYear(),
      accountIds: selectedAccounts,
      subscriptionIds,
    };
    if (granularity === "monthly") {
      fetchMonthlyReport(filters);
    } else if (granularity === "quarterly") {
      fetchQuarterlyReport(filters);
    } else {
      fetchYearlyReport(filters);
    }
  }, [
    fetchMonthlyReport,
    fetchQuarterlyReport,
    fetchYearlyReport,
    granularity,
    selectedAccounts,
    subscriptionIds,
  ]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((acc) => acc !== id) : [...prev, id],
    );
  };

  const toggleSubscription = (id: string) => {
    setSubscriptionIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id],
    );
  };

  const topSubscriptions = useMemo(() => {
    const sorted = [...subscriptionSummaries].sort(
      (a, b) =>
        Number(b.trailing_three_month_spend ?? 0) -
        Number(a.trailing_three_month_spend ?? 0),
    );
    return sorted.slice(0, 3);
  }, [subscriptionSummaries]);

  const activeReport =
    granularity === "monthly"
      ? monthly
      : granularity === "quarterly"
        ? quarterly
        : yearly;

  const chartData: ChartPoint[] = useMemo(() => {
    if (granularity === "monthly") {
      return (monthly.data || []).map((row) => ({
        label: new Date(row.period).toLocaleString("en-US", { month: "short" }),
        income: Number(row.income),
        expense: Math.abs(Number(row.expense)),
        net: Number(row.net),
      }));
    }
    if (granularity === "quarterly") {
      return (
        (quarterly.data as QuarterlyReportEntry[] | undefined)?.map((row) => ({
          label: `Q${row.quarter} ${row.year}`,
          income: Number(row.income),
          expense: Math.abs(Number(row.expense)),
          net: Number(row.net),
        })) ?? []
      );
    }
    return (yearly.data || []).map((row) => ({
      label: row.year,
      income: Number(row.income),
      expense: Math.abs(Number(row.expense)),
      net: Number(row.net),
    }));
  }, [granularity, monthly.data, quarterly.data, yearly.data]);

  const totals = useMemo(() => {
    if (!chartData.length) return { income: 0, expense: 0, net: 0 };
    return chartData.reduce(
      (acc, row) => ({
        income: acc.income + row.income,
        expense: acc.expense + row.expense,
        net: acc.net + row.net,
      }),
      { income: 0, expense: 0, net: 0 },
    );
  }, [chartData]);

  const loading = activeReport.loading;
  const empty = !loading && chartData.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Reports
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Income, expense, and net
          </h1>
          <p className="text-sm text-slate-500">
            Switch period views and filter by account. Data syncs from reporting
            APIs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {["monthly", "quarterly", "yearly"].map((option) => (
            <Button
              key={option}
              variant={granularity === option ? "default" : "outline"}
              size="sm"
              onClick={() => setGranularity(option as Granularity)}
            >
              {option === "monthly"
                ? "Monthly"
                : option === "quarterly"
                  ? "Quarterly"
                  : "Yearly"}
            </Button>
          ))}
        </div>
      </div>

      <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-sm text-slate-700">Filters</CardTitle>
            <p className="text-sm text-slate-500">
              Pick accounts or subscriptions to focus the chart.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-700">
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
                {account.account_type} · {account.id.slice(0, 4)}
              </button>
            ))}
            {accounts.length === 0 ? (
              <Skeleton className="h-6 w-24 rounded-full" />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-700">
            {subsLoading && subscriptionSummaries.length === 0 ? (
              <Skeleton className="h-6 w-28 rounded-full" />
            ) : null}
            {subscriptionSummaries.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => toggleSubscription(sub.id)}
                className={
                  subscriptionIds.includes(sub.id)
                    ? "rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                    : "rounded-full border border-emerald-200 px-3 py-1 text-xs text-emerald-700"
                }
              >
                {sub.name}
              </button>
            ))}
          </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Income", value: totals.income },
          { label: "Expense", value: totals.expense },
          { label: "Net", value: totals.net },
        ].map((item) => (
            <div
              key={item.label}
              className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-4"
            >
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                {item.label}
              </p>
              <div className="text-2xl font-semibold text-slate-900">
                {loading && chartData.length === 0 ? (
                  <Skeleton className="h-7 w-24" />
                ) : (
                  currency(item.value)
                )}
              </div>
              {item.label === "Net" ? (
                <Badge variant="secondary" className="text-slate-700">
                  {item.value >= 0 ? "Positive" : "Negative"}
                </Badge>
              ) : null}
            </div>
        ))}
      </CardContent>
    </Card>

    <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-sm text-slate-700">Top subscriptions</CardTitle>
          <p className="text-sm text-slate-500">
            Highest spend subscriptions by trailing 3 months.
          </p>
        </div>
        <Link
          to={PageRoutes.subscriptions}
          className="text-xs font-semibold text-emerald-700"
        >
          Manage subscriptions →
        </Link>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        {topSubscriptions.map((sub) => (
          <div
            key={sub.id}
            className="rounded-lg border border-slate-200 bg-white p-3 shadow-[0_10px_24px_-20px_rgba(16,185,129,0.6)]"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {sub.category_name || "Uncategorized"}
                </p>
                <p className="text-sm font-semibold text-slate-900">{sub.name}</p>
              </div>
              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700">
                {sub.is_active ? "Active" : "Archived"}
              </Badge>
            </div>
            <div className="mt-2 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <span>Current month</span>
                <span className="font-semibold">
                  {currency(Number(sub.current_month_spend))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Trailing 3 mo</span>
                <span className="font-semibold">
                  {currency(Number(sub.trailing_three_month_spend))}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Last charge</span>
                <span className="font-semibold">
                  {sub.last_charge_at
                    ? new Date(sub.last_charge_at).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
            <div className="mt-2">
              <ResponsiveContainer width="100%" height={60}>
                <LineChart
                  data={(sub.trend || []).map((value, idx) => ({
                    idx,
                    value: Number(value),
                  }))}
                  margin={{ left: 0, right: 0, top: 0, bottom: 0 }}
                >
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
        {!topSubscriptions.length && !subsLoading ? (
          <p className="text-sm text-slate-500">No subscription data yet.</p>
        ) : null}
        {subsLoading && !topSubscriptions.length ? (
          <Skeleton className="h-24 w-full" />
        ) : null}
      </CardContent>
    </Card>

      <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base text-slate-800">
              Stacked income vs expense
            </CardTitle>
            <p className="text-sm text-slate-500">
              Net overlay highlights overall direction.
            </p>
          </div>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
          ) : null}
        </CardHeader>
        <CardContent className="h-[360px]">
          {loading && chartData.length === 0 ? (
            <div className="flex h-full flex-col justify-center gap-3">
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : empty ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-600">
              <Sparkles className="h-6 w-6 text-slate-500" />
              <p className="text-center">
                No report data yet. Import files or add transactions.
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
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 12, left: 0, bottom: 8 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#E2E8F0"
                />
                <XAxis
                  dataKey="label"
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
                  formatter={(value: number, name) => [
                    currency(value),
                    name === "income"
                      ? "Income"
                      : name === "expense"
                        ? "Expense"
                        : "Net",
                  ]}
                />
                <Legend />
                <Bar
                  dataKey="income"
                  name="Income"
                  stackId="flow"
                  fill="var(--chart-2)"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  name="Expense"
                  stackId="flow"
                  fill="var(--chart-4)"
                  radius={[6, 6, 0, 0]}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Net"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
