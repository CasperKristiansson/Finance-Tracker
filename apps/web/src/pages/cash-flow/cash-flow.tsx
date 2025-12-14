import { Loader2, Sparkles, TrendingUp, Wallet } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { PageRoutes } from "@/data/routes";
import { selectToken } from "@/features/auth/authSlice";
import { useAccountsApi, useReportsApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import type {
  CashflowForecastResponse,
  NetWorthProjectionResponse,
} from "@/types/api";
import {
  cashflowForecastResponseSchema,
  netWorthProjectionResponseSchema,
} from "@/types/schemas";

const coerceMoney = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const formatSek = (value: number, digits = 0) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });

const formatSekCompact = (value: number) =>
  value.toLocaleString("sv-SE", {
    style: "currency",
    currency: "SEK",
    notation: "compact",
    maximumFractionDigits: 0,
  });

type Granularity = "monthly" | "quarterly";

type HistoryPoint = {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
};

type ForecastModel = "ensemble" | "seasonal" | "simple";

type DrilldownState =
  | {
      kind: "cashflow";
      point: {
        date: string;
        balance: number;
        delta?: number;
        low?: number;
        high?: number;
        baseline?: number;
        weekdayComponent?: number;
        monthdayComponent?: number;
      };
      meta: {
        startingBalance: number;
        averageDaily: number;
        model?: string;
        lookbackDays?: number;
        residualStd?: number;
      };
    }
  | {
      kind: "net-worth";
      point: {
        date: string;
        netWorth: number;
        low?: number;
        high?: number;
      };
      meta: {
        current: number;
        cagr?: number | null;
        recommendedMethod?: string | null;
        insights?: string[] | null;
        methods?: Record<string, Array<{ date: string; netWorth: number }>>;
      };
    };

