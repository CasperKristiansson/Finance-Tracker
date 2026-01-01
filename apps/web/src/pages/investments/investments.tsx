import { motion } from "framer-motion";
import { Loader2, RefreshCw } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import {
  MotionPage,
  StaggerWrap,
  fadeInUp,
  subtleHover,
} from "@/components/motion-presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageRoutes } from "@/data/routes";
import { useInvestmentsApi } from "@/hooks/use-api";
import { compactCurrency, currency } from "@/lib/format";
import { cn } from "@/lib/utils";

const formatSek = (value: number) => currency(value);

const formatCompact = (value: number) => compactCurrency(value);

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

const daysSinceIsoDate = (isoDate: string | null): number | null => {
  if (!isoDate) return null;
  const dt = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(dt.getTime())) return null;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - dt.getTime()) / 86400000);
  return Number.isFinite(diffDays) ? diffDays : null;
};

const freshnessBadge = (isoDate: string | null) => {
  const days = daysSinceIsoDate(isoDate);
  if (!isoDate || days === null) {
    return {
      label: "No snapshots",
      className: "bg-rose-50 text-rose-700",
    };
  }
  if (days <= 7) {
    return {
      label: `As of ${isoDate}`,
      className: "bg-emerald-50 text-emerald-700",
    };
  }
  if (days <= 35) {
    return {
      label: `As of ${isoDate}`,
      className: "bg-slate-100 text-slate-700",
    };
  }
  return {
    label: `Stale (${days}d) · ${isoDate}`,
    className: "bg-amber-50 text-amber-800",
  };
};

const MetricRow: React.FC<{
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}> = ({ label, value, valueClassName }) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="text-slate-500">{label}</span>
    <span
      className={cn("font-medium text-slate-900 tabular-nums", valueClassName)}
    >
      {value}
    </span>
  </div>
);

type PortfolioPoint = { date: string; value: number; year: number };
type ContributionPoint = {
  period: string;
  contributions: number;
  marketGrowth: number | null;
};

const valueAtIsoDate = (series: PortfolioPoint[], isoDate: string) => {
  if (!series.length) return null;
  let last: PortfolioPoint | null = null;
  for (const point of series) {
    if (point.date <= isoDate) {
      last = point;
    } else {
      break;
    }
  }
  return last ? last.value : null;
};

const endOfMonthIso = (monthIso: string) => {
  const dt = new Date(`${monthIso}T00:00:00Z`);
  const nextMonth = new Date(
    Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 1),
  );
  const end = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000);
  return end.toISOString().slice(0, 10);
};

