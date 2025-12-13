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
import { useAppSelector } from "@/app/hooks";
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
import { selectToken } from "@/features/auth/authSlice";
import { useAccountsApi, useInvestmentsApi } from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import {
  AccountType,
  TransactionType,
  type AccountRead,
  type InvestmentSnapshot,
  type TransactionRead,
} from "@/types/api";
import { transactionListSchema } from "@/types/schemas";

type DerivedHolding = Record<string, unknown> & {
  name?: string;
  quantity?: number | string | null;
  market_value_sek?: number | string | null;
  value_sek?: number | string | null;
  currency?: string | null;
};

const coerceNumber = (value: unknown): number | undefined => {
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
};

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

const toChartId = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);

const extractHoldings = (
  payload?: Record<string, unknown>,
): DerivedHolding[] => {
  if ((payload as { holdings?: unknown })?.holdings) {
    const list = (payload as { holdings: unknown }).holdings;
    if (Array.isArray(list)) {
      return list as DerivedHolding[];
    }
  }
  if (!payload) return [];
  const fromHoldings = (payload as { holdings?: unknown }).holdings;
  const fromRows = (payload as { rows?: unknown }).rows;
  if (Array.isArray(fromHoldings)) return fromHoldings as DerivedHolding[];
  if (Array.isArray(fromRows)) return fromRows as DerivedHolding[];
  return [];
};

const deriveHoldingsValue = (holding: DerivedHolding): number => {
  return (
    coerceNumber(holding.market_value_sek) ??
    coerceNumber(holding.value_sek) ??
    coerceNumber(holding.value) ??
    0
  );
};

const sumHoldings = (payload?: Record<string, unknown>): number => {
  return extractHoldings(payload).reduce(
    (sum, h) => sum + deriveHoldingsValue(h),
    0,
  );
};

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