export const CashFlow: React.FC = () => {
  const token = useAppSelector(selectToken);
  const { items: accounts, fetchAccounts } = useAccountsApi();
  const { monthly, quarterly, fetchMonthlyReport, fetchQuarterlyReport } =
    useReportsApi();

  const [granularity, setGranularity] = useState<Granularity>("monthly");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);

  const [forecastDays, setForecastDays] = useState(60);
  const [lookbackDays, setLookbackDays] = useState(180);
  const [forecastModel, setForecastModel] = useState<ForecastModel>("ensemble");

  const [cashflowForecast, setCashflowForecast] =
    useState<CashflowForecastResponse | null>(null);
  const [cashflowLoading, setCashflowLoading] = useState(false);
  const [cashflowError, setCashflowError] = useState<string | null>(null);

  const [netWorthProjection, setNetWorthProjection] =
    useState<NetWorthProjectionResponse | null>(null);
  const [netWorthLoading, setNetWorthLoading] = useState(false);
  const [netWorthError, setNetWorthError] = useState<string | null>(null);

  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);

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

  const loadCashflowForecast = useCallback(async () => {
    if (!token) return;
    setCashflowLoading(true);
    setCashflowError(null);
    try {
      const response = await apiFetch<CashflowForecastResponse>({
        path: "/reports/forecast/cashflow",
        token,
        query: {
          days: forecastDays,
          lookback_days: lookbackDays,
          model: forecastModel,
          threshold: 0,
          account_ids: selectedAccounts.length ? selectedAccounts : undefined,
        },
        schema: cashflowForecastResponseSchema,
      });
      setCashflowForecast(response.data);
    } catch (error) {
      setCashflowForecast(null);
      setCashflowError(
        error instanceof Error ? error.message : "Failed to load",
      );
    } finally {
      setCashflowLoading(false);
    }
  }, [forecastDays, forecastModel, lookbackDays, selectedAccounts, token]);

  const loadNetWorthProjection = useCallback(async () => {
    if (!token) return;
    setNetWorthLoading(true);
    setNetWorthError(null);
    try {
      const response = await apiFetch<NetWorthProjectionResponse>({
        path: "/reports/forecast/net-worth",
        token,
        query: {
          months: 36,
          account_ids: selectedAccounts.length ? selectedAccounts : undefined,
        },
        schema: netWorthProjectionResponseSchema,
      });
      setNetWorthProjection(response.data);
    } catch (error) {
      setNetWorthProjection(null);
      setNetWorthError(
        error instanceof Error ? error.message : "Failed to load",
      );
    } finally {
      setNetWorthLoading(false);
    }
  }, [selectedAccounts, token]);

  useEffect(() => {
    loadCashflowForecast();
    loadNetWorthProjection();
  }, [loadCashflowForecast, loadNetWorthProjection]);

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((acc) => acc !== id) : [...prev, id],
    );
  };

  const historyData: HistoryPoint[] = useMemo(() => {
    if (granularity === "monthly") {
      return monthly.data.map((row) => ({
        label: new Date(row.period).toLocaleString("sv-SE", { month: "short" }),
        inflow: Number(row.income),
        outflow: Math.abs(Number(row.expense)),
        net: Number(row.net),
      }));
    }
    return quarterly.data.map((row) => ({
      label: `Q${row.quarter} ${row.year}`,
      inflow: Number(row.income),
      outflow: Math.abs(Number(row.expense)),
      net: Number(row.net),
    }));
  }, [granularity, monthly.data, quarterly.data]);

  const totals = useMemo(() => {
    if (!historyData.length) return { inflow: 0, outflow: 0, net: 0 };
    return historyData.reduce(
      (acc, row) => ({
        inflow: acc.inflow + row.inflow,
        outflow: acc.outflow + row.outflow,
        net: acc.net + row.net,
      }),
      { inflow: 0, outflow: 0, net: 0 },
    );
  }, [historyData]);

  const historyLoading = monthly.loading || quarterly.loading;
  const showHistorySkeleton = historyLoading && historyData.length === 0;

  const cashflowSeries = useMemo(() => {
    const points = cashflowForecast?.points ?? [];
    return points.map((point) => {
      const balance = coerceMoney(point.balance);
      const low = point.low === null ? undefined : coerceMoney(point.low);
      const high = point.high === null ? undefined : coerceMoney(point.high);
      return {
        date: point.date,
        balance,
        delta: point.delta === null ? undefined : coerceMoney(point.delta),
        baseline:
          point.baseline === null ? undefined : coerceMoney(point.baseline),
        weekdayComponent:
          point.weekday_component === null
            ? undefined
            : coerceMoney(point.weekday_component),
        monthdayComponent:
          point.monthday_component === null
            ? undefined
            : coerceMoney(point.monthday_component),
        band:
          low !== undefined && high !== undefined
            ? ([low, high] as [number, number])
            : undefined,
      };
    });
  }, [cashflowForecast]);

  const netWorthSeries = useMemo(() => {
    const points = netWorthProjection?.points ?? [];
    return points.map((point) => {
      const low = point.low === null ? undefined : coerceMoney(point.low);
      const high = point.high === null ? undefined : coerceMoney(point.high);
      return {
        date: point.date,
        netWorth: coerceMoney(point.net_worth),
        band:
          low !== undefined && high !== undefined
            ? ([low, high] as [number, number])
            : undefined,
        low,
        high,
      };
    });
  }, [netWorthProjection]);

  const netWorthMethodSeries = useMemo(() => {
    const methods = netWorthProjection?.methods;
    if (!methods) return undefined;
    const entries = Object.entries(methods);
    const result: Record<
      string,
      Array<{ date: string; netWorth: number }>
    > = {};
    for (const [key, points] of entries) {
      result[key] = points.map((point) => ({
        date: point.date,
        netWorth: coerceMoney(point.net_worth),
      }));
    }
    return result;
  }, [netWorthProjection]);

  const cashflowSummary = useMemo(() => {
    if (!cashflowForecast || cashflowSeries.length === 0) return null;
    const start = coerceMoney(cashflowForecast.starting_balance);
    const avg = coerceMoney(cashflowForecast.average_daily);
    const last = cashflowSeries[cashflowSeries.length - 1]?.balance ?? start;
    return {
      start,
      end: last,
      avgDaily: avg,
      alertAt: cashflowForecast.alert_below_threshold_at || null,
      model: cashflowForecast.model,
      residualStd:
        cashflowForecast.residual_std === null
          ? undefined
          : coerceMoney(cashflowForecast.residual_std),
      lookbackDays: cashflowForecast.lookback_days ?? undefined,
    };
  }, [cashflowForecast, cashflowSeries]);

  const netWorthSummary = useMemo(() => {
    if (!netWorthProjection) return null;
    const current = coerceMoney(netWorthProjection.current);
    const twelve = netWorthSeries[11]?.netWorth;
    const threeYears = netWorthSeries[35]?.netWorth;
    const cagr =
      netWorthProjection.cagr === null
        ? null
        : coerceMoney(netWorthProjection.cagr);
    return {
      current,
      twelve,
      threeYears,
      cagr,
      recommendedMethod: netWorthProjection.recommended_method ?? null,
      insights: netWorthProjection.insights ?? null,
    };
  }, [netWorthProjection, netWorthSeries]);

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
            Rolling forecasts and drilldowns. Tax transactions are excluded —
            see{" "}
            <Link
              to={PageRoutes.taxes}
              className="underline underline-offset-2"
            >
              Taxes
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {[30, 60, 90, 180].map((days) => (
              <Button
                key={days}
                size="sm"
                variant={forecastDays === days ? "default" : "ghost"}
                className="h-8 px-2.5 text-xs"
                onClick={() => setForecastDays(days)}
              >
                {days}d
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {(
              [
                ["ensemble", "Ensemble"],
                ["seasonal", "Seasonal"],
                ["simple", "Simple"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={forecastModel === key ? "default" : "ghost"}
                className="h-8 px-2.5 text-xs"
                onClick={() => setForecastModel(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {[90, 180, 365].map((days) => (
              <Button
                key={days}
                size="sm"
                variant={lookbackDays === days ? "default" : "ghost"}
                className="h-8 px-2.5 text-xs"
                onClick={() => setLookbackDays(days)}
              >
                {days}d
              </Button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              loadCashflowForecast();
              loadNetWorthProjection();
            }}
            disabled={cashflowLoading || netWorthLoading}
          >
            Refresh
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
              {showHistorySkeleton ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                formatSek(item.value)
              )}
              <div className="mt-1 text-xs text-slate-500">
                {item.label === "Net"
                  ? "Inflow minus outflow"
                  : item.label === "Inflow"
                    ? `Across ${historyData.length || "…"} periods`
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

      <div className="grid gap-3 lg:grid-cols-2">
        <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="text-base text-slate-800">
              Rolling cash forecast
            </CardTitle>
            <p className="text-sm text-slate-500">
              Projected running balance for the next {forecastDays} days. Click
              a point to see a drilldown.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-slate-500">Accounts</span>
                <div className="flex flex-wrap gap-1.5">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => toggleAccount(account.id)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs",
                        selectedAccounts.includes(account.id)
                          ? "border-slate-900 bg-slate-900 font-semibold text-white"
                          : "border-slate-200 bg-white text-slate-700",
                      )}
                    >
                      {account.name}
                    </button>
                  ))}
                  {accounts.length === 0 ? (
                    <span className="px-2 py-1 text-xs text-slate-500">
                      No accounts
                    </span>
                  ) : null}
                </div>
              </div>
              {cashflowSummary ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Start{" "}
                    <span className="font-medium text-slate-900">
                      {formatSek(cashflowSummary.start)}
                    </span>
                  </span>
                  <span>
                    End{" "}
                    <span className="font-medium text-slate-900">
                      {formatSek(cashflowSummary.end)}
                    </span>
                  </span>
                  <span className="hidden sm:inline">
                    Avg/day{" "}
                    <span className="font-medium text-slate-900">
                      {formatSek(cashflowSummary.avgDaily, 0)}
                    </span>
                  </span>
                  {cashflowSummary.alertAt ? (
                    <Badge
                      variant="outline"
                      className="border-rose-200 bg-rose-50 text-rose-700"
                    >
                      Below 0 on {cashflowSummary.alertAt}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Healthy</Badge>
                  )}
                </div>
              ) : null}
            </div>

            <div className="h-[320px]">
              {cashflowLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                </div>
              ) : cashflowError ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                  {cashflowError}
                </div>
              ) : cashflowSeries.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                  <Sparkles className="h-6 w-6 text-slate-500" />
                  <p className="text-center text-slate-600">
                    No forecast yet. Import files or add transactions to build
                    history.
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
                <ChartContainer
                  className="h-full w-full"
                  config={{
                    balance: { label: "Balance", color: "#0f172a" },
                    band: { label: "Range", color: "#94a3b8" },
                  }}
                >
                  <AreaChart
                    data={cashflowSeries}
                    margin={{ top: 10, right: 18, left: 0, bottom: 0 }}
                    onClick={(state) => {
                      const payload = state?.activePayload?.[0]?.payload as
                        | (typeof cashflowSeries)[number]
                        | undefined;
                      if (!payload || !cashflowForecast) return;
                      setDrilldown({
                        kind: "cashflow",
                        point: {
                          date: payload.date,
                          balance: payload.balance,
                          delta: payload.delta,
                          low: payload.band?.[0],
                          high: payload.band?.[1],
                          baseline: payload.baseline,
                          weekdayComponent: payload.weekdayComponent,
                          monthdayComponent: payload.monthdayComponent,
                        },
                        meta: {
                          startingBalance: coerceMoney(
                            cashflowForecast.starting_balance,
                          ),
                          averageDaily: coerceMoney(
                            cashflowForecast.average_daily,
                          ),
                          model: cashflowForecast.model ?? undefined,
                          lookbackDays:
                            cashflowForecast.lookback_days ?? undefined,
                          residualStd:
                            cashflowForecast.residual_std === null
                              ? undefined
                              : coerceMoney(cashflowForecast.residual_std),
                        },
                      });
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="cashflowFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--color-band)"
                          stopOpacity={0.25}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--color-band)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        new Date(value as string).toLocaleDateString("sv-SE", {
                          month: "short",
                          day: "2-digit",
                        })
                      }
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      width={90}
                      tickFormatter={(v) => formatSek(Number(v))}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => {
                            if (Array.isArray(value)) return null;
                            if (name === "balance") {
                              return (
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span className="text-slate-500">
                                    Balance
                                  </span>
                                  <span className="font-medium text-slate-900">
                                    {formatSek(Number(value))}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          }}
                          labelFormatter={(label) =>
                            new Date(String(label)).toLocaleDateString(
                              "sv-SE",
                              {
                                weekday: "short",
                                month: "short",
                                day: "2-digit",
                              },
                            )
                          }
                        />
                      }
                    />
                    <Area
                      type="monotoneX"
                      dataKey="band"
                      stroke="none"
                      fill="url(#cashflowFill)"
                      name="Range"
                      isAnimationActive={false}
                      connectNulls
                    />
                    <Area
                      type="monotoneX"
                      dataKey="balance"
                      stroke="var(--color-balance)"
                      strokeWidth={2}
                      fill="none"
                      name="Balance"
                      isAnimationActive={false}
                      connectNulls
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
          <CardHeader className="flex flex-col gap-2">
            <CardTitle className="text-base text-slate-800">
              Net worth estimate (3 years)
            </CardTitle>
            <p className="text-sm text-slate-500">
              Uses multiple methods (moving averages + regression) and picks a
              most likely forecast. Click a point for drilldown.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {netWorthSummary ? (
              <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600 sm:grid-cols-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Current</span>
                  <span className="font-medium text-slate-900">
                    {formatSek(netWorthSummary.current)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">12m</span>
                  <span className="font-medium text-slate-900">
                    {netWorthSummary.twelve !== undefined
                      ? formatSek(netWorthSummary.twelve)
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">3y</span>
                  <span className="font-medium text-slate-900">
                    {netWorthSummary.threeYears !== undefined
                      ? formatSek(netWorthSummary.threeYears)
                      : "—"}
                  </span>
                </div>
                <div className="sm:col-span-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {netWorthSummary.recommendedMethod ? (
                      <Badge variant="secondary">
                        Most likely: {netWorthSummary.recommendedMethod}
                      </Badge>
                    ) : null}
                    {netWorthSummary.cagr !== null &&
                    netWorthSummary.cagr !== undefined ? (
                      <Badge variant="secondary">
                        CAGR{" "}
                        {(netWorthSummary.cagr * 100).toLocaleString("sv-SE", {
                          maximumFractionDigits: 1,
                        })}
                        %
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="h-[320px]">
              {netWorthLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                </div>
              ) : netWorthError ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                  {netWorthError}
                </div>
              ) : netWorthSeries.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-600">
                  Not enough net worth history to forecast.
                </div>
              ) : (
                <ChartContainer
                  className="!aspect-auto h-full w-full"
                  config={{
                    netWorth: { label: "Net worth", color: "#4f46e5" },
                    band: { label: "Range", color: "#a5b4fc" },
                  }}
                >
                  <AreaChart
                    data={netWorthSeries}
                    margin={{ top: 10, right: 18, left: 12, bottom: 0 }}
                    onClick={(state) => {
                      const payload = state?.activePayload?.[0]?.payload as
                        | (typeof netWorthSeries)[number]
                        | undefined;
                      if (!payload || !netWorthProjection) return;

                      setDrilldown({
                        kind: "net-worth",
                        point: {
                          date: payload.date,
                          netWorth: payload.netWorth,
                          low: payload.low,
                          high: payload.high,
                        },
                        meta: {
                          current: coerceMoney(netWorthProjection.current),
                          cagr:
                            netWorthProjection.cagr === null
                              ? null
                              : coerceMoney(netWorthProjection.cagr),
                          recommendedMethod:
                            netWorthProjection.recommended_method ?? null,
                          insights: netWorthProjection.insights ?? null,
                          methods: netWorthMethodSeries,
                        },
                      });
                    }}
                  >
                    <defs>
                      <linearGradient
                        id="netWorthFill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="var(--color-band)"
                          stopOpacity={0.28}
                        />
                        <stop
                          offset="95%"
                          stopColor="var(--color-band)"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(value) =>
                        new Date(value as string).toLocaleDateString("sv-SE", {
                          year: "2-digit",
                          month: "short",
                        })
                      }
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={12}
                      width={120}
                      tickFormatter={(v) => formatSekCompact(Number(v))}
                    />
                    <Tooltip
                      content={
                        <ChartTooltipContent
                          formatter={(_value, _name, item) => {
                            const dataKey = String(item?.dataKey ?? "");
                            const rawValue = item?.value;

                            if (dataKey === "netWorth") {
                              return (
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span className="text-slate-500">
                                    Net worth
                                  </span>
                                  <span className="font-medium text-slate-900">
                                    {formatSek(coerceMoney(rawValue))}
                                  </span>
                                </div>
                              );
                            }

                            if (dataKey === "band" && Array.isArray(rawValue)) {
                              const [low, high] = rawValue as unknown[];
                              return (
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span className="text-slate-500">
                                    Range (~80%)
                                  </span>
                                  <span className="font-medium text-slate-900">
                                    {formatSek(coerceMoney(low))} –{" "}
                                    {formatSek(coerceMoney(high))}
                                  </span>
                                </div>
                              );
                            }

                            return null;
                          }}
                          labelFormatter={(label) =>
                            new Date(String(label)).toLocaleDateString(
                              "sv-SE",
                              {
                                year: "numeric",
                                month: "long",
                              },
                            )
                          }
                        />
                      }
                    />
                    <Area
                      type="monotoneX"
                      dataKey="band"
                      stroke="none"
                      fill="url(#netWorthFill)"
                      name="Range"
                      isAnimationActive={false}
                      connectNulls
                    />
                    <Area
                      type="monotoneX"
                      dataKey="netWorth"
                      stroke="var(--color-netWorth)"
                      strokeWidth={2}
                      fill="none"
                      name="Net worth"
                      isAnimationActive={false}
                      connectNulls
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-[0_16px_40px_-30px_rgba(15,23,42,0.35)]">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-base text-slate-800">
              Cash flow history
            </CardTitle>
            <p className="text-sm text-slate-500">
              Inflow vs outflow — useful for context when sanity-checking the
              forecast.
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
        </CardHeader>
        <CardContent className="h-[320px]">
          {showHistorySkeleton ? (
            <div className="flex h-full flex-col justify-center gap-3">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-48 w-full" />
              <div className="flex gap-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
          ) : !historyLoading && historyData.length === 0 ? (
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
          ) : historyLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
            </div>
          ) : (
            <ChartContainer
              className="h-full w-full"
              config={{
                inflow: { label: "Inflow", color: "var(--chart-2)" },
                outflow: { label: "Outflow", color: "var(--chart-4)" },
                net: { label: "Net", color: "var(--chart-1)" },
              }}
            >
              <AreaChart
                data={historyData}
                margin={{ top: 8, right: 18, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={12}
                  width={90}
                  tickFormatter={(v) => formatSek(Number(v))}
                />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (Array.isArray(value)) return null;
                        const label =
                          name === "inflow"
                            ? "Inflow"
                            : name === "outflow"
                              ? "Outflow"
                              : "Net";
                        return (
                          <div className="flex w-full items-center justify-between gap-2">
                            <span className="text-slate-500">{label}</span>
                            <span className="font-medium text-slate-900">
                              {formatSek(Number(value))}
                            </span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Legend verticalAlign="top" height={34} />
                <Area
                  type="monotoneX"
                  dataKey="inflow"
                  name="Inflow"
                  stroke="var(--color-inflow)"
                  fill="var(--color-inflow)"
                  fillOpacity={0.08}
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotoneX"
                  dataKey="outflow"
                  name="Outflow"
                  stroke="var(--color-outflow)"
                  fill="var(--color-outflow)"
                  fillOpacity={0.06}
                  strokeWidth={2}
                  dot={false}
                />
                <Area
                  type="monotoneX"
                  dataKey="net"
                  name="Net"
                  stroke="var(--color-net)"
                  fill="var(--color-net)"
                  fillOpacity={0.06}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={Boolean(drilldown)}
        onOpenChange={(open) => !open && setDrilldown(null)}
      >
        <SheetContent side="right" className="bg-white sm:max-w-lg">
          {drilldown?.kind === "cashflow" ? (
            <SheetHeader>
              <SheetTitle>Cash forecast drilldown</SheetTitle>
              <SheetDescription>
                {new Date(drilldown.point.date).toLocaleDateString("sv-SE", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "2-digit",
                })}
              </SheetDescription>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Projected balance</span>
                    <span className="font-medium text-slate-900">
                      {formatSek(drilldown.point.balance)}
                    </span>
                  </div>
                  {drilldown.point.low !== undefined &&
                  drilldown.point.high !== undefined ? (
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">Range (~80%)</span>
                      <span className="font-medium text-slate-900">
                        {formatSek(drilldown.point.low)} –{" "}
                        {formatSek(drilldown.point.high)}
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Daily delta</span>
                    <span className="font-medium text-slate-900">
                      {drilldown.point.delta !== undefined
                        ? formatSek(drilldown.point.delta)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Baseline</span>
                    <span className="font-medium text-slate-900">
                      {drilldown.point.baseline !== undefined
                        ? formatSek(drilldown.point.baseline)
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">
                      Seasonality adjustment
                    </span>
                    <span className="font-medium text-slate-900">
                      {drilldown.point.weekdayComponent !== undefined
                        ? formatSek(drilldown.point.weekdayComponent)
                        : "—"}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Model</span>
                    <span className="font-medium text-slate-900">
                      {drilldown.meta.model ?? "—"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-slate-500">Lookback</span>
                    <span className="font-medium text-slate-900">
                      {drilldown.meta.lookbackDays
                        ? `${drilldown.meta.lookbackDays}d`
                        : "—"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <span className="text-slate-500">Residual std</span>
                    <span className="font-medium text-slate-900">
                      {drilldown.meta.residualStd !== undefined
                        ? formatSek(drilldown.meta.residualStd)
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </SheetHeader>
          ) : drilldown?.kind === "net-worth" ? (
            <SheetHeader>
              <SheetTitle>Net worth drilldown</SheetTitle>
              <SheetDescription>
                {new Date(drilldown.point.date).toLocaleDateString("sv-SE", {
                  year: "numeric",
                  month: "long",
                })}
              </SheetDescription>
              <div className="mt-4 grid gap-3 text-sm">
                <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Projected net worth</span>
                    <span className="font-medium text-slate-900">
                      {formatSek(drilldown.point.netWorth)}
                    </span>
                  </div>
                  {drilldown.point.low !== undefined &&
                  drilldown.point.high !== undefined ? (
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-500">Range (~80%)</span>
                      <span className="font-medium text-slate-900">
                        {formatSek(drilldown.point.low)} –{" "}
                        {formatSek(drilldown.point.high)}
                      </span>
                    </div>
                  ) : null}
                </div>

                {drilldown.meta.recommendedMethod ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">
                      Most likely: {drilldown.meta.recommendedMethod}
                    </Badge>
                  </div>
                ) : null}

                {drilldown.meta.methods ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="text-xs tracking-wide text-slate-600 uppercase">
                      Method comparison
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                      {Object.entries(drilldown.meta.methods).map(
                        ([method, points]) => {
                          const match = points.find(
                            (p) => p.date === drilldown.point.date,
                          );
                          if (!match) return null;
                          return (
                            <div
                              key={method}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="text-slate-500">{method}</span>
                              <span className="font-medium text-slate-900">
                                {formatSek(match.netWorth)}
                              </span>
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                ) : null}

                {drilldown.meta.insights?.length ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-sm text-slate-700">
                    <div className="text-xs tracking-wide text-slate-600 uppercase">
                      Notes
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
                      {drilldown.meta.insights.map((insight) => (
                        <li key={insight}>{insight}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </SheetHeader>
          ) : null}
        </SheetContent>
      </Sheet>
    </MotionPage>
  );
};

export default CashFlow;
