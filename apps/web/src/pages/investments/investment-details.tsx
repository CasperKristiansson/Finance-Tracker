import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageRoutes } from "@/data/routes";
import { selectToken } from "@/features/auth/authSlice";
import { useInvestmentsApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import { compactCurrency, currency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { EndpointResponse } from "@/types/contracts";

const formatSek = (value: number) => currency(value);
const formatCompact = (value: number) => compactCurrency(value);

const formatSignedSek = (value: number) =>
  `${value >= 0 ? "+" : "-"}${formatSek(Math.abs(value))}`;

type DetailRange = "ytd" | "12m" | "3y" | "5y" | "all";

const DETAIL_RANGE_LABEL: Record<DetailRange, string> = {
  ytd: "YTD",
  "12m": "12M",
  "3y": "3Y",
  "5y": "5Y",
  all: "Total",
};

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

const subtractYearsInclusiveIso = (date: Date, years: number) => {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() - years);
  result.setDate(result.getDate() + 1);
  return result.toISOString().slice(0, 10);
};

const monthKeyFromIso = (isoDate: string): number | null => {
  const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 0 || month > 11) return null;
  return year * 12 + month;
};

const monthKeyToIso = (monthKey: number): string => {
  const year = Math.floor(monthKey / 12);
  const month = (monthKey % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
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

export const InvestmentDetails: React.FC = () => {
  const { accountId } = useParams<{ accountId: string }>();
  const token = useAppSelector(selectToken);
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => today.toISOString().slice(0, 10), [today]);
  const {
    overview,
    loading,
    error,
    updateLoading,
    updateError,
    fetchOverview,
    createSnapshot,
  } = useInvestmentsApi();

  const [performanceWindow, setPerformanceWindow] = useState<"since" | "12m">(
    "12m",
  );
  const [detailRange, setDetailRange] = useState<DetailRange>("12m");
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [snapshotBalance, setSnapshotBalance] = useState("");
  const [snapshotDate, setSnapshotDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [snapshotNotes, setSnapshotNotes] = useState("");
  const [snapshotSubmitted, setSnapshotSubmitted] = useState(false);

  const [cashflowForecastLoading, setCashflowForecastLoading] = useState(false);
  const [cashflowForecastError, setCashflowForecastError] = useState<
    string | null
  >(null);
  const [cashflowForecast, setCashflowForecast] =
    useState<EndpointResponse<"cashflowForecast"> | null>(null);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const account = useMemo(() => {
    if (!accountId) return null;
    return (
      (overview?.accounts ?? []).find(
        (item) => item.account_id === accountId,
      ) ?? null
    );
  }, [accountId, overview?.accounts]);

  const accountSeries = useMemo(() => {
    const raw = account?.series ?? [];
    return raw
      .map((point) => ({
        date: String(point.date).slice(0, 10),
        value: coerceMoney(point.value),
      }))
      .filter((point) => Boolean(point.date))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [account?.series]);

  const detailRangeStartIso = useMemo(() => {
    const currentYear = today.getFullYear();
    if (detailRange === "ytd") return `${currentYear}-01-01`;
    if (detailRange === "12m") return subtractYearsInclusiveIso(today, 1);
    if (detailRange === "3y") return subtractYearsInclusiveIso(today, 3);
    if (detailRange === "5y") return subtractYearsInclusiveIso(today, 5);
    return null;
  }, [detailRange, today]);

  const detailRangeLabel = DETAIL_RANGE_LABEL[detailRange];
  const detailRangeWindowLabel =
    detailRangeStartIso === null
      ? "All available history"
      : `${detailRangeStartIso} → ${todayIso}`;

  const visibleAccountSeries = useMemo(
    () =>
      accountSeries.filter((point) => {
        if (detailRangeStartIso && point.date < detailRangeStartIso)
          return false;
        return point.date <= todayIso;
      }),
    [accountSeries, detailRangeStartIso, todayIso],
  );

  const accountAsOf = toIsoDate(account?.as_of);
  const accountStartDate = toIsoDate(account?.start_date);
  const accountFreshness = freshnessBadge(accountAsOf);
  const accountCurrentValue = coerceMoney(account?.current_value);

  const accountCashflows = useMemo(
    () =>
      (overview?.recent_cashflows ?? [])
        .filter((row) => row.account_id === accountId)
        .filter((row) => {
          const occurredAt = toIsoDate(row.occurred_at);
          if (!occurredAt) return false;
          if (detailRangeStartIso && occurredAt < detailRangeStartIso)
            return false;
          return occurredAt <= todayIso;
        })
        .sort((a, b) =>
          String(b.occurred_at).localeCompare(String(a.occurred_at)),
        ),
    [accountId, detailRangeStartIso, overview?.recent_cashflows, todayIso],
  );

  const accountDomain = useMemo<[number, number]>(() => {
    if (!visibleAccountSeries.length) return [0, 0];
    const values = visibleAccountSeries.map((point) => point.value);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = Math.max(1, max - min);
    const lower = Math.max(0, min - span * 0.08);
    const upper = max + span * 0.08;
    return [lower, upper];
  }, [visibleAccountSeries]);

  useEffect(() => {
    if (!accountId || !token) {
      setCashflowForecast(null);
      return;
    }

    let cancelled = false;
    setCashflowForecastLoading(true);
    setCashflowForecastError(null);

    const loadForecasts = async () => {
      const cashflowPromise = apiFetch<EndpointResponse<"cashflowForecast">>(
        buildEndpointRequest("cashflowForecast", {
          query: { days: 120, account_ids: [accountId] },
          token,
        }),
      );

      const cashflowResult = await cashflowPromise;

      if (cancelled) return;
      try {
        setCashflowForecast(cashflowResult.data);
      } catch {
        setCashflowForecast(null);
        setCashflowForecastError("Unable to load cashflow forecast.");
      }
      setCashflowForecastLoading(false);
    };

    void loadForecasts().catch(() => {
      if (cancelled) return;
      setCashflowForecast(null);
      setCashflowForecastError("Unable to load cashflow forecast.");
      setCashflowForecastLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [accountId, token]);

  useEffect(() => {
    if (!snapshotDialogOpen) return;
    setSnapshotDate(new Date().toISOString().slice(0, 10));
    setSnapshotNotes("");
    setSnapshotSubmitted(false);
    setSnapshotBalance(
      accountCurrentValue ? accountCurrentValue.toFixed(2) : "",
    );
  }, [accountCurrentValue, snapshotDialogOpen]);

  useEffect(() => {
    if (!snapshotSubmitted) return;
    if (updateLoading) return;
    if (updateError) return;
    toast.success(
      account ? `${account.name} balance updated.` : "Balance updated.",
    );
    setSnapshotDialogOpen(false);
    setSnapshotSubmitted(false);
  }, [account, snapshotSubmitted, updateError, updateLoading]);

  const snapshotSubmitDisabled =
    updateLoading || !accountId || !snapshotDate || !snapshotBalance.trim();

  const cashflowPoints = useMemo(() => {
    return (cashflowForecast?.points ?? [])
      .map((point) => ({
        date: String(point.date).slice(0, 10),
        balance: coerceMoney(point.balance),
        low:
          point.low !== null && point.low !== undefined
            ? coerceMoney(point.low)
            : null,
        high:
          point.high !== null && point.high !== undefined
            ? coerceMoney(point.high)
            : null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [cashflowForecast?.points]);

  const cashflowDomain = useMemo<[number, number]>(() => {
    if (!cashflowPoints.length) return [0, 0];
    const allValues = cashflowPoints.flatMap((point) =>
      [point.low, point.balance, point.high].filter(
        (value): value is number => typeof value === "number",
      ),
    );
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const threshold = coerceMoney(cashflowForecast?.threshold);
    const span = Math.max(
      1,
      Math.max(max, threshold) - Math.min(min, threshold),
    );
    return [
      Math.max(0, Math.min(min, threshold) - span * 0.08),
      Math.max(max, threshold) + span * 0.08,
    ];
  }, [cashflowForecast?.threshold, cashflowPoints]);

  const momentumRows = useMemo(() => {
    if (!accountSeries.length) return [];

    const monthlyEndValues = new Map<number, number>();
    accountSeries.forEach((point) => {
      const monthKey = monthKeyFromIso(point.date);
      if (monthKey === null) return;
      monthlyEndValues.set(monthKey, point.value);
    });

    const monthKeys = [...monthlyEndValues.keys()].sort((a, b) => a - b);
    const includeYear =
      detailRange === "3y" || detailRange === "5y" || detailRange === "all";

    const rows: Array<{ month: string; value: number; monthIso: string }> = [];
    let previousValue: number | null = null;

    monthKeys.forEach((monthKey) => {
      const monthIso = monthKeyToIso(monthKey);
      const monthEndValue = monthlyEndValues.get(monthKey);
      if (typeof monthEndValue !== "number") return;

      const delta = previousValue === null ? 0 : monthEndValue - previousValue;
      previousValue = monthEndValue;

      if (detailRangeStartIso && monthIso < detailRangeStartIso) return;

      const label = new Date(`${monthIso}T00:00:00Z`).toLocaleDateString(
        "en-US",
        includeYear ? { month: "short", year: "2-digit" } : { month: "short" },
      );

      rows.push({
        month: label,
        value: delta,
        monthIso,
      });
    });

    return rows;
  }, [accountSeries, detailRange, detailRangeStartIso]);

  const insights = useMemo(() => {
    const rows: string[] = [];
    if (visibleAccountSeries.length >= 2) {
      const first = visibleAccountSeries[0].value;
      const last = visibleAccountSeries[visibleAccountSeries.length - 1].value;
      const change = last - first;
      const pct = first > 0 ? (change / first) * 100 : null;
      rows.push(
        pct !== null
          ? `${detailRangeLabel} value changed ${formatSignedSek(change)} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%).`
          : `${detailRangeLabel} value changed ${formatSignedSek(change)}.`,
      );
    }

    if (momentumRows.length) {
      const best = [...momentumRows].sort((a, b) => b.value - a.value)[0];
      const worst = [...momentumRows].sort((a, b) => a.value - b.value)[0];
      if (best)
        rows.push(
          `Best month (${detailRangeLabel}): ${best.month} (${formatSignedSek(best.value)}).`,
        );
      if (worst)
        rows.push(
          `Weakest month (${detailRangeLabel}): ${worst.month} (${formatSignedSek(worst.value)}).`,
        );
    }

    const netInRange = accountCashflows.reduce((sum, row) => {
      const amount = coerceMoney(row.amount_sek);
      return row.direction === "deposit" ? sum + amount : sum - amount;
    }, 0);
    rows.push(
      `Net contributions (${detailRangeLabel}): ${formatSignedSek(netInRange)}.`,
    );

    return rows;
  }, [accountCashflows, detailRangeLabel, momentumRows, visibleAccountSeries]);

  const visibleKpis =
    performanceWindow === "since"
      ? {
          added: coerceMoney(account?.cashflow_since_start_added),
          withdrawn: coerceMoney(account?.cashflow_since_start_withdrawn),
          net: coerceMoney(account?.cashflow_since_start_net),
          growthAmount: coerceMoney(
            account?.growth_since_start_ex_transfers.amount,
          ),
          growthPct: account?.growth_since_start_ex_transfers.pct ?? null,
        }
      : {
          added: coerceMoney(account?.cashflow_12m_added),
          withdrawn: coerceMoney(account?.cashflow_12m_withdrawn),
          net:
            coerceMoney(account?.cashflow_12m_added) -
            coerceMoney(account?.cashflow_12m_withdrawn),
          growthAmount: coerceMoney(account?.growth_12m_ex_transfers.amount),
          growthPct: account?.growth_12m_ex_transfers.pct ?? null,
        };

  const isLoading = loading && !overview;

  if (!accountId) {
    return (
      <MotionPage>
        <Card className="border-slate-200">
          <CardContent className="py-6 text-sm text-slate-600">
            Missing account id in URL.
          </CardContent>
        </Card>
      </MotionPage>
    );
  }

  return (
    <MotionPage className="space-y-6">
      <StaggerWrap className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <motion.div variants={fadeInUp} className="space-y-2">
          <Link
            to={PageRoutes.investments}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to investments
          </Link>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Investment account
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {account?.name ?? "Loading account…"}
          </h1>
          <p className="text-sm text-slate-500">
            Detailed trajectory, momentum, and forecast insights for this
            account.
          </p>
        </motion.div>
        <motion.div
          variants={fadeInUp}
          className="flex flex-col items-end gap-2"
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-slate-500">
              {detailRangeWindowLabel}
            </span>
            <Tabs
              value={detailRange}
              onValueChange={(value) => setDetailRange(value as DetailRange)}
              className="w-auto"
            >
              <TabsList className="h-9 bg-slate-100">
                <TabsTrigger value="ytd" className="cursor-pointer text-xs">
                  YTD
                </TabsTrigger>
                <TabsTrigger value="12m" className="cursor-pointer text-xs">
                  12M
                </TabsTrigger>
                <TabsTrigger value="3y" className="cursor-pointer text-xs">
                  3Y
                </TabsTrigger>
                <TabsTrigger value="5y" className="cursor-pointer text-xs">
                  5Y
                </TabsTrigger>
                <TabsTrigger value="all" className="cursor-pointer text-xs">
                  Total
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={() => setSnapshotDialogOpen(true)}
              disabled={!account}
            >
              Update balance
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchOverview();
              }}
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
                Failed to load investment data
              </span>
            ) : null}
          </div>
        </motion.div>
      </StaggerWrap>

      {isLoading ? (
        <StaggerWrap className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-28 lg:col-span-1" />
          <Skeleton className="h-28 lg:col-span-1" />
          <Skeleton className="h-28 lg:col-span-1" />
          <Skeleton className="h-96 lg:col-span-3" />
        </StaggerWrap>
      ) : !account ? (
        <Card className="border-slate-200">
          <CardContent className="space-y-3 py-6 text-sm text-slate-600">
            <p>This investment account was not found.</p>
            <Button asChild size="sm" variant="outline">
              <Link to={PageRoutes.investments}>Go back</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <StaggerWrap className="grid gap-4 lg:grid-cols-3">
            <motion.div variants={fadeInUp} {...subtleHover}>
              <Card className="h-full border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Current value
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-2xl font-semibold text-slate-900 tabular-nums">
                    {formatSek(accountCurrentValue)}
                  </p>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium",
                      accountFreshness.className,
                    )}
                  >
                    {accountFreshness.label}
                  </span>
                  {accountStartDate ? (
                    <p className="text-xs text-slate-500">
                      Since {accountStartDate}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp} {...subtleHover}>
              <Card className="h-full border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Period performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Tabs
                    value={performanceWindow}
                    onValueChange={(value) =>
                      setPerformanceWindow(value as "since" | "12m")
                    }
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="since">Since start</TabsTrigger>
                      <TabsTrigger value="12m">12m</TabsTrigger>
                    </TabsList>
                    <TabsContent value="since" className="mt-3 space-y-2">
                      <MetricRow
                        label="Deposited"
                        value={formatSek(visibleKpis.added)}
                      />
                      <MetricRow
                        label="Withdrawn"
                        value={formatSek(visibleKpis.withdrawn)}
                      />
                      <MetricRow
                        label="Net contributions"
                        value={formatSignedSek(visibleKpis.net)}
                        valueClassName={
                          visibleKpis.net >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }
                      />
                      <MetricRow
                        label="Market growth"
                        value={
                          <>
                            {formatSignedSek(visibleKpis.growthAmount)}{" "}
                            {visibleKpis.growthPct !== null
                              ? `(${visibleKpis.growthPct >= 0 ? "+" : ""}${visibleKpis.growthPct.toFixed(1)}%)`
                              : ""}
                          </>
                        }
                        valueClassName={
                          visibleKpis.growthAmount >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }
                      />
                    </TabsContent>
                    <TabsContent value="12m" className="mt-3 space-y-2">
                      <MetricRow
                        label="Deposited"
                        value={formatSek(visibleKpis.added)}
                      />
                      <MetricRow
                        label="Withdrawn"
                        value={formatSek(visibleKpis.withdrawn)}
                      />
                      <MetricRow
                        label="Net contributions"
                        value={formatSignedSek(visibleKpis.net)}
                        valueClassName={
                          visibleKpis.net >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }
                      />
                      <MetricRow
                        label="Market growth"
                        value={
                          <>
                            {formatSignedSek(visibleKpis.growthAmount)}{" "}
                            {visibleKpis.growthPct !== null
                              ? `(${visibleKpis.growthPct >= 0 ? "+" : ""}${visibleKpis.growthPct.toFixed(1)}%)`
                              : ""}
                          </>
                        }
                        valueClassName={
                          visibleKpis.growthAmount >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp} {...subtleHover}>
              <Card className="h-full border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Quick insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {insights.map((insight) => (
                    <div
                      key={insight}
                      className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                    >
                      {insight}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </StaggerWrap>

          <StaggerWrap className="grid gap-4 lg:grid-cols-3">
            <motion.div
              variants={fadeInUp}
              className="lg:col-span-2"
              {...subtleHover}
            >
              <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Value trajectory ({detailRangeLabel})
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-80 md:h-96">
                  {visibleAccountSeries.length ? (
                    <ChartContainer
                      className="h-full w-full"
                      config={{
                        value: {
                          label: account.name,
                          color: "#2563eb",
                        },
                      }}
                    >
                      <AreaChart
                        data={visibleAccountSeries}
                        margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="detailAccountFill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#2563eb"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#2563eb"
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
                              year: "2-digit",
                            })
                          }
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          domain={accountDomain}
                          allowDataOverflow
                          tickMargin={12}
                          width={90}
                          tickFormatter={(value) =>
                            formatCompact(Number(value))
                          }
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
                          fill="url(#detailAccountFill)"
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-600">
                      No snapshots in the selected range.
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={fadeInUp} {...subtleHover}>
              <Card className="h-full border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Recent cashflows
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {accountCashflows.length ? (
                    accountCashflows.slice(0, 10).map((row) => {
                      const isDeposit = row.direction === "deposit";
                      const amount = coerceMoney(row.amount_sek);
                      return (
                        <div
                          key={row.transaction_id}
                          className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-slate-900">
                              {String(row.occurred_at).slice(0, 10)}
                            </div>
                            <div className="truncate text-xs text-slate-500">
                              {row.description ?? "—"}
                            </div>
                          </div>
                          <div
                            className={cn(
                              "shrink-0 text-sm font-semibold tabular-nums",
                              isDeposit ? "text-emerald-700" : "text-rose-700",
                            )}
                          >
                            {isDeposit ? (
                              <TrendingUp className="mr-1 inline h-3.5 w-3.5" />
                            ) : (
                              <TrendingDown className="mr-1 inline h-3.5 w-3.5" />
                            )}
                            {isDeposit ? "+" : "-"}
                            {formatSek(amount)}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                      No recent deposits or withdrawals for this account.
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </StaggerWrap>

          <StaggerWrap className="grid gap-4">
            <motion.div variants={fadeInUp} {...subtleHover}>
              <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Cashflow runway forecast
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Projected balance trajectory over the next 120 days.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">Starting</div>
                      <div className="font-semibold text-slate-900 tabular-nums">
                        {formatSek(
                          coerceMoney(cashflowForecast?.starting_balance),
                        )}
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                      <div className="text-slate-500">Avg daily</div>
                      <div className="font-semibold text-slate-900 tabular-nums">
                        {formatSignedSek(
                          coerceMoney(cashflowForecast?.average_daily),
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="h-56">
                    {cashflowForecastLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : cashflowPoints.length ? (
                      <ChartContainer
                        className="h-full w-full"
                        config={{
                          balance: {
                            label: "Forecast balance",
                            color: "#0f766e",
                          },
                          threshold: { label: "Threshold", color: "#ef4444" },
                        }}
                      >
                        <LineChart
                          data={cashflowPoints}
                          margin={{ left: 0, right: 0, top: 10 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(value) =>
                              new Date(value).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                            }
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            domain={cashflowDomain}
                            tickMargin={12}
                            width={90}
                            tickFormatter={(value) =>
                              formatCompact(Number(value))
                            }
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
                          <ReferenceLine
                            y={coerceMoney(cashflowForecast?.threshold)}
                            stroke="var(--color-threshold)"
                            strokeDasharray="4 4"
                          />
                          <Line
                            type="monotone"
                            dataKey="balance"
                            stroke="var(--color-balance)"
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-600">
                        {cashflowForecastError ??
                          "No cashflow forecast available."}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </StaggerWrap>

          <StaggerWrap className="grid gap-4">
            <motion.div variants={fadeInUp} {...subtleHover}>
              <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Monthly momentum
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Month-by-month balance movement for {detailRangeLabel}.
                  </p>
                </CardHeader>
                <CardContent className="h-72">
                  {momentumRows.length ? (
                    <ChartContainer
                      className="h-full w-full"
                      config={{
                        value: { label: "Monthly change", color: "#2563eb" },
                      }}
                    >
                      <BarChart
                        data={momentumRows}
                        margin={{ left: 0, right: 0, top: 10 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={12}
                          width={90}
                          tickFormatter={(value) =>
                            formatCompact(Number(value))
                          }
                        />
                        <Tooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) => (
                                <span className="font-mono font-medium text-foreground tabular-nums">
                                  {formatSignedSek(Number(value))}
                                </span>
                              )}
                            />
                          }
                        />
                        <Bar
                          dataKey="value"
                          radius={[4, 4, 0, 0]}
                          fill="var(--color-value)"
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border border-slate-100 bg-slate-50 text-sm text-slate-600">
                      No monthly momentum data available in this range.
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </StaggerWrap>
        </>
      )}

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
              Record the latest statement balance for this account.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Account</Label>
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {account?.name ?? "Unknown account"}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="snapshot-date">As of date</Label>
              <Input
                id="snapshot-date"
                type="date"
                value={snapshotDate}
                onChange={(event) => setSnapshotDate(event.target.value)}
                disabled={updateLoading}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="snapshot-balance">Reported balance</Label>
              <Input
                id="snapshot-balance"
                inputMode="decimal"
                value={snapshotBalance}
                onChange={(event) => setSnapshotBalance(event.target.value)}
                disabled={updateLoading}
                placeholder={formatSek(accountCurrentValue)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="snapshot-notes">Notes (optional)</Label>
              <Input
                id="snapshot-notes"
                value={snapshotNotes}
                onChange={(event) => setSnapshotNotes(event.target.value)}
                placeholder="Statement import, manual correction, etc."
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
                disabled={snapshotSubmitDisabled}
                onClick={() => {
                  if (!accountId) return;
                  createSnapshot({
                    account_id: accountId,
                    snapshot_date: snapshotDate,
                    balance: snapshotBalance.trim(),
                    notes: snapshotNotes.trim() || null,
                  });
                  setSnapshotSubmitted(true);
                }}
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
    </MotionPage>
  );
};

export default InvestmentDetails;
