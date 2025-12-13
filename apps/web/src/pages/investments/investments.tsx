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
import { useAccountsApi, useInvestmentsApi } from "@/hooks/use-api";
import { cn } from "@/lib/utils";
import {
  AccountType,
  type AccountRead,
  type InvestmentSnapshot,
  type InvestmentTransactionRead,
} from "@/types/api";

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

const formatSignedSek = (value: number) =>
  `${value >= 0 ? "+" : "-"}${formatSek(Math.abs(value))}`;

const classifyCashflowType = (
  tx: InvestmentTransactionRead,
): "deposit" | "withdrawal" | null => {
  const type = String(tx.transaction_type ?? "").toLowerCase();
  const description = String(tx.description ?? "").toLowerCase();
  const combined = `${type} ${description}`.trim();

  const amount = Number(tx.amount_sek ?? 0);
  const quantity = tx.quantity;
  const hasQuantity = quantity !== null && Number(quantity) !== 0;
  const hasHolding =
    Boolean(tx.holding_name) || Boolean(tx.isin) || hasQuantity;

  if (
    combined.includes("insätt") ||
    combined.includes("insatt") ||
    combined.includes("deposit") ||
    combined.includes("inbetal")
  ) {
    return "deposit";
  }
  if (
    combined.includes("utt") ||
    combined.includes("withdraw") ||
    combined.includes("utbetal")
  ) {
    return "withdrawal";
  }

  // Sometimes Nordnet exports tag cash movements as transfers/överföring.
  if (
    !hasHolding &&
    (combined.includes("överför") ||
      combined.includes("overfor") ||
      combined.includes("transfer"))
  ) {
    if (amount > 0) return "deposit";
    if (amount < 0) return "withdrawal";
  }

  return null;
};

const toChartId = (value: string) =>
  value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);

const normalizeKey = (value: string) => value.trim().toLowerCase();

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