const groupContributionPoints = (
  points: ContributionPoint[],
  grouping: "month" | "quarter" | "year",
) => {
  if (grouping === "month") return points;

  const buckets = new Map<
    string,
    {
      period: string;
      contributions: number;
      marketGrowth: number;
      marketGrowthCount: number;
    }
  >();

  for (const point of points) {
    const dt = new Date(`${point.period}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) continue;
    const year = dt.getUTCFullYear();
    const key =
      grouping === "year"
        ? `${year}-01-01`
        : `${year}-${String(Math.floor(dt.getUTCMonth() / 3) * 3 + 1).padStart(
            2,
            "0",
          )}-01`;
    const bucket = buckets.get(key) ?? {
      period: key,
      contributions: 0,
      marketGrowth: 0,
      marketGrowthCount: 0,
    };
    bucket.contributions += point.contributions;
    if (typeof point.marketGrowth === "number") {
      bucket.marketGrowth += point.marketGrowth;
      bucket.marketGrowthCount += 1;
    }
    buckets.set(key, bucket);
  }

  return Array.from(buckets.values())
    .map((bucket) => ({
      period: bucket.period,
      contributions: bucket.contributions,
      marketGrowth: bucket.marketGrowthCount ? bucket.marketGrowth : null,
    }))
    .sort((a, b) => a.period.localeCompare(b.period));
};

export const Investments: React.FC = () => {
  const {
    overview,
    transactions,
    loading,
    error,
    updateLoading,
    updateError,
    fetchOverview,
    fetchTransactions: fetchInvestmentTransactions,
    createSnapshot,
  } = useInvestmentsApi();

  const [portfolioWindow, setPortfolioWindow] = useState<"since" | "12m">(
    "since",
  );
  const [contributionsGrouping, setContributionsGrouping] = useState<
    "month" | "quarter" | "year"
  >("month");
  const [accountWindow, setAccountWindow] = useState<"since" | "12m">("since");
  const [detailsAccountId, setDetailsAccountId] = useState<string | null>(null);
  const [cashflowDetailsMonth, setCashflowDetailsMonth] = useState<
    string | null
  >(null);
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [snapshotAccountId, setSnapshotAccountId] = useState<string | null>(
    null,
  );
  const [snapshotBalance, setSnapshotBalance] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [snapshotSubmitted, setSnapshotSubmitted] = useState(false);
  const [cashflowsDialogScope, setCashflowsDialogScope] = useState<
    "portfolio" | "account" | null
  >(null);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const isLoading = loading && !overview;

  const portfolioSeries = useMemo<PortfolioPoint[]>(() => {
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
      .filter((p) => Boolean(p.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [overview?.portfolio.series]);

  const portfolioCurrentValue = coerceMoney(overview?.portfolio.current_value);
  const sinceStartDate = toIsoDate(overview?.portfolio.start_date);
  const portfolioAsOf = toIsoDate(overview?.portfolio.as_of);
  const portfolioFreshness = freshnessBadge(portfolioAsOf);

  const portfolioDomain = useMemo<[number, number]>(() => {
    if (!portfolioSeries.length) return [0, 0];
    const values = portfolioSeries.map((d) => d.value);
    const max = Math.max(...values);
    const upperPad = Math.abs(max) * 0.05 || 1;
    return [0, max + upperPad];
  }, [portfolioSeries]);

  const portfolioCashflow = overview?.portfolio.cashflow;
  const portfolioGrowth12m = overview?.portfolio.growth_12m_ex_transfers;
  const portfolioGrowthSince =
    overview?.portfolio.growth_since_start_ex_transfers;

  const portfolioKpis = useMemo(() => {
    return {
      since: {
        added: coerceMoney(portfolioCashflow?.added_since_start),
        withdrawn: coerceMoney(portfolioCashflow?.withdrawn_since_start),
        net: coerceMoney(portfolioCashflow?.net_since_start),
        marketGrowth: coerceMoney(portfolioGrowthSince?.amount),
        marketGrowthPct: portfolioGrowthSince?.pct ?? null,
      },
      twelve: {
        added: coerceMoney(portfolioCashflow?.added_12m),
        withdrawn: coerceMoney(portfolioCashflow?.withdrawn_12m),
        net: coerceMoney(portfolioCashflow?.net_12m),
        marketGrowth: coerceMoney(portfolioGrowth12m?.amount),
        marketGrowthPct: portfolioGrowth12m?.pct ?? null,
      },
    };
  }, [portfolioCashflow, portfolioGrowth12m, portfolioGrowthSince]);

  const contributionsVsGrowth = useMemo<ContributionPoint[]>(() => {
    const cashflowSeries = overview?.portfolio.cashflow_series ?? [];
    if (!cashflowSeries.length) return [];
    return cashflowSeries
      .map((point) => {
        const period = String(point.period).slice(0, 10);
        const startValue = valueAtIsoDate(portfolioSeries, period);
        const endValue = valueAtIsoDate(portfolioSeries, endOfMonthIso(period));
        const netContrib = coerceMoney(point.net);
        if (startValue === null || endValue === null) {
          return {
            period,
            contributions: netContrib,
            marketGrowth: null as number | null,
          };
        }
        const valueChange = endValue - startValue;
        return {
          period,
          contributions: netContrib,
          marketGrowth: valueChange - netContrib,
        };
      })
      .filter((row) => Boolean(row.period))
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [overview?.portfolio.cashflow_series, portfolioSeries]);

  const contributionsVsGrowthGrouped = useMemo(
    () => groupContributionPoints(contributionsVsGrowth, contributionsGrouping),
    [contributionsGrouping, contributionsVsGrowth],
  );

  const contributionsGroupingLabel = useMemo(() => {
    switch (contributionsGrouping) {
      case "year":
        return "Yearly";
      case "quarter":
        return "Quarterly";
      default:
        return "Monthly";
    }
  }, [contributionsGrouping]);

  const formatContributionsTick = (value: string) => {
    const dt = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return value;
    if (contributionsGrouping === "year") {
      return `${dt.getUTCFullYear()}`;
    }
    if (contributionsGrouping === "quarter") {
      const quarter = Math.floor(dt.getUTCMonth() / 3) + 1;
      const shortYear = String(dt.getUTCFullYear()).slice(2);
      return `Q${quarter} '${shortYear}`;
    }
    return dt.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
  };

  const accountSummaries = useMemo(() => {
    const accounts = overview?.accounts ?? [];
    return accounts
      .map((account) => {
        const series = (account.series ?? [])
          .map((p) => ({
            date: String(p.date).slice(0, 10),
            value: coerceMoney(p.value),
            year: new Date(String(p.date).slice(0, 10)).getFullYear(),
          }))
          .filter((p) => Boolean(p.date))
          .sort((a, b) => a.date.localeCompare(b.date));

        const cashflow12mAdded = coerceMoney(account.cashflow_12m_added);
        const cashflow12mWithdrawn = coerceMoney(
          account.cashflow_12m_withdrawn,
        );

        return {
          accountId: account.account_id,
          accountName: account.name,
          icon: account.icon ?? null,
          startDate: toIsoDate(account.start_date),
          asOf: toIsoDate(account.as_of),
          currentValue: coerceMoney(account.current_value),
          series,
          cashflow12m: {
            added: cashflow12mAdded,
            withdrawn: cashflow12mWithdrawn,
            net: cashflow12mAdded - cashflow12mWithdrawn,
          },
          cashflowSince: {
            added: coerceMoney(account.cashflow_since_start_added),
            withdrawn: coerceMoney(account.cashflow_since_start_withdrawn),
            net: coerceMoney(account.cashflow_since_start_net),
          },
          growth12m: {
            amount: coerceMoney(account.growth_12m_ex_transfers.amount),
            pct: account.growth_12m_ex_transfers.pct ?? null,
          },
          growthSince: {
            amount: coerceMoney(account.growth_since_start_ex_transfers.amount),
            pct: account.growth_since_start_ex_transfers.pct ?? null,
          },
        };
      })
      .sort((a, b) => b.currentValue - a.currentValue);
  }, [overview?.accounts]);

  const selectedAccount = useMemo(() => {
    if (!detailsAccountId) return null;
    return (
      accountSummaries.find((a) => a.accountId === detailsAccountId) ?? null
    );
  }, [accountSummaries, detailsAccountId]);

  const snapshotAccount = useMemo(() => {
    if (!snapshotAccountId) return null;
    return (
      accountSummaries.find((a) => a.accountId === snapshotAccountId) ?? null
    );
  }, [accountSummaries, snapshotAccountId]);

  const selectedAccountInvestmentTxs = useMemo(() => {
    if (!selectedAccount) return [];
    const norm = (value: string | null | undefined) =>
      String(value ?? "")
        .trim()
        .toLowerCase();
    const selectedKey = norm(selectedAccount.accountName);
    if (!selectedKey) return [];
    return transactions
      .filter((tx) => {
        const key = norm(tx.account_name);
        if (!key) return false;
        return (
          key === selectedKey ||
          key.includes(selectedKey) ||
          selectedKey.includes(key)
        );
      })
      .slice(0, 50);
  }, [selectedAccount, transactions]);

  const selectedAccountRecentCashflows = useMemo(() => {
    if (!selectedAccount) return [];
    const accountId = selectedAccount.accountId;
    return (overview?.recent_cashflows ?? []).filter(
      (row) => row.account_id === accountId,
    );
  }, [overview?.recent_cashflows, selectedAccount]);

  const recentCashflows = useMemo(
    () => overview?.recent_cashflows ?? [],
    [overview?.recent_cashflows],
  );
  const cashflowDetailsMonthKey = cashflowDetailsMonth?.slice(0, 7) ?? null;
  const cashflowDetailsItems = useMemo(() => {
    if (!cashflowDetailsMonthKey) return [];
    return (overview?.recent_cashflows ?? [])
      .filter(
        (row) =>
          String(row.occurred_at).slice(0, 7) === cashflowDetailsMonthKey,
      )
      .sort((a, b) =>
        String(b.occurred_at).localeCompare(String(a.occurred_at)),
      );
  }, [cashflowDetailsMonthKey, overview?.recent_cashflows]);
  const cashflowDetailsLabel = useMemo(() => {
    if (!cashflowDetailsMonth) return null;
    const dt = new Date(`${cashflowDetailsMonth}T00:00:00Z`);
    if (Number.isNaN(dt.getTime())) return cashflowDetailsMonthKey;
    return dt.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [cashflowDetailsMonth, cashflowDetailsMonthKey]);

  const cashflowsDialogItems = useMemo(() => {
    const base =
      cashflowsDialogScope === "account"
        ? selectedAccountRecentCashflows
        : recentCashflows;
    return [...base].sort((a, b) =>
      String(b.occurred_at).localeCompare(String(a.occurred_at)),
    );
  }, [cashflowsDialogScope, recentCashflows, selectedAccountRecentCashflows]);

  const cashflowsDialogTitle = useMemo(() => {
    if (cashflowsDialogScope === "account" && selectedAccount) {
      return `Deposits & withdrawals · ${selectedAccount.accountName}`;
    }
    return "Deposits & withdrawals";
  }, [cashflowsDialogScope, selectedAccount]);

  useEffect(() => {
    if (!detailsAccountId) return;
    if (transactions.length) return;
    fetchInvestmentTransactions();
  }, [detailsAccountId, fetchInvestmentTransactions, transactions.length]);

  useEffect(() => {
    if (!snapshotDialogOpen) return;
    if (!snapshotAccountId && accountSummaries.length) {
      setSnapshotAccountId(accountSummaries[0].accountId);
    }
  }, [accountSummaries, snapshotAccountId, snapshotDialogOpen]);

  useEffect(() => {
    if (!snapshotDialogOpen) return;
    if (!snapshotAccount) {
      setSnapshotBalance("");
      setSnapshotDate(new Date().toISOString().slice(0, 10));
      setSnapshotNotes("");
      setSnapshotSubmitted(false);
      return;
    }
    setSnapshotBalance(snapshotAccount.currentValue.toFixed(2));
    setSnapshotDate(new Date().toISOString().slice(0, 10));
    setSnapshotNotes("");
    setSnapshotSubmitted(false);
  }, [snapshotAccount, snapshotDialogOpen]);

  useEffect(() => {
    if (!snapshotSubmitted) return;
    if (updateLoading) return;
    if (updateError) return;
    toast.success(
      snapshotAccount
        ? `${snapshotAccount.accountName} balance updated.`
        : "Investment balance updated.",
    );
    setSnapshotDialogOpen(false);
    setSnapshotSubmitted(false);
  }, [snapshotAccount, snapshotSubmitted, updateError, updateLoading]);

  const snapshotSubmitDisabled =
    updateLoading ||
    !snapshotAccount ||
    !snapshotDate ||
    !snapshotBalance.trim();

  const openSnapshotDialog = (accountId?: string | null) => {
    if (!accountSummaries.length) return;
    setSnapshotAccountId(accountId ?? accountSummaries[0].accountId);
    setSnapshotDialogOpen(true);
  };

  return (
    <MotionPage className="space-y-6">
      <StaggerWrap className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <motion.div variants={fadeInUp}>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Investments
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Investment overview
          </h1>
          <p className="text-sm text-slate-500">
            Portfolio value over time, contributions, and market growth.
          </p>
        </motion.div>
        <motion.div
          variants={fadeInUp}
          className="flex flex-wrap items-center justify-end gap-2"
        >
          <Button
            size="sm"
            onClick={() => openSnapshotDialog()}
            disabled={!accountSummaries.length}
          >
            Update balances
          </Button>
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
        <motion.div
          variants={fadeInUp}
          className="lg:col-span-2"
          {...subtleHover}
        >
          <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Portfolio value
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Snapshot-based valuation over time.
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Current</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatSek(portfolioCurrentValue)}
                </p>
                <div className="mt-2 flex flex-col items-end gap-1">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium",
                      portfolioFreshness.className,
                    )}
                  >
                    {portfolioFreshness.label}
                  </span>
                  {sinceStartDate ? (
                    <p className="text-xs text-slate-500">
                      Since {sinceStartDate}
                    </p>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="h-80 md:h-96">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : portfolioSeries.length ? (
                <ChartContainer
                  className="h-full w-full"
                  config={{
                    value: { label: "Portfolio value", color: "#0ea5e9" },
                  }}
                >
                  <AreaChart
                    data={portfolioSeries}
                    margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient
                        id="portfolioFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#0ea5e9"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#0ea5e9"
                          stopOpacity={0}
                        />
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
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => (
                            <span className="font-mono font-medium text-foreground tabular-nums">
                              {formatSek(Number(value))}
                            </span>
                          )}
                        />
                      }
                    />
                    {Array.from(
                      new Set(portfolioSeries.map((d) => d.year)),
                    ).map((year) => {
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
                    })}
                    <Area
                      type="monotoneX"
                      connectNulls
                      dataKey="value"
                      stroke="var(--color-value)"
                      fill="url(#portfolioFill)"
                      strokeWidth={2}
                      name="Portfolio value"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ChartContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-600">
                  No investment snapshots yet.
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp} {...subtleHover}>
          <Card className="h-full border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Contributions & growth
              </CardTitle>
              <p className="text-xs text-slate-500">
                End value = start value + contributions + market growth.
              </p>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Tabs
                value={portfolioWindow}
                onValueChange={(v) => setPortfolioWindow(v as "since" | "12m")}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="since">Since start</TabsTrigger>
                  <TabsTrigger value="12m">12m</TabsTrigger>
                </TabsList>
                <TabsContent value="since" className="space-y-3">
                  <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <MetricRow
                      label="Deposited"
                      value={formatSek(portfolioKpis.since.added)}
                    />
                    <MetricRow
                      label="Withdrawn"
                      value={formatSek(portfolioKpis.since.withdrawn)}
                    />
                    <MetricRow
                      label="Net contributions"
                      value={formatSignedSek(portfolioKpis.since.net)}
                      valueClassName={
                        portfolioKpis.since.net >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }
                    />
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <MetricRow
                      label="Market growth"
                      value={
                        <>
                          {formatSignedSek(portfolioKpis.since.marketGrowth)}{" "}
                          {portfolioKpis.since.marketGrowthPct !== null
                            ? `(${portfolioKpis.since.marketGrowthPct >= 0 ? "+" : ""}${portfolioKpis.since.marketGrowthPct.toFixed(1)}%)`
                            : ""}
                        </>
                      }
                      valueClassName={
                        portfolioKpis.since.marketGrowth >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }
                    />
                  </div>
                </TabsContent>
                <TabsContent value="12m" className="space-y-3">
                  <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <MetricRow
                      label="Deposited"
                      value={formatSek(portfolioKpis.twelve.added)}
                    />
                    <MetricRow
                      label="Withdrawn"
                      value={formatSek(portfolioKpis.twelve.withdrawn)}
                    />
                    <MetricRow
                      label="Net contributions"
                      value={formatSignedSek(portfolioKpis.twelve.net)}
                      valueClassName={
                        portfolioKpis.twelve.net >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }
                    />
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <MetricRow
                      label="Market growth"
                      value={
                        <>
                          {formatSignedSek(portfolioKpis.twelve.marketGrowth)}{" "}
                          {portfolioKpis.twelve.marketGrowthPct !== null
                            ? `(${portfolioKpis.twelve.marketGrowthPct >= 0 ? "+" : ""}${portfolioKpis.twelve.marketGrowthPct.toFixed(1)}%)`
                            : ""}
                        </>
                      }
                      valueClassName={
                        portfolioKpis.twelve.marketGrowth >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <div className="rounded-lg border border-slate-100 bg-white p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-slate-500 uppercase">
                    Recent deposits & withdrawals
                  </div>
                  <button
                    type="button"
                    className="text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
                    onClick={() => setCashflowsDialogScope("portfolio")}
                  >
                    View all
                  </button>
                </div>
                {recentCashflows.length ? (
                  <div className="mt-3 max-h-40 space-y-2 overflow-auto pr-1">
                    {recentCashflows.map((row) => {
                      const occurredAt = String(row.occurred_at);
                      const dateLabel = occurredAt.slice(0, 10);
                      const amount = coerceMoney(row.amount_sek);
                      const isDeposit = row.direction === "deposit";
                      return (
                        <div
                          key={row.transaction_id}
                          className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">
                              {row.account_name}
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              {dateLabel}
                              {row.description ? ` · ${row.description}` : ""}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "shrink-0 text-sm font-semibold tabular-nums",
                              isDeposit ? "text-emerald-700" : "text-rose-700",
                            )}
                          >
                            {isDeposit ? "+" : "-"}
                            {formatSek(amount)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                    No recent cashflows yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </StaggerWrap>

      <StaggerWrap className="grid gap-4 lg:grid-cols-2">
        <motion.div variants={fadeInUp} {...subtleHover}>
          <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Contributions vs market growth
                </CardTitle>
                <p className="text-xs text-slate-500">
                  {contributionsGroupingLabel} decomposition of value change.
                </p>
              </div>
              <Tabs
                value={contributionsGrouping}
                onValueChange={(value) =>
                  setContributionsGrouping(
                    value as "month" | "quarter" | "year",
                  )
                }
                className="w-full sm:w-auto"
              >
                <TabsList className="grid w-full grid-cols-3 bg-slate-100 sm:w-auto">
                  <TabsTrigger value="month" className="text-xs">
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger value="quarter" className="text-xs">
                    Quarterly
                  </TabsTrigger>
                  <TabsTrigger value="year" className="text-xs">
                    Yearly
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="h-80">
              {isLoading ? (
                <Skeleton className="h-full w-full" />
              ) : portfolioSeries.length &&
                contributionsVsGrowthGrouped.length ? (
                <ChartContainer
                  className="h-full w-full"
                  config={{
                    contributions: {
                      label: "Net contributions",
                      color: "#10b981",
                    },
                    marketGrowth: { label: "Market growth", color: "#6366f1" },
                  }}
                >
                  <BarChart
                    data={contributionsVsGrowthGrouped}
                    margin={{ left: 0, right: 0, top: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="period"
                      tickFormatter={(value) => formatContributionsTick(value)}
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
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => {
                            if (value === null || value === undefined)
                              return null;
                            return (
                              <span className="font-mono font-medium text-foreground tabular-nums">
                                {String(name)}: {formatSignedSek(Number(value))}
                              </span>
                            );
                          }}
                        />
                      }
                    />
                    <Bar
                      dataKey="contributions"
                      name="Net contributions"
                      fill="var(--color-contributions)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                      onClick={(data) => {
                        if (contributionsGrouping !== "month") return;
                        const period = String(data?.payload?.period ?? "");
                        if (!period) return;
                        setCashflowDetailsMonth(period);
                      }}
                    />
                    <Bar
                      dataKey="marketGrowth"
                      name="Market growth"
                      fill="var(--color-marketGrowth)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                      onClick={(data) => {
                        if (contributionsGrouping !== "month") return;
                        const period = String(data?.payload?.period ?? "");
                        if (!period) return;
                        setCashflowDetailsMonth(period);
                      }}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-600">
                  {portfolioSeries.length
                    ? "No contributions detected yet."
                    : "Add snapshots to see contributions vs growth."}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp} {...subtleHover}>
          <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Investment accounts
              </CardTitle>
              <p className="text-xs text-slate-500">
                Account-level contributions and growth. Click a row for details.
              </p>
            </CardHeader>
            <CardContent className="flex h-80 flex-col gap-3">
              <Tabs
                value={accountWindow}
                onValueChange={(v) => setAccountWindow(v as "since" | "12m")}
              >
                <TabsList className="w-full">
                  <TabsTrigger value="since">Since start</TabsTrigger>
                  <TabsTrigger value="12m">12m</TabsTrigger>
                </TabsList>
              </Tabs>
              {accountSummaries.length ? (
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-slate-100">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">Deposited</TableHead>
                        <TableHead className="text-right">Withdrawn</TableHead>
                        <TableHead className="text-right">
                          Market growth
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountSummaries.map((acct) => {
                        const windowed =
                          accountWindow === "since"
                            ? {
                                cashflow: acct.cashflowSince,
                                growth: acct.growthSince,
                              }
                            : {
                                cashflow: acct.cashflow12m,
                                growth: acct.growth12m,
                              };
                        const asOfBadge = freshnessBadge(acct.asOf);
                        return (
                          <TableRow
                            key={acct.accountId}
                            className="cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onClick={() => setDetailsAccountId(acct.accountId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setDetailsAccountId(acct.accountId);
                              }
                            }}
                          >
                            <TableCell className="font-medium">
                              <div className="text-slate-900">
                                {acct.accountName}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                                    asOfBadge.className,
                                  )}
                                >
                                  {asOfBadge.label}
                                </span>
                                {acct.startDate ? (
                                  <span className="text-xs text-slate-500">
                                    Since {acct.startDate}
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-slate-900">
                              {formatSek(acct.currentValue)}
                            </TableCell>
                            <TableCell className="text-right text-slate-700">
                              {formatSek(windowed.cashflow.added)}
                            </TableCell>
                            <TableCell className="text-right text-slate-700">
                              {formatSek(windowed.cashflow.withdrawn)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-medium",
                                windowed.growth.amount >= 0
                                  ? "text-emerald-700"
                                  : "text-rose-700",
                              )}
                            >
                              {formatSignedSek(windowed.growth.amount)}
                              {windowed.growth.pct !== null
                                ? ` (${windowed.growth.pct >= 0 ? "+" : ""}${windowed.growth.pct.toFixed(1)}%)`
                                : ""}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  {isLoading
                    ? "Loading accounts…"
                    : "No investment accounts found."}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </StaggerWrap>

      <Sheet
        open={Boolean(detailsAccountId)}
        onOpenChange={(open) => {
          if (!open) setDetailsAccountId(null);
        }}
      >
        <SheetContent side="right" className="bg-white sm:max-w-lg">
          {selectedAccount ? (
            <>
              <SheetHeader className="border-b border-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <SheetTitle className="truncate text-lg">
                      {selectedAccount.accountName}
                    </SheetTitle>
                    <SheetDescription className="mt-1 text-slate-600">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                          freshnessBadge(selectedAccount.asOf).className,
                        )}
                      >
                        {freshnessBadge(selectedAccount.asOf).label}
                      </span>
                      {selectedAccount.startDate ? (
                        <span className="ml-2 text-xs text-slate-500">
                          Since {selectedAccount.startDate}
                        </span>
                      ) : null}
                    </SheetDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openSnapshotDialog(selectedAccount.accountId)
                    }
                  >
                    Update balance
                  </Button>
                </div>
              </SheetHeader>
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-100 bg-white p-3">
                    <div className="text-xs text-slate-500">Current value</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                      {formatSek(selectedAccount.currentValue)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-white p-3 text-right">
                    <div className="text-xs text-slate-500">Start</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 tabular-nums">
                      {selectedAccount.startDate ?? "—"}
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs font-medium text-slate-500 uppercase">
                      Recent deposits & withdrawals
                    </div>
                    <button
                      type="button"
                      className="text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
                      onClick={() => setCashflowsDialogScope("account")}
                    >
                      View all
                    </button>
                  </div>
                  {selectedAccountRecentCashflows.length ? (
                    <div className="mt-3 space-y-2">
                      {selectedAccountRecentCashflows.map((row) => {
                        const occurredAt = String(row.occurred_at);
                        const dateLabel = occurredAt.slice(0, 10);
                        const amount = coerceMoney(row.amount_sek);
                        const isDeposit = row.direction === "deposit";
                        return (
                          <div
                            key={row.transaction_id}
                            className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-slate-900">
                                {dateLabel}
                              </div>
                              <div className="truncate text-xs text-slate-500">
                                {row.description ?? "—"}
                              </div>
                              <Link
                                to={`${PageRoutes.transactions}?search=${encodeURIComponent(
                                  row.transaction_id,
                                )}`}
                                className="mt-1 inline-block truncate font-mono text-[11px] text-slate-500 hover:text-slate-700"
                                title={row.transaction_id}
                              >
                                {row.transaction_id}
                              </Link>
                            </div>
                            <div
                              className={cn(
                                "shrink-0 text-sm font-semibold tabular-nums",
                                isDeposit
                                  ? "text-emerald-700"
                                  : "text-rose-700",
                              )}
                            >
                              {isDeposit ? "+" : "-"}
                              {formatSek(amount)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                      No recent cashflows for this account.
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="text-xs font-medium text-slate-500 uppercase">
                    Since start
                  </div>
                  <div className="mt-2 space-y-2">
                    <MetricRow
                      label="Deposited"
                      value={formatSek(selectedAccount.cashflowSince.added)}
                    />
                    <MetricRow
                      label="Withdrawn"
                      value={formatSek(selectedAccount.cashflowSince.withdrawn)}
                    />
                    <MetricRow
                      label="Net contributions"
                      value={formatSignedSek(selectedAccount.cashflowSince.net)}
                      valueClassName={
                        selectedAccount.cashflowSince.net >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }
                    />
                    <MetricRow
                      label="Market growth"
                      value={
                        <>
                          {formatSignedSek(selectedAccount.growthSince.amount)}{" "}
                          {selectedAccount.growthSince.pct !== null
                            ? `(${selectedAccount.growthSince.pct >= 0 ? "+" : ""}${selectedAccount.growthSince.pct.toFixed(1)}%)`
                            : ""}
                        </>
                      }
                      valueClassName={
                        selectedAccount.growthSince.amount >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="text-xs font-medium text-slate-500 uppercase">
                    Last 12 months
                  </div>
                  <div className="mt-2 space-y-2">
                    <MetricRow
                      label="Deposited"
                      value={formatSek(selectedAccount.cashflow12m.added)}
                    />
                    <MetricRow
                      label="Withdrawn"
                      value={formatSek(selectedAccount.cashflow12m.withdrawn)}
                    />
                    <MetricRow
                      label="Net contributions"
                      value={formatSignedSek(selectedAccount.cashflow12m.net)}
                      valueClassName={
                        selectedAccount.cashflow12m.net >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }
                    />
                    <MetricRow
                      label="Market growth"
                      value={
                        <>
                          {formatSignedSek(selectedAccount.growth12m.amount)}{" "}
                          {selectedAccount.growth12m.pct !== null
                            ? `(${selectedAccount.growth12m.pct >= 0 ? "+" : ""}${selectedAccount.growth12m.pct.toFixed(1)}%)`
                            : ""}
                        </>
                      }
                      valueClassName={
                        selectedAccount.growth12m.amount >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="text-xs font-medium text-slate-500 uppercase">
                    Value over time
                  </div>
                  <div className="mt-3 h-48">
                    {selectedAccount.series.length ? (
                      <ChartContainer
                        className="h-full w-full"
                        config={{
                          value: {
                            label: selectedAccount.accountName,
                            color: "#4f46e5",
                          },
                        }}
                      >
                        <AreaChart
                          data={selectedAccount.series}
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
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
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
                          <Tooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) => (
                                  <span className="font-mono font-medium text-foreground tabular-nums">
                                    {formatSek(Number(value))}
                                  </span>
                                )}
                              />
                            }
                          />
                          <Area
                            type="monotoneX"
                            connectNulls
                            dataKey="value"
                            stroke="var(--color-value)"
                            fill="url(#accountFill)"
                            strokeWidth={2}
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-sm text-slate-600">
                        No snapshots yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-white p-3">
                  <div className="text-xs font-medium text-slate-500 uppercase">
                    Investment transactions (latest)
                  </div>
                  <div className="mt-3">
                    {selectedAccountInvestmentTxs.length ? (
                      <div className="overflow-hidden rounded-md border border-slate-100">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">
                                Amount
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedAccountInvestmentTxs.map((tx) => {
                              const dateLabel = String(tx.occurred_at).slice(
                                0,
                                10,
                              );
                              const amount = coerceMoney(tx.amount_sek);
                              const tone =
                                amount > 0
                                  ? "text-emerald-700"
                                  : amount < 0
                                    ? "text-rose-700"
                                    : "text-slate-700";
                              return (
                                <TableRow key={tx.id}>
                                  <TableCell className="whitespace-nowrap">
                                    {dateLabel}
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap">
                                    {tx.transaction_type}
                                  </TableCell>
                                  <TableCell className="min-w-0">
                                    <div className="truncate">
                                      {tx.description ?? tx.holding_name ?? "—"}
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className={cn(
                                      "text-right font-medium tabular-nums",
                                      tone,
                                    )}
                                  >
                                    {formatSignedSek(amount)}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                        {loading && !transactions.length
                          ? "Loading transactions…"
                          : "No investment transactions found for this account."}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 text-sm text-slate-600">Select an account.</div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={snapshotDialogOpen}
        onOpenChange={(open) => {
          if (updateLoading) return;
          setSnapshotDialogOpen(open);
        }}
      >
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update investment balance</DialogTitle>
            <DialogDescription className="text-slate-600">
              Record the latest statement balance so value changes are captured
              as market growth.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="snapshot-account">Account</Label>
              <select
                id="snapshot-account"
                className="h-10 w-full rounded border border-slate-200 bg-white px-3 text-sm text-slate-800"
                value={snapshotAccountId ?? ""}
                onChange={(e) => setSnapshotAccountId(e.target.value)}
                disabled={updateLoading || !accountSummaries.length}
              >
                <option value="" disabled>
                  Select account
                </option>
                {accountSummaries.map((account) => (
                  <option key={account.accountId} value={account.accountId}>
                    {account.accountName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="snapshot-date">As of date</Label>
              <Input
                id="snapshot-date"
                type="date"
                value={snapshotDate}
                onChange={(e) => setSnapshotDate(e.target.value)}
                disabled={updateLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="snapshot-balance">Reported balance</Label>
              <Input
                id="snapshot-balance"
                inputMode="decimal"
                value={snapshotBalance}
                onChange={(e) => setSnapshotBalance(e.target.value)}
                placeholder={
                  snapshotAccount ? formatSek(snapshotAccount.currentValue) : ""
                }
                disabled={updateLoading || !snapshotAccount}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="snapshot-notes">Notes (optional)</Label>
              <Input
                id="snapshot-notes"
                value={snapshotNotes}
                onChange={(e) => setSnapshotNotes(e.target.value)}
                placeholder="Statement upload, manual update, etc."
                disabled={updateLoading}
              />
            </div>
            {updateError ? (
              <div className="text-sm text-rose-600">{updateError}</div>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSnapshotDialogOpen(false)}
                disabled={updateLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!snapshotAccount) return;
                  createSnapshot({
                    account_id: snapshotAccount.accountId,
                    snapshot_date: snapshotDate,
                    balance: snapshotBalance.trim(),
                    notes: snapshotNotes.trim() || null,
                  });
                  setSnapshotSubmitted(true);
                }}
                disabled={snapshotSubmitDisabled}
              >
                {updateLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save balance"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cashflowsDialogScope !== null}
        onOpenChange={(open) => {
          if (!open) setCashflowsDialogScope(null);
        }}
      >
        <DialogContent className="max-h-[80vh] overflow-y-auto bg-white sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{cashflowsDialogTitle}</DialogTitle>
            <DialogDescription className="text-slate-600">
              Showing all recent deposits and withdrawals in this view.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                {cashflowsDialogItems.length.toLocaleString("sv-SE")}{" "}
                transactions
              </div>
              <Link
                to={PageRoutes.transactions}
                className="text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
              >
                View all transactions
              </Link>
            </div>
            {cashflowsDialogItems.length ? (
              <div className="max-h-[60vh] overflow-y-auto rounded-md border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cashflowsDialogItems.map((row) => {
                      const dateLabel = String(row.occurred_at).slice(0, 10);
                      const isDeposit = row.direction === "deposit";
                      const amount = coerceMoney(row.amount_sek);
                      return (
                        <TableRow key={row.transaction_id}>
                          <TableCell className="font-medium whitespace-nowrap">
                            {dateLabel}
                          </TableCell>
                          <TableCell className="max-w-[14rem] truncate">
                            {row.account_name}
                          </TableCell>
                          <TableCell className="max-w-[22rem] truncate text-slate-600">
                            {row.description ?? "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium",
                                isDeposit
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-rose-50 text-rose-700",
                              )}
                            >
                              {isDeposit ? "Deposit" : "Withdrawal"}
                            </span>
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold tabular-nums",
                              isDeposit ? "text-emerald-700" : "text-rose-700",
                            )}
                          >
                            {isDeposit ? "+" : "-"}
                            {formatSek(amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                No recent cashflows found.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(cashflowDetailsMonth)}
        onOpenChange={(open) => {
          if (!open) setCashflowDetailsMonth(null);
        }}
      >
        <DialogContent className="bg-white sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cashflow drilldown</DialogTitle>
            <DialogDescription className="text-slate-600">
              {cashflowDetailsLabel
                ? `Showing recent deposits/withdrawals for ${cashflowDetailsLabel}.`
                : "Showing recent deposits/withdrawals for the selected month."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Based on the most recent deposits/withdrawals.
              </div>
              <Link
                to={PageRoutes.transactions}
                className="text-xs font-medium text-slate-700 underline underline-offset-4 hover:text-slate-900"
              >
                View all transactions
              </Link>
            </div>
            {cashflowDetailsItems.length ? (
              <div className="max-h-80 space-y-2 overflow-auto pr-1">
                {cashflowDetailsItems.map((row) => {
                  const occurredAt = String(row.occurred_at);
                  const dateLabel = occurredAt.slice(0, 10);
                  const amount = coerceMoney(row.amount_sek);
                  const isDeposit = row.direction === "deposit";
                  return (
                    <div
                      key={row.transaction_id}
                      className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-slate-900">
                          {row.account_name}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                          {dateLabel}
                          {row.description ? ` · ${row.description}` : ""}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "shrink-0 text-sm font-semibold tabular-nums",
                          isDeposit ? "text-emerald-700" : "text-rose-700",
                        )}
                      >
                        {isDeposit ? "+" : "-"}
                        {formatSek(amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                No recent cashflows found for this month.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </MotionPage>
  );
};

export default Investments;
