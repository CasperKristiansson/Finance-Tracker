import { Loader2, Sparkles, TrendingUp, Wallet } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MotionPage } from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageRoutes } from "@/data/routes";
import { useAccountsApi, useReportsApi } from "@/hooks/use-api";
import type { MonthlyReportEntry, QuarterlyReportEntry } from "@/types/api";

const currency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

type Granularity = "monthly" | "quarterly";

type ChartPoint = {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
};

export const CashFlow: React.FC = () => {
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { monthly, quarterly, fetchMonthlyReport, fetchQuarterlyReport } =
    useReportsApi();

  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    const filters = {
      year: new Date().getFullYear(),
      accountIds: selectedAccounts,
    };
    if (granularity === "monthly") {
      fetchMonthlyReport(filters);
    } else {
      fetchQuarterlyReport(filters);
    }
  }, [fetchMonthlyReport, fetchQuarterlyReport, granularity, selectedAccounts]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((acc) => acc !== id) : [...prev, id],
    );
  };

  const chartData: ChartPoint[] = useMemo(() => {
    if (granularity === "monthly") {
      const rows = (monthly.data as MonthlyReportEntry[]) || [];
      return rows.map((row) => ({
        label: new Date(row.period).toLocaleString("en-US", { month: "short" }),
        inflow: Number(row.income),
        outflow: Math.abs(Number(row.expense)),
        net: Number(row.net),
      }));
    }
    const rows = (quarterly.data as QuarterlyReportEntry[]) || [];
    return rows.map((row) => ({
      label: `Q${row.quarter} ${row.year}`,
      inflow: Number(row.income),
      outflow: Math.abs(Number(row.expense)),
      net: Number(row.net),
    }));
  }, [granularity, monthly.data, quarterly.data]);

  const totals = useMemo(() => {
    if (!chartData.length) return { inflow: 0, outflow: 0, net: 0 };
    return chartData.reduce(
      (acc, row) => ({
        inflow: acc.inflow + row.inflow,
        outflow: acc.outflow + row.outflow,
        net: acc.net + row.net,
      }),
      { inflow: 0, outflow: 0, net: 0 },
    );
  }, [chartData]);

  const loading = monthly.loading || quarterly.loading;
  const showSkeleton = loading && chartData.length === 0;

  return (
    <MotionPage className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Cash flow
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Inflow vs outflow
          </h1>
          <p className="text-sm text-slate-500">
            Focused view of money in/out. Toggle month or quarter and filter by
            accounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={granularity === "monthly" ? "default" : "outline"}
            size="sm"
            onClick={() => setGranularity("monthly")}
          >
            Monthly
          </Button>
          <Button
            variant={granularity === "quarterly" ? "default" : "outline"}
            size="sm"
            onClick={() => setGranularity("quarterly")}
          >
            Quarterly
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {[
          {
            label: "Inflow",
            icon: Wallet,
            tone: "text-emerald-600",
            value: totals.inflow,
          },
          {
            label: "Outflow",
            icon: Wallet,
            tone: "text-rose-600 rotate-180",
            value: totals.outflow,
          },
          {
            label: "Net",
            icon: TrendingUp,
            tone: "text-indigo-600",
            value: totals.net,
          },
        ].map((item) => (
          <Card
            key={item.label}
            className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]"
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm text-slate-600">
                <item.icon className={`h-4 w-4 ${item.tone}`} /> {item.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-slate-900">
              {showSkeleton ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                currency(item.value)
              )}
              <div className="mt-1 text-xs text-slate-500">
                {item.label === "Net"
                  ? "Inflow minus outflow"
                  : item.label === "Inflow"
                    ? `Across ${chartData.length || "…"} periods`
                    : "Cash out across periods"}
              </div>
              {item.label === "Net" ? (
                <div className="mt-2">
                  <Badge variant="secondary" className="text-slate-700">
                    {item.value >= 0 ? "Positive" : "Negative"}
                  </Badge>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base text-slate-800">
              Cash flow trend
            </CardTitle>
            <p className="text-sm text-slate-500">
              Stacked bars show inflow vs outflow for the selected period and
              accounts.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-700">
            <span className="text-xs tracking-wide text-slate-500 uppercase">
              Accounts
            </span>
            <div className="flex flex-wrap gap-2">
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
                <span className="text-xs text-slate-500">
                  No accounts loaded
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-[360px]">
          {showSkeleton ? (
            <div className="flex h-full flex-col justify-center gap-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-48 w-full" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ) : !loading && chartData.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-600">
              <Sparkles className="h-6 w-6 text-slate-500" />
              <p className="text-center text-slate-600">
                No cash flow yet. Import files or add transactions to see
                inflow/outflow.
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
          ) : loading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
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
                  tickFormatter={(v) => (Number(v) === 0 ? "0" : currency(v))}
                />
                <Tooltip
                  cursor={{ fill: "#F8FAFC" }}
                  formatter={(value: number, name) => [
                    currency(value),
                    name === "inflow"
                      ? "Inflow"
                      : name === "outflow"
                        ? "Outflow"
                        : "Net",
                  ]}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar
                  dataKey="inflow"
                  name="Inflow"
                  stackId="flow"
                  fill="var(--chart-2)"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="outflow"
                  name="Outflow"
                  stackId="flow"
                  fill="var(--chart-4)"
                  radius={[6, 6, 0, 0]}
                />
                <Bar
                  dataKey="net"
                  name="Net"
                  fill="var(--chart-1)"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
        <CardHeader>
          <CardTitle className="text-sm text-slate-700">
            What to expect
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Live soon</Badge>
            Cash flow will sync to transactions once the backend feed is ready.
          </div>
          <div className="flex flex-col gap-1 text-xs text-slate-500">
            <span>
              • Uses reporting endpoints (monthly/quarterly) with account
              filters.
            </span>
            <span>
              • Stacked bars for inflow/outflow; net overlay for quick deltas.
            </span>
            <span>• Account chips filter quickly without page reloads.</span>
          </div>
        </CardContent>
      </Card>
    </MotionPage>
  );
};

export default CashFlow;