const deriveSnapshotValue = (snapshot: InvestmentSnapshot): number => {
  const val =
    coerceNumber(snapshot.portfolio_value) ??
    coerceNumber((snapshot as { portfolio_value?: string }).portfolio_value);
  if (val !== undefined) return val;
  if (snapshot.holdings?.length) {
    return snapshot.holdings.reduce(
      (sum, h) => sum + (coerceNumber(h.value_sek) ?? 0),
      0,
    );
  }
  const payload =
    (snapshot.cleaned_payload as Record<string, unknown>) ??
    (snapshot.parsed_payload as Record<string, unknown>);
  return sumHoldings(payload);
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

const getSnapshotHoldings = (
  snapshot: InvestmentSnapshot,
): DerivedHolding[] => {
  if (snapshot.holdings?.length) {
    return snapshot.holdings as DerivedHolding[];
  }
  const payload =
    (snapshot.cleaned_payload as { cleaned_rows?: unknown; holdings?: unknown })
      ?.cleaned_rows ??
    (snapshot.cleaned_payload as { holdings?: unknown })?.holdings ??
    snapshot.parsed_payload;
  if (Array.isArray(payload)) return payload as DerivedHolding[];
  if (payload && typeof payload === "object") {
    if (Array.isArray((payload as { holdings?: unknown }).holdings)) {
      return (payload as { holdings: unknown[] }).holdings as DerivedHolding[];
    }
  }
  return [];
};

export const Investments: React.FC = () => {
  const token = useAppSelector(selectToken);
  const {
    items: accounts,
    loading: accountsLoading,
    fetchAccounts,
  } = useAccountsApi();
  const { snapshots, metrics, loading, fetchSnapshots, fetchMetrics } =
    useInvestmentsApi();

  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [focusedAccount, setFocusedAccount] = useState<string>("ALL");
  const [cashflowRefreshKey, setCashflowRefreshKey] = useState(0);
  const [cashflowTransactions, setCashflowTransactions] = useState<
    TransactionRead[]
  >([]);
  const [cashflowLoading, setCashflowLoading] = useState(false);
  const [cashflowError, setCashflowError] = useState<string | null>(null);
  const [cashflowTruncated, setCashflowTruncated] = useState(false);

  useEffect(() => {
    fetchSnapshots();
    fetchMetrics();
    fetchAccounts();
  }, [fetchAccounts, fetchMetrics, fetchSnapshots]);

  const investmentAccounts = useMemo(() => {
    return (accounts ?? []).filter(
      (account: AccountRead) =>
        account.is_active !== false &&
        account.account_type === AccountType.INVESTMENT,
    );
  }, [accounts]);

  const investmentAccountIds = useMemo(
    () => investmentAccounts.map((acc) => acc.id),
    [investmentAccounts],
  );

  const investmentAccountIdSet = useMemo(
    () => new Set(investmentAccountIds),
    [investmentAccountIds],
  );

  const cashflowWindowStart = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - 365);
    return start.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    const fetchCashflows = async () => {
      const accountIds = investmentAccountIds.join(",");
      if (!token || !accountIds) {
        setCashflowTransactions([]);
        setCashflowError(null);
        setCashflowTruncated(false);
        return;
      }

      setCashflowLoading(true);
      setCashflowError(null);
      setCashflowTruncated(false);

      const all: TransactionRead[] = [];
      const limit = 200;
      let offset = 0;
      const maxPages = 10;

      try {
        for (let page = 0; page < maxPages; page += 1) {
          const { data } = await apiFetch<{
            transactions: TransactionRead[];
          }>({
            path: "/transactions",
            query: {
              start_date: cashflowWindowStart,
              account_ids: accountIds,
              limit,
              offset,
            },
            token,
            schema: transactionListSchema,
          });

          const pageItems = data.transactions ?? [];
          all.push(...pageItems);
          if (pageItems.length < limit) break;
          offset += limit;

          if (page === maxPages - 1) {
            setCashflowTruncated(true);
          }
        }

        setCashflowTransactions(all);
      } catch (err) {
        console.error("Failed to fetch investment cashflows", err);
        setCashflowError(
          err instanceof Error ? err.message : "Failed to load cashflows",
        );
      } finally {
        setCashflowLoading(false);
      }
    };

    void fetchCashflows();
  }, [cashflowRefreshKey, cashflowWindowStart, investmentAccountIds, token]);

  const latestSnapshot = useMemo(() => {
    if (!snapshots.length) return undefined;
    return [...snapshots].sort(
      (a, b) =>
        new Date(b.snapshot_date).getTime() -
        new Date(a.snapshot_date).getTime(),
    )[0];
  }, [snapshots]);

  const portfolioSeries = useMemo(() => {
    const byDate = new Map<
      string,
      Map<string, { snapshot: InvestmentSnapshot; updatedAtMs: number }>
    >();

    snapshots.forEach((snap) => {
      const date = String(snap.snapshot_date).slice(0, 10);
      if (!date) return;
      const accountKey =
        (snap.account_name ?? "Unlabeled").trim() || "Unlabeled";
      const updatedAtMs = new Date(snap.updated_at).getTime();

      const bucket = byDate.get(date) ?? new Map();
      const existing = bucket.get(accountKey);
      if (!existing || updatedAtMs > existing.updatedAtMs) {
        bucket.set(accountKey, { snapshot: snap, updatedAtMs });
      }
      byDate.set(date, bucket);
    });

    const sorted = Array.from(byDate.entries())
      .map(([date, accounts]) => {
        const total = Array.from(accounts.values()).reduce((sum, entry) => {
          return sum + deriveSnapshotValue(entry.snapshot);
        }, 0);
        return { date, value: total };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (!sorted.length) return [];

    const today = new Date().toISOString().slice(0, 10);
    const last = sorted.at(-1);
    const extended =
      last && last.date !== today
        ? [...sorted, { date: today, value: last.value }]
        : sorted;

    return extended.map((row) => ({
      ...row,
      year: new Date(row.date).getFullYear(),
    }));
  }, [snapshots]);

  const totalValue =
    coerceNumber(metrics?.total_value) ??
    coerceNumber(portfolioSeries.at(-1)?.value) ??
    0;
  const invested = coerceNumber(metrics?.invested) ?? 0;
  const realizedPl = coerceNumber(metrics?.realized_pl) ?? 0;
  const unrealizedPl = coerceNumber(metrics?.unrealized_pl) ?? 0;
  const twr = coerceNumber(metrics?.twr);
  const irr = coerceNumber(metrics?.irr);
  const benchmarkChange = coerceNumber(metrics?.benchmarks?.[0]?.change_pct);

  const portfolioDomain = useMemo<[number, number]>(() => {
    if (!portfolioSeries.length) return [0, 0];
    const values = portfolioSeries.map((d) => d.value);
    const max = Math.max(...values);
    const upperPad = Math.abs(max) * 0.05 || 1;
    return [0, max + upperPad];
  }, [portfolioSeries]);

  const portfolioStartValue = coerceNumber(portfolioSeries[0]?.value);
  const portfolioEndValue = coerceNumber(portfolioSeries.at(-1)?.value);
  const portfolioDelta =
    portfolioStartValue !== undefined && portfolioEndValue !== undefined
      ? portfolioEndValue - portfolioStartValue
      : undefined;
  const portfolioDeltaPct =
    portfolioDelta !== undefined && portfolioStartValue
      ? (portfolioDelta / portfolioStartValue) * 100
      : null;

  const accountSummaries = useMemo(() => {
    const byAccount = new Map<
      string,
      Map<string, { snapshot: InvestmentSnapshot; updatedAtMs: number }>
    >();

    snapshots.forEach((snap) => {
      const date = String(snap.snapshot_date).slice(0, 10);
      if (!date) return;
      const accountName =
        (snap.account_name ?? "Unlabeled").trim() || "Unlabeled";
      const updatedAtMs = new Date(snap.updated_at).getTime();

      const bucket = byAccount.get(accountName) ?? new Map();
      const existing = bucket.get(date);
      if (!existing || updatedAtMs > existing.updatedAtMs) {
        bucket.set(date, { snapshot: snap, updatedAtMs });
      }
      byAccount.set(accountName, bucket);
    });

    const summaries = Array.from(byAccount.entries())
      .map(([accountName, dateMap]) => {
        const baseSeries = Array.from(dateMap.entries())
          .map(([date, entry]) => ({
            date,
            snapshot: entry.snapshot,
            value: deriveSnapshotValue(entry.snapshot),
          }))
          .sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
          );

        if (!baseSeries.length) {
          return {
            accountName,
            latestDate: undefined as string | undefined,
            latestValue: 0,
            growth: undefined as number | undefined,
            growthPct: null as number | null,
            holdingsCount: 0,
            snapshotsCount: 0,
            sparkline: [] as { date: string; value: number }[],
          };
        }

        const today = new Date().toISOString().slice(0, 10);
        const last = baseSeries.at(-1);
        const extended =
          last && last.date !== today
            ? [...baseSeries, { ...last, date: today }]
            : baseSeries;

        const latest = extended.at(-1);
        const first = extended[0];
        const latestValue = latest?.value ?? 0;
        const firstValue = first?.value ?? 0;
        const growth = latest && first ? latestValue - firstValue : undefined;
        const growthPct =
          growth !== undefined && firstValue
            ? (growth / firstValue) * 100
            : null;

        const holdingsCount = latest
          ? getSnapshotHoldings(latest.snapshot).length
          : 0;

        return {
          accountName,
          latestDate: latest?.date,
          latestValue,
          growth,
          growthPct,
          holdingsCount,
          snapshotsCount: baseSeries.length,
          sparkline: extended
            .slice(-18)
            .map((p) => ({ date: p.date, value: p.value })),
        };
      })
      .sort((a, b) => b.latestValue - a.latestValue);

    return summaries;
  }, [snapshots]);

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

  const cashflowSummary = useMemo(() => {
    const now = new Date();
    const iso30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const isoYtd = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);

    const byAccountId = new Map<
      string,
      {
        deposits30: number;
        withdrawals30: number;
        depositsYtd: number;
        withdrawalsYtd: number;
        deposits365: number;
        withdrawals365: number;
      }
    >();

    const ensure = (accountId: string) => {
      const existing = byAccountId.get(accountId);
      if (existing) return existing;
      const created = {
        deposits30: 0,
        withdrawals30: 0,
        depositsYtd: 0,
        withdrawalsYtd: 0,
        deposits365: 0,
        withdrawals365: 0,
      };
      byAccountId.set(accountId, created);
      return created;
    };

    cashflowTransactions.forEach((tx) => {
      if (tx.transaction_type !== TransactionType.TRANSFER) return;
      const occurred = String(tx.occurred_at).slice(0, 10);
      const is30 = occurred >= iso30;
      const isYtd = occurred >= isoYtd;
      const is365 = occurred >= cashflowWindowStart;

      tx.legs.forEach((leg) => {
        if (!investmentAccountIdSet.has(leg.account_id)) return;
        const amount = Number(leg.amount);
        if (!Number.isFinite(amount) || amount === 0) return;
        const deposit = amount > 0 ? amount : 0;
        const withdrawal = amount < 0 ? Math.abs(amount) : 0;

        const bucket = ensure(leg.account_id);
        if (is30) {
          bucket.deposits30 += deposit;
          bucket.withdrawals30 += withdrawal;
        }
        if (isYtd) {
          bucket.depositsYtd += deposit;
          bucket.withdrawalsYtd += withdrawal;
        }
        if (is365) {
          bucket.deposits365 += deposit;
          bucket.withdrawals365 += withdrawal;
        }
      });
    });

    const totals = Array.from(byAccountId.values()).reduce(
      (acc, row) => ({
        deposits30: acc.deposits30 + row.deposits30,
        withdrawals30: acc.withdrawals30 + row.withdrawals30,
        depositsYtd: acc.depositsYtd + row.depositsYtd,
        withdrawalsYtd: acc.withdrawalsYtd + row.withdrawalsYtd,
        deposits365: acc.deposits365 + row.deposits365,
        withdrawals365: acc.withdrawals365 + row.withdrawals365,
      }),
      {
        deposits30: 0,
        withdrawals30: 0,
        depositsYtd: 0,
        withdrawalsYtd: 0,
        deposits365: 0,
        withdrawals365: 0,
      },
    );

    return {
      iso30,
      isoYtd,
      byAccountId,
      totals,
      net30: totals.deposits30 - totals.withdrawals30,
      netYtd: totals.depositsYtd - totals.withdrawalsYtd,
      net365: totals.deposits365 - totals.withdrawals365,
    };
  }, [cashflowTransactions, cashflowWindowStart, investmentAccountIdSet]);

  const recentCashTransfers = useMemo(() => {
    const rows = cashflowTransactions
      .filter((tx) => tx.transaction_type === TransactionType.TRANSFER)
      .map((tx) => {
        const investmentAmount = tx.legs.reduce((sum, leg) => {
          if (!investmentAccountIdSet.has(leg.account_id)) return sum;
          const amt = Number(leg.amount);
          return Number.isFinite(amt) ? sum + amt : sum;
        }, 0);
        return {
          id: tx.id,
          occurred_at: tx.occurred_at,
          description: tx.description ?? "",
          amount: investmentAmount,
        };
      })
      .filter((row) => row.amount !== 0)
      .sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
      );

    return rows.slice(0, 12);
  }, [cashflowTransactions, investmentAccountIdSet]);

  const investmentAccountIdByName = useMemo(() => {
    const normalize = (value: string) => value.trim().toLowerCase();
    return new Map(
      investmentAccounts.map((acc) => [normalize(acc.name), acc.id]),
    );
  }, [investmentAccounts]);

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
            onClick={() => {
              fetchSnapshots();
              fetchMetrics();
              fetchAccounts();
              setCashflowRefreshKey((v) => v + 1);
            }}
            disabled={loading || accountsLoading || cashflowLoading}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {loading || accountsLoading || cashflowLoading ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              Loading
            </span>
          ) : null}
          {cashflowError ? (
            <span className="rounded-full bg-rose-50 px-3 py-1 text-sm text-rose-700">
              Cashflow failed to load
            </span>
          ) : null}
        </motion.div>
      </StaggerWrap>

      <StaggerWrap className="grid gap-4 lg:grid-cols-3">
        <motion.div variants={fadeInUp} className="lg:col-span-2">
          <ChartCard
            title="Investments"
            description="Balance over time"
            loading={loading}
            action={
              <div className="text-right">
                <p className="text-xs text-slate-500">Current</p>
                <p className="text-sm font-semibold text-slate-900">
                  {formatSek(totalValue)}
                </p>
                {portfolioDelta !== undefined ? (
                  <p
                    className={cn(
                      "text-xs font-medium",
                      portfolioDelta >= 0
                        ? "text-emerald-700"
                        : "text-rose-700",
                    )}
                  >
                    {portfolioDelta >= 0 ? "+" : ""}
                    {formatCompact(portfolioDelta)}
                    {portfolioDeltaPct !== null
                      ? ` (${portfolioDeltaPct >= 0 ? "+" : ""}${portfolioDeltaPct.toFixed(
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
                No investment snapshots yet.
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
                  {formatSek(totalValue)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Invested</span>
                <span className="font-medium text-slate-900">
                  {formatSek(invested)}
                </span>
              </div>
              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs tracking-wide text-slate-600 uppercase">
                    Cashflow
                  </span>
                  {cashflowTruncated ? (
                    <Badge className="bg-amber-50 text-xs text-amber-700">
                      Truncated
                    </Badge>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Added (30d)</span>
                  <span className="font-medium text-slate-900">
                    {cashflowLoading
                      ? "—"
                      : formatSek(cashflowSummary.totals.deposits30)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Withdrawn (30d)</span>
                  <span className="font-medium text-slate-900">
                    {cashflowLoading
                      ? "—"
                      : formatSek(cashflowSummary.totals.withdrawals30)}
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
                    {cashflowLoading
                      ? "—"
                      : `${cashflowSummary.net30 >= 0 ? "+" : ""}${formatSek(
                          Math.abs(cashflowSummary.net30),
                        )}`}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-slate-500">Added (12m)</span>
                  <span className="font-medium text-slate-900">
                    {cashflowLoading
                      ? "—"
                      : formatSek(cashflowSummary.totals.deposits365)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Withdrawn (12m)</span>
                  <span className="font-medium text-slate-900">
                    {cashflowLoading
                      ? "—"
                      : formatSek(cashflowSummary.totals.withdrawals365)}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Unrealized P/L</span>
                <span
                  className={cn(
                    "font-medium",
                    unrealizedPl >= 0 ? "text-emerald-700" : "text-rose-700",
                  )}
                >
                  {unrealizedPl >= 0 ? "+" : ""}
                  {formatSek(unrealizedPl)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Realized P/L</span>
                <span className="font-medium text-slate-900">
                  {realizedPl >= 0 ? "+" : ""}
                  {formatSek(realizedPl)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">TWR</span>
                <span className="font-medium text-slate-900">
                  {twr !== undefined && twr !== null
                    ? `${(twr * 100).toFixed(1)}%`
                    : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">IRR</span>
                <span className="font-medium text-slate-900">
                  {irr !== undefined && irr !== null
                    ? `${(irr * 100).toFixed(1)}%`
                    : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Benchmark</span>
                <span className="font-medium text-slate-900">
                  {benchmarkChange !== undefined && benchmarkChange !== null
                    ? `${(benchmarkChange * 100).toFixed(1)}%`
                    : "-"}
                </span>
              </div>
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
                      {acct.growth !== undefined ? (
                        <Badge
                          className={cn(
                            "text-xs",
                            acct.growth >= 0
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700",
                          )}
                        >
                          {acct.growth >= 0 ? "+" : ""}
                          {formatCompact(acct.growth)}
                          {acct.growthPct !== null
                            ? ` (${acct.growthPct >= 0 ? "+" : ""}${acct.growthPct.toFixed(
                                1,
                              )}%)`
                            : ""}
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-xs text-slate-700">
                          First snapshot
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {acct.holdingsCount}{" "}
                        {acct.holdingsCount === 1 ? "holding" : "holdings"}
                      </span>
                      <span>
                        {acct.latestDate ? `As of ${acct.latestDate}` : "-"}
                      </span>
                    </div>
                    {(() => {
                      const accountId = investmentAccountIdByName.get(
                        acct.accountName.trim().toLowerCase(),
                      );
                      if (!accountId) return null;
                      const flow = cashflowSummary.byAccountId.get(accountId);
                      if (!flow) return null;
                      const net = flow.deposits365 - flow.withdrawals365;
                      return (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500">Net flow (12m)</span>
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              net >= 0 ? "text-emerald-700" : "text-rose-700",
                            )}
                          >
                            {net >= 0 ? "+" : ""}
                            {formatSek(Math.abs(net))}
                          </span>
                        </div>
                      );
                    })()}
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
                    <p className="text-xs text-slate-500">
                      {acct.snapshotsCount}{" "}
                      {acct.snapshotsCount === 1 ? "snapshot" : "snapshots"}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.div variants={fadeInUp}>
            <Card className="border-dashed border-slate-200 bg-slate-50/70">
              <CardContent className="py-8 text-center text-sm text-slate-600">
                No investment snapshots yet.
              </CardContent>
            </Card>
          </motion.div>
        )}
      </StaggerWrap>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-800">
              Added / withdrawn (cash transfers)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cashflowLoading ? (
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
            ) : investmentAccounts.length ? (
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
                  {investmentAccounts.map((account) => {
                    const flow = cashflowSummary.byAccountId.get(
                      account.id,
                    ) ?? {
                      deposits30: 0,
                      withdrawals30: 0,
                      depositsYtd: 0,
                      withdrawalsYtd: 0,
                      deposits365: 0,
                      withdrawals365: 0,
                    };
                    const net12m = flow.deposits365 - flow.withdrawals365;
                    const net30 = flow.deposits30 - flow.withdrawals30;
                    return (
                      <TableRow key={account.id}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col">
                            <span className="text-slate-900">
                              {account.name}
                            </span>
                            <span
                              className={cn(
                                "text-xs",
                                net30 >= 0
                                  ? "text-emerald-700"
                                  : "text-rose-700",
                              )}
                            >
                              30d: {net30 >= 0 ? "+" : "-"}
                              {formatSek(Math.abs(net30))}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatSek(flow.deposits365)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatSek(flow.withdrawals365)}
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-800">
                Latest snapshot holdings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {latestSnapshot ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Holding</TableHead>
                      <TableHead className="text-right">Value (SEK)</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {getSnapshotHoldings(latestSnapshot).map((holding, idx) => (
                      <TableRow key={`${latestSnapshot.id}-${idx}`}>
                        <TableCell className="font-medium">
                          {(holding.name as string) ?? "Unknown"}
                        </TableCell>
                        <TableCell className="text-right">
                          {deriveHoldingsValue(holding).toLocaleString(
                            "sv-SE",
                            {
                              maximumFractionDigits: 0,
                            },
                          )}
                        </TableCell>
                        <TableCell className="text-right text-slate-500">
                          {holding.quantity ?? "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : loading ? (
                <div className="space-y-2">
                  <div className="h-5 w-24 animate-pulse rounded bg-slate-200" />
                  <div className="space-y-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-8 animate-pulse rounded bg-slate-100"
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Save a snapshot to see holdings here.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)]">
            <CardHeader className="flex items-center justify-between pb-2">
              <CardTitle className="text-sm text-slate-800">
                Recent cash transfers
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  exportCsv(
                    recentCashTransfers.map((tx) => ({
                      date: tx.occurred_at,
                      direction: tx.amount >= 0 ? "Added" : "Withdrawn",
                      description: tx.description || "",
                      amount_sek: Math.abs(tx.amount),
                    })),
                    "investment-cash-transfers.csv",
                  )
                }
                disabled={!recentCashTransfers.length}
              >
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {recentCashTransfers.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Direction</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount (SEK)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentCashTransfers.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-slate-600">
                          {tx.occurred_at.slice(0, 10)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-slate-700",
                            tx.amount >= 0
                              ? "text-emerald-700"
                              : "text-rose-700",
                          )}
                        >
                          {tx.amount >= 0 ? "Added" : "Withdrawn"}
                        </TableCell>
                        <TableCell className="text-slate-800">
                          {tx.description || "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right",
                            tx.amount >= 0
                              ? "text-emerald-700"
                              : "text-rose-700",
                          )}
                        >
                          {tx.amount >= 0 ? "+" : "-"}
                          {formatSek(Math.abs(tx.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-slate-500">
                  {cashflowLoading
                    ? "Loading cash transfers…"
                    : "No cash transfers found in the last 12 months."}
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
