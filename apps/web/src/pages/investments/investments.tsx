import { motion } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MotionPage,
  StaggerWrap,
  fadeInUp,
  subtleHover,
} from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInvestmentsApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";

const formatSek = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  });

const formatCompact = (value: number) =>
  new Intl.NumberFormat("sv-SE", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const formatSignedSek = (value: number) =>
  `${value >= 0 ? "+" : "-"}${formatSek(Math.abs(value))}`;

const coerceMoney = (value: unknown): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toIsoDate = (value: unknown) => {
  if (!value) return null;
  return String(value).slice(0, 10);
};

const toChartId = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);

const exportCsv = (rows: Record<string, unknown>[], filename: string) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          if (val === null || val === undefined) return "";
          const text = String(val).replace(/"/g, '""');
          return `"${text}"`;
        })
        .join(","),
    ),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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

export const Investments: React.FC = () => {
  const { overview, loading, error, fetchOverview } = useInvestmentsApi();

  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [focusedAccount, setFocusedAccount] = useState<string>("ALL");

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const isLoading = loading && !overview;

  const portfolioSeries = useMemo(() => {
    const series = overview?.portfolio.series ?? [];
    return series
      .map((p) => {
        const date = String(p.date).slice(0, 10);
        return {
          date,
          value: coerceMoney(p.value),
          year: new Date(date).getFullYear(),
        };
      })
      .filter((p) => Boolean(p.date));
  }, [overview?.portfolio.series]);

  const portfolioCurrentValue = coerceMoney(overview?.portfolio.current_value);
  const portfolioStartDate = toIsoDate(overview?.portfolio.start_date);

  const portfolioDomain = useMemo<[number, number]>(() => {
    if (!portfolioSeries.length) return [0, 0];
    const values = portfolioSeries.map((d) => d.value);
    const max = Math.max(...values);
    const upperPad = Math.abs(max) * 0.05 || 1;
    return [0, max + upperPad];
  }, [portfolioSeries]);

  const cashflowSummary = useMemo(() => {
    const cashflow = overview?.portfolio.cashflow;
    return {
      deposits30: coerceMoney(cashflow?.added_30d),
      withdrawals30: coerceMoney(cashflow?.withdrawn_30d),
      net30: coerceMoney(cashflow?.net_30d),
      deposits12m: coerceMoney(cashflow?.added_12m),
      withdrawals12m: coerceMoney(cashflow?.withdrawn_12m),
      net12m: coerceMoney(cashflow?.net_12m),
    };
  }, [overview?.portfolio.cashflow]);

  const portfolioPerformance = useMemo(() => {
    const growth12m = overview?.portfolio.growth_12m_ex_transfers;
    const growthSince = overview?.portfolio.growth_since_start_ex_transfers;

    return {
      market12m: coerceMoney(growth12m?.amount),
      market12mPct: growth12m?.pct ?? null,
      marketSinceStart: coerceMoney(growthSince?.amount),
      marketSinceStartPct: growthSince?.pct ?? null,
    };
  }, [
    overview?.portfolio.growth_12m_ex_transfers,
    overview?.portfolio.growth_since_start_ex_transfers,
  ]);

  const accountSummaries = useMemo(() => {
    const accounts = overview?.accounts ?? [];
    return accounts
      .map((account) => {
        const series = (account.series ?? [])
          .map((p) => ({
            date: String(p.date).slice(0, 10),
            value: coerceMoney(p.value),
          }))
          .filter((p) => Boolean(p.date));

        const sparkline = series.slice(-18);
        const latestValue = coerceMoney(account.current_value);

        return {
          accountId: account.account_id,
          accountName: account.name,
          icon: account.icon ?? null,
          latestDate: toIsoDate(account.as_of),
          latestValue,
          series,
          sparkline,
          cashflow12mAdded: coerceMoney(account.cashflow_12m_added),
          cashflow12mWithdrawn: coerceMoney(account.cashflow_12m_withdrawn),
          growth12mAmount: coerceMoney(account.growth_12m_ex_transfers.amount),
          growth12mPct: account.growth_12m_ex_transfers.pct ?? null,
        };
      })
      .sort((a, b) => b.latestValue - a.latestValue);
  }, [overview?.accounts]);

  const visibleAccounts = showAllAccounts
    ? accountSummaries
    : accountSummaries.slice(0, 4);

  const focusedAccountSeries = useMemo(() => {
    if (focusedAccount === "ALL") return null;
    const acct = accountSummaries.find((a) => a.accountName === focusedAccount);
    if (!acct?.sparkline?.length) return null;
    return acct.sparkline.map((p) => ({
      ...p,
      year: new Date(p.date).getFullYear(),
    }));
  }, [accountSummaries, focusedAccount]);

  const recentCashflows = overview?.recent_cashflows ?? [];

  return (
    <MotionPage className="space-y-6">
      <StaggerWrap className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <motion.div variants={fadeInUp}>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Investments
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Explore your investments
          </h1>
          <p className="text-sm text-slate-500">
            Balance over time, per-account performance, and cash in/out.
          </p>
        </motion.div>
        <motion.div
          variants={fadeInUp}
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOverview()}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {loading ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              Loading
            </span>
          ) : null}
          {error ? (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-700">
              Failed to load investments
            </span>
          ) : null}
        </motion.div>
      </StaggerWrap>

      <StaggerWrap className="grid gap-4 lg:grid-cols-3">
        <motion.div variants={fadeInUp} className="lg:col-span-2">
          <ChartCard
            title="Investments"
            description="Balance over time"
            loading={isLoading}
            action={
              <div className="text-right">
                <p className="text-xs text-slate-500">Current</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatSek(portfolioCurrentValue)}
                </p>
                {portfolioStartDate ? (
                  <p
                    className={cn(
                      "text-xs font-medium",
                      portfolioPerformance.marketSinceStart >= 0
                        ? "text-emerald-700"
                        : "text-rose-700",
                    )}
                  >
                    {formatSignedSek(portfolioPerformance.marketSinceStart)}{" "}
                    {portfolioPerformance.marketSinceStartPct !== null
                      ? `(${portfolioPerformance.marketSinceStartPct >= 0 ? "+" : ""}${portfolioPerformance.marketSinceStartPct.toFixed(
                          1,
                        )}%)`
                      : ""}
                  </p>
                ) : null}
              </div>
            }
          >
            {portfolioSeries.length ? (
              <ChartContainer
                className="h-full w-full"
                config={{
                  value: {
                    label: "Investments",
                    color: "#0ea5e9",
                  },
                }}
              >
                <AreaChart
                  data={portfolioSeries}
                  margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="investmentsFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
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
                    domain={portfolioDomain}
                    allowDataOverflow
                    tickMargin={12}
                    width={90}
                    tickFormatter={(v) => formatCompact(Number(v))}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  {Array.from(new Set(portfolioSeries.map((d) => d.year))).map(
                    (year) => {
                      const firstPoint = portfolioSeries.find(
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
                    dataKey="value"
                    stroke="#0ea5e9"
                    fill="url(#investmentsFill)"
                    strokeWidth={2}
                    name="Investments"
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                No investment values yet.
              </div>
            )}
          </ChartCard>
        </motion.div>

        <motion.div variants={fadeInUp} className="space-y-3" {...subtleHover}>
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-800">
                Portfolio details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Total value</span>
                <span className="font-medium text-slate-900">
                  {formatSek(portfolioCurrentValue)}
                </span>
              </div>
              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs tracking-wide text-slate-600 uppercase">
                    Cashflow
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Added (30d)</span>
                  <span className="font-medium text-slate-900">
                    {isLoading ? "—" : formatSek(cashflowSummary.deposits30)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Withdrawn (30d)</span>
                  <span className="font-medium text-slate-900">
                    {isLoading ? "—" : formatSek(cashflowSummary.withdrawals30)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Net flow (30d)</span>
                  <span
                    className={cn(
                      "font-medium",
                      cashflowSummary.net30 >= 0
                        ? "text-emerald-700"
                        : "text-rose-700",
                    )}
                  >
                    {isLoading ? "—" : formatSignedSek(cashflowSummary.net30)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-slate-500">Added (12m)</span>
                  <span className="font-medium text-slate-900">
                    {isLoading ? "—" : formatSek(cashflowSummary.deposits12m)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Withdrawn (12m)</span>
                  <span className="font-medium text-slate-900">
                    {isLoading
                      ? "—"
                      : formatSek(cashflowSummary.withdrawals12m)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Net flow (12m)</span>
                  <span
                    className={cn(
                      "font-medium",
                      cashflowSummary.net12m >= 0
                        ? "text-emerald-700"
                        : "text-rose-700",
                    )}
                  >
                    {isLoading ? "—" : formatSignedSek(cashflowSummary.net12m)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">
                  Growth (12m, excl. transfers)
                </span>
                <span
                  className={cn(
                    "font-medium",
                    portfolioPerformance.market12m >= 0
                      ? "text-emerald-700"
                      : "text-rose-700",
                  )}
                >
                  {formatSignedSek(portfolioPerformance.market12m)}{" "}
                  {portfolioPerformance.market12mPct !== null
                    ? `(${portfolioPerformance.market12mPct >= 0 ? "+" : ""}${portfolioPerformance.market12mPct.toFixed(
                        1,
                      )}%)`
                    : ""}
                </span>
              </div>
              {portfolioStartDate ? (
                <p className="text-xs text-slate-500">
                  Since {portfolioStartDate}:{" "}
                  <span
                    className={cn(
                      "font-medium",
                      portfolioPerformance.marketSinceStart >= 0
                        ? "text-emerald-700"
                        : "text-rose-700",
                    )}
                  >
                    {formatSignedSek(portfolioPerformance.marketSinceStart)}
                    {portfolioPerformance.marketSinceStartPct !== null
                      ? ` (${portfolioPerformance.marketSinceStartPct >= 0 ? "+" : ""}${portfolioPerformance.marketSinceStartPct.toFixed(
                          1,
                        )}%)`
                      : ""}
                  </span>
                </p>
              ) : null}
            </CardContent>
          </Card>
        </motion.div>
      </StaggerWrap>

      <StaggerWrap className="space-y-3">
        <motion.div
          variants={fadeInUp}
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="text-xs tracking-wide text-slate-500 uppercase">
              Accounts
            </p>
            <h2 className="text-lg font-semibold text-slate-900">
              Investment accounts
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {accountSummaries.length ? (
              <select
                className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 shadow-sm"
                value={focusedAccount}
                onChange={(e) => setFocusedAccount(e.target.value)}
              >
                <option value="ALL">All accounts</option>
                {accountSummaries.map((acct) => (
                  <option key={acct.accountName} value={acct.accountName}>
                    {acct.accountName}
                  </option>
                ))}
              </select>
            ) : null}
            {accountSummaries.length > 4 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllAccounts((v) => !v)}
              >
                {showAllAccounts
                  ? "Show top 4"
                  : `Show all (${accountSummaries.length})`}
              </Button>
            ) : null}
          </div>
        </motion.div>

        {focusedAccountSeries ? (
          <motion.div variants={fadeInUp} {...subtleHover}>
            <ChartCard
              title={focusedAccount}
              description="Account balance over time"
              loading={false}
            >
              <ChartContainer
                className="h-full w-full"
                config={{
                  value: {
                    label: focusedAccount,
                    color: "#4f46e5",
                  },
                }}
              >
                <AreaChart
                  data={focusedAccountSeries}
                  margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="accountFill"
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
                    tickMargin={12}
                    width={90}
                    tickFormatter={(v) => formatCompact(Number(v))}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  {Array.from(
                    new Set(focusedAccountSeries.map((d) => d.year)),
                  ).map((year) => {
                    const firstPoint = focusedAccountSeries.find(
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
                  })}
                  <Area
                    type="monotoneX"
                    connectNulls
                    dataKey="value"
                    stroke="#4f46e5"
                    fill="url(#accountFill)"
                    strokeWidth={2}
                    name={focusedAccount}
                  />
                </AreaChart>
              </ChartContainer>
            </ChartCard>
          </motion.div>
        ) : null}

        {accountSummaries.length ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {visibleAccounts.map((acct) => (
              <motion.div
                key={acct.accountName}
                variants={fadeInUp}
                {...subtleHover}
              >
                <Card className="border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-800">
                      {acct.accountName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xl font-semibold text-slate-900">
                        {formatSek(acct.latestValue)}
                      </p>
                      {acct.latestDate ? (
                        <Badge className="bg-slate-100 text-xs text-slate-700">
                          As of {acct.latestDate}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-xs text-slate-700">
                          No value history
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Growth (12m, excl. transfers)
                      </span>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          acct.growth12mAmount >= 0
                            ? "text-emerald-700"
                            : "text-rose-700",
                        )}
                      >
                        {formatSignedSek(acct.growth12mAmount)}
                        {acct.growth12mPct !== null
                          ? ` (${acct.growth12mPct >= 0 ? "+" : ""}${acct.growth12mPct.toFixed(
                              1,
                            )}%)`
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Added (12m)</span>
                      <span className="font-medium text-slate-900">
                        {formatSek(acct.cashflow12mAdded)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Withdrawn (12m)</span>
                      <span className="font-medium text-slate-900">
                        {formatSek(acct.cashflow12mWithdrawn)}
                      </span>
                    </div>
                    <div className="h-14">
                      {acct.sparkline.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={acct.sparkline}>
                            <defs>
                              <linearGradient
                                id={`spark-${toChartId(acct.accountName)}`}
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                              >
                                <stop
                                  offset="5%"
                                  stopColor="#4f46e5"
                                  stopOpacity={0.25}
                                />
                                <stop
                                  offset="95%"
                                  stopColor="#4f46e5"
                                  stopOpacity={0}
                                />
                              </linearGradient>
                            </defs>
                            <Area
                              type="monotoneX"
                              dataKey="value"
                              stroke="#4f46e5"
                              fill={`url(#spark-${toChartId(acct.accountName)})`}
                              strokeWidth={2}
                              dot={false}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div variants={fadeInUp}>
            <Card className="border-dashed border-slate-200 bg-slate-50/70">
              <CardContent className="py-8 text-center text-sm text-slate-600">
                No investment values yet.
              </CardContent>
            </Card>
          </motion.div>
        )}
      </StaggerWrap>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-800">
              Added / withdrawn
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
                <div className="space-y-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="h-8 animate-pulse rounded bg-slate-100"
                    />
                  ))}
                </div>
              </div>
            ) : accountSummaries.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Added (12m)</TableHead>
                    <TableHead className="text-right">
                      Withdrawn (12m)
                    </TableHead>
                    <TableHead className="text-right">Net (12m)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountSummaries.map((account) => {
                    const net12m =
                      account.cashflow12mAdded - account.cashflow12mWithdrawn;
                    return (
                      <TableRow key={account.accountId}>
                        <TableCell className="font-medium">
                          <span className="text-slate-900">
                            {account.accountName}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatSek(account.cashflow12mAdded)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatSek(account.cashflow12mWithdrawn)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            net12m >= 0 ? "text-emerald-700" : "text-rose-700",
                          )}
                        >
                          {net12m >= 0 ? "+" : "-"}
                          {formatSek(Math.abs(net12m))}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-slate-500">
                No investment accounts found.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm text-slate-800">
                Recent deposits / withdrawals
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportCsv(
                    recentCashflows.map((tx) => ({
                      date: String(tx.occurred_at).slice(0, 10),
                      account: tx.account_name,
                      direction:
                        tx.direction === "deposit" ? "Added" : "Withdrawn",
                      description: tx.description || "",
                      amount_sek: coerceMoney(tx.amount_sek),
                    })),
                    "investment-cashflow.csv",
                  )
                }
                disabled={!recentCashflows.length}
              >
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentCashflows.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount (SEK)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCashflows.map((tx) => (
                      <TableRow key={tx.transaction_id}>
                        <TableCell className="text-slate-600">
                          {String(tx.occurred_at).slice(0, 10)}
                        </TableCell>
                        <TableCell className="text-slate-800">
                          {tx.account_name}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-slate-700",
                            tx.direction === "deposit"
                              ? "text-emerald-700"
                              : "text-rose-700",
                          )}
                        >
                          {tx.direction === "deposit" ? "Added" : "Withdrawn"}
                        </TableCell>
                        <TableCell className="text-slate-800">
                          {tx.description || "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right",
                            tx.direction === "deposit"
                              ? "text-emerald-700"
                              : "text-rose-700",
                          )}
                        >
                          {tx.direction === "deposit" ? "+" : "-"}
                          {formatSek(coerceMoney(tx.amount_sek))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-slate-500">
                  {isLoading
                    ? "Loading cashflow…"
                    : "No deposits or withdrawals found."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MotionPage>
  );
};

export default Investments;