const extractSnapshotAccountValues = (
  snapshot: InvestmentSnapshot,
): Record<string, number> => {
  const payload =
    (snapshot.cleaned_payload as Record<string, unknown> | null | undefined) ??
    (snapshot.parsed_payload as Record<string, unknown> | null | undefined) ??
    {};

  const accounts = (payload as { accounts?: unknown }).accounts;
  if (accounts && typeof accounts === "object" && !Array.isArray(accounts)) {
    const out: Record<string, number> = {};
    Object.entries(accounts as Record<string, unknown>).forEach(
      ([name, value]) => {
        const num = coerceNumber(value);
        if (num === undefined) return;
        out[name] = num;
      },
    );
    return out;
  }

  const fromSingleAccount = (snapshot.account_name ?? "").trim();
  const portfolioValue =
    coerceNumber(snapshot.portfolio_value) ??
    coerceNumber((snapshot as { portfolio_value?: string }).portfolio_value);
  if (fromSingleAccount && portfolioValue !== undefined) {
    return { [fromSingleAccount]: portfolioValue };
  }

  return {};
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
  const {
    items: accounts,
    loading: accountsLoading,
    fetchAccounts,
  } = useAccountsApi();
  const {
    snapshots,
    transactions,
    loading,
    error,
    fetchSnapshots,
    fetchTransactions,
  } = useInvestmentsApi();

  const [showAllAccounts, setShowAllAccounts] = useState(false);
  const [focusedAccount, setFocusedAccount] = useState<string>("ALL");

  useEffect(() => {
    fetchSnapshots();
    fetchAccounts();
    fetchTransactions();
  }, [fetchAccounts, fetchSnapshots, fetchTransactions]);

  const investmentAccounts = useMemo(() => {
    return (accounts ?? []).filter(
      (account: AccountRead) =>
        account.is_active !== false &&
        account.account_type === AccountType.INVESTMENT,
    );
  }, [accounts]);

  const investmentAccountsByKey = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    investmentAccounts.forEach((account) => {
      map.set(normalizeKey(account.name), {
        id: account.id,
        name: account.name,
      });
    });
    return map;
  }, [investmentAccounts]);

  const cashflowLoading = loading && transactions.length === 0;
  const cashflowError = error;

  const investmentValueByDate = useMemo(() => {
    const byDate = new Map<
      string,
      Map<string, { value: number; updatedAtMs: number }>
    >();

    snapshots.forEach((snap) => {
      const date = String(snap.snapshot_date).slice(0, 10);
      if (!date) return;
      const updatedAtMs = new Date(snap.updated_at).getTime();
      const accountValues = extractSnapshotAccountValues(snap);
      Object.entries(accountValues).forEach(([rawName, value]) => {
        const canonical = investmentAccountsByKey.get(normalizeKey(rawName));
        if (!canonical) return;

        const bucket = byDate.get(date) ?? new Map();
        const existing = bucket.get(canonical.name);
        if (!existing || updatedAtMs > existing.updatedAtMs) {
          bucket.set(canonical.name, { value, updatedAtMs });
        }
        byDate.set(date, bucket);
      });
    });

    return byDate;
  }, [investmentAccountsByKey, snapshots]);

  const datesWithValues = useMemo(() => {
    return Array.from(investmentValueByDate.keys()).sort();
  }, [investmentValueByDate]);

  const portfolioSeries = useMemo(() => {
    const sorted = datesWithValues.map((date) => {
      const bucket = investmentValueByDate.get(date);
      const total = bucket
        ? Array.from(bucket.values()).reduce(
            (sum, entry) => sum + entry.value,
            0,
          )
        : 0;
      return { date, value: total, year: new Date(date).getFullYear() };
    });

    if (!sorted.length) return [];

    const today = new Date().toISOString().slice(0, 10);
    const last = sorted.at(-1);
    const extended =
      last && last.date !== today
        ? [...sorted, { ...last, date: today }]
        : sorted;
    return extended;
  }, [datesWithValues, investmentValueByDate]);

  const portfolioCurrentValue = portfolioSeries.at(-1)?.value ?? 0;

  const portfolioDomain = useMemo<[number, number]>(() => {
    if (!portfolioSeries.length) return [0, 0];
    const values = portfolioSeries.map((d) => d.value);
    const max = Math.max(...values);
    const upperPad = Math.abs(max) * 0.05 || 1;
    return [0, max + upperPad];
  }, [portfolioSeries]);

  const portfolioStartValue = portfolioSeries.at(0)?.value ?? 0;
  const portfolioEndValue = portfolioSeries.at(-1)?.value ?? 0;

  const cashflowEvents = useMemo(() => {
    const events: {
      id: string;
      occurred_at: string;
      accountId: string;
      accountName: string;
      direction: "deposit" | "withdrawal";
      amount: number;
      description: string;
      transactionType: string;
    }[] = [];

    transactions.forEach((tx) => {
      const classification = classifyCashflowType(tx);
      if (!classification) return;

      const rawAccountName = String(tx.account_name ?? "").trim();
      if (!rawAccountName) return;
      const normalizedAccountName = normalizeKey(rawAccountName);
      const exact = investmentAccountsByKey.get(normalizedAccountName);
      const canonical =
        exact ??
        investmentAccounts.reduce<{ id: string; name: string } | null>(
          (best, account) => {
            const accountKey = normalizeKey(account.name);
            if (
              normalizedAccountName.includes(accountKey) ||
              accountKey.includes(normalizedAccountName)
            ) {
              if (!best) return { id: account.id, name: account.name };
              return accountKey.length > normalizeKey(best.name).length
                ? { id: account.id, name: account.name }
                : best;
            }
            return best;
          },
          null,
        );
      if (!canonical) return;

      const rawAmount = Number(tx.amount_sek ?? 0);
      if (!Number.isFinite(rawAmount) || rawAmount === 0) return;

      let direction = classification;
      if (direction === "deposit" && rawAmount < 0) direction = "withdrawal";
      if (direction === "withdrawal" && rawAmount > 0) direction = "deposit";

      events.push({
        id: tx.id,
        occurred_at: tx.occurred_at,
        accountId: canonical.id,
        accountName: canonical.name,
        direction,
        amount: Math.abs(rawAmount),
        description: tx.description ?? "",
        transactionType: String(tx.transaction_type ?? ""),
      });
    });

    return events.sort(
      (a, b) =>
        new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime(),
    );
  }, [investmentAccounts, investmentAccountsByKey, transactions]);

  const accountSummaries = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return investmentAccounts
      .map((account) => {
        const baseSeries = datesWithValues
          .map((date) => ({
            date,
            value: investmentValueByDate.get(date)?.get(account.name)?.value,
          }))
          .filter((row) => row.value !== undefined) as {
          date: string;
          value: number;
        }[];

        if (!baseSeries.length) {
          return {
            accountId: account.id,
            accountName: account.name,
            latestDate: undefined as string | undefined,
            latestValue: 0,
            startDate: undefined as string | undefined,
            startValue: 0,
            series: [] as { date: string; value: number }[],
            sparkline: [] as { date: string; value: number }[],
          };
        }

        const last = baseSeries.at(-1);
        const asOfDate = last?.date;
        const asOfValue = last?.value ?? 0;
        const extended =
          last && last.date !== today
            ? [...baseSeries, { ...last, date: today }]
            : baseSeries;

        return {
          accountId: account.id,
          accountName: account.name,
          latestDate: asOfDate,
          latestValue: asOfValue,
          startDate: extended[0]?.date,
          startValue: extended[0]?.value ?? 0,
          series: extended,
          sparkline: extended.slice(-18),
        };
      })
      .sort((a, b) => b.latestValue - a.latestValue);
  }, [datesWithValues, investmentAccounts, investmentValueByDate]);

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
    const iso12m = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
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
        deposits12m: number;
        withdrawals12m: number;
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
        deposits12m: 0,
        withdrawals12m: 0,
      };
      byAccountId.set(accountId, created);
      return created;
    };

    cashflowEvents.forEach((event) => {
      const occurred = String(event.occurred_at).slice(0, 10);
      const is30 = occurred >= iso30;
      const isYtd = occurred >= isoYtd;
      const is12m = occurred >= iso12m;

      const bucket = ensure(event.accountId);
      const deposit = event.direction === "deposit" ? event.amount : 0;
      const withdrawal = event.direction === "withdrawal" ? event.amount : 0;

      if (is30) {
        bucket.deposits30 += deposit;
        bucket.withdrawals30 += withdrawal;
      }
      if (isYtd) {
        bucket.depositsYtd += deposit;
        bucket.withdrawalsYtd += withdrawal;
      }
      if (is12m) {
        bucket.deposits12m += deposit;
        bucket.withdrawals12m += withdrawal;
      }
    });

    const totals = Array.from(byAccountId.values()).reduce(
      (acc, row) => ({
        deposits30: acc.deposits30 + row.deposits30,
        withdrawals30: acc.withdrawals30 + row.withdrawals30,
        depositsYtd: acc.depositsYtd + row.depositsYtd,
        withdrawalsYtd: acc.withdrawalsYtd + row.withdrawalsYtd,
        deposits12m: acc.deposits12m + row.deposits12m,
        withdrawals12m: acc.withdrawals12m + row.withdrawals12m,
      }),
      {
        deposits30: 0,
        withdrawals30: 0,
        depositsYtd: 0,
        withdrawalsYtd: 0,
        deposits12m: 0,
        withdrawals12m: 0,
      },
    );

    return {
      iso30,
      iso12m,
      isoYtd,
      byAccountId,
      totals,
      net30: totals.deposits30 - totals.withdrawals30,
      netYtd: totals.depositsYtd - totals.withdrawalsYtd,
      net12m: totals.deposits12m - totals.withdrawals12m,
    };
  }, [cashflowEvents]);

  const recentCashTransfers = useMemo(() => {
    const rows = cashflowEvents
      .slice()
      .sort(
        (a, b) =>
          new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
      );
    return rows.slice(0, 12);
  }, [cashflowEvents]);

  const portfolioPerformance = useMemo(() => {
    if (!portfolioSeries.length) {
      return {
        startDate: null as string | null,
        marketSinceStart: 0,
        marketSinceStartPct: null as number | null,
        market12m: 0,
        market12mPct: null as number | null,
      };
    }

    const today = new Date().toISOString().slice(0, 10);
    const startDate = portfolioSeries[0]?.date ?? today;

    let depositsSinceStart = 0;
    let withdrawalsSinceStart = 0;

    cashflowEvents.forEach((event) => {
      const occurred = String(event.occurred_at).slice(0, 10);
      if (occurred < startDate || occurred > today) return;
      if (event.direction === "deposit") depositsSinceStart += event.amount;
      else withdrawalsSinceStart += event.amount;
    });

    const netSinceStart = depositsSinceStart - withdrawalsSinceStart;
    const marketSinceStart =
      portfolioEndValue - portfolioStartValue - netSinceStart;
    const investedBaseSinceStart = portfolioStartValue + netSinceStart;
    const marketSinceStartPct =
      investedBaseSinceStart > 0
        ? (marketSinceStart / investedBaseSinceStart) * 100
        : null;

    const startPoint12m =
      portfolioSeries.find((p) => p.date >= cashflowSummary.iso12m) ??
      portfolioSeries[0];
    const startValue12m = startPoint12m?.value ?? portfolioStartValue;
    const market12m =
      portfolioEndValue - startValue12m - cashflowSummary.net12m;
    const investedBase12m = startValue12m + cashflowSummary.net12m;
    const market12mPct =
      investedBase12m > 0 ? (market12m / investedBase12m) * 100 : null;

    return {
      startDate,
      marketSinceStart,
      marketSinceStartPct,
      market12m,
      market12mPct,
    };
  }, [
    cashflowSummary.iso12m,
    cashflowSummary.net12m,
    cashflowEvents,
    portfolioEndValue,
    portfolioSeries,
    portfolioStartValue,
  ]);

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
              fetchAccounts();
              fetchTransactions();
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
                  {formatSek(portfolioCurrentValue)}
                </p>
                {portfolioPerformance.startDate ? (
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
                      : formatSignedSek(cashflowSummary.net30)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-slate-500">Added (12m)</span>
                  <span className="font-medium text-slate-900">
                    {cashflowLoading
                      ? "—"
                      : formatSek(cashflowSummary.totals.deposits12m)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Withdrawn (12m)</span>
                  <span className="font-medium text-slate-900">
                    {cashflowLoading
                      ? "—"
                      : formatSek(cashflowSummary.totals.withdrawals12m)}
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
                    {cashflowLoading
                      ? "—"
                      : formatSignedSek(cashflowSummary.net12m)}
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
              {portfolioPerformance.startDate ? (
                <p className="text-xs text-slate-500">
                  Since {portfolioPerformance.startDate}:{" "}
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
                    {(() => {
                      const flow = cashflowSummary.byAccountId.get(
                        acct.accountId,
                      ) ?? {
                        deposits30: 0,
                        withdrawals30: 0,
                        depositsYtd: 0,
                        withdrawalsYtd: 0,
                        deposits12m: 0,
                        withdrawals12m: 0,
                      };
                      const net12m = flow.deposits12m - flow.withdrawals12m;
                      const hasHistory = acct.series.length > 0;
                      const startPoint12m = hasHistory
                        ? (acct.series.find(
                            (point) => point.date >= cashflowSummary.iso12m,
                          ) ?? acct.series[0])
                        : undefined;
                      const startValue12m =
                        startPoint12m?.value ?? acct.latestValue;
                      const market12m = hasHistory
                        ? acct.latestValue - startValue12m - net12m
                        : null;
                      const investedBase12m = startValue12m + net12m;
                      const market12mPct =
                        market12m !== null && investedBase12m > 0
                          ? (market12m / investedBase12m) * 100
                          : null;

                      return (
                        <>
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
                                market12m !== null && market12m >= 0
                                  ? "text-emerald-700"
                                  : "text-rose-700",
                              )}
                            >
                              {market12m === null
                                ? "—"
                                : `${formatSignedSek(market12m)}${
                                    market12mPct !== null
                                      ? ` (${market12mPct >= 0 ? "+" : ""}${market12mPct.toFixed(
                                          1,
                                        )}%)`
                                      : ""
                                  }`}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Added (12m)</span>
                            <span className="font-medium text-slate-900">
                              {formatSek(flow.deposits12m)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>Withdrawn (12m)</span>
                            <span className="font-medium text-slate-900">
                              {formatSek(flow.withdrawals12m)}
                            </span>
                          </div>
                        </>
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
                      deposits12m: 0,
                      withdrawals12m: 0,
                    };
                    const net12m = flow.deposits12m - flow.withdrawals12m;
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
                          {formatSek(flow.deposits12m)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatSek(flow.withdrawals12m)}
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
                    recentCashTransfers.map((tx) => ({
                      date: tx.occurred_at,
                      account: tx.accountName,
                      direction:
                        tx.direction === "deposit" ? "Added" : "Withdrawn",
                      description: tx.description || tx.transactionType || "",
                      amount_sek: tx.amount,
                    })),
                    "investment-cashflow.csv",
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
                      <TableHead>Account</TableHead>
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
                        <TableCell className="text-slate-800">
                          {tx.accountName}
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
                          {tx.description || tx.transactionType || "-"}
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
                          {formatSek(tx.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-slate-500">
                  {cashflowLoading
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
