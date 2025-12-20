import { motion } from "framer-motion";
import {
  Archive,
  ArrowLeft,
  Edit,
  Landmark,
  Loader2,
  RefreshCw,
  Undo,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
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
import { useAppSelector } from "@/app/hooks";
import { EmptyState } from "@/components/composed/empty-state";
import { InlineError } from "@/components/composed/inline-error";
import { LoadingCard } from "@/components/composed/loading-card";
import {
  MotionPage,
  StaggerWrap,
  fadeInUp,
  subtleHover,
} from "@/components/motion-presets";
import { ReconcileAccountsDialog } from "@/components/reconcile-accounts-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageRoutes } from "@/data/routes";
import { selectToken } from "@/features/auth/authSlice";
import {
  useAccountsApi,
  useCategoriesApi,
  useInvestmentsApi,
} from "@/hooks/use-api";
import { formatCategoryLabel, renderCategoryIcon } from "@/lib/category-icons";
import { compactCurrency, currency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fetchYearlyOverview, fetchYearlyReport } from "@/services/reports";
import { fetchTransactions } from "@/services/transactions";
import {
  AccountType,
  TransactionType,
  type TransactionRead,
  type YearlyOverviewResponse,
} from "@/types/api";
import { AccountModal } from "./children/account-modal";

const formatCurrency = (value: number) => currency(value);

const formatAccountType = (type: AccountType) => {
  switch (type) {
    case AccountType.DEBT:
      return "Debt";
    case AccountType.INVESTMENT:
      return "Investment";
    default:
      return "Cash";
  }
};

const startOfYear = (year: number) => `${year}-01-01`;
const todayIso = () => new Date().toISOString().slice(0, 10);
const monthKeyFromDate = (date: Date) =>
  date.getFullYear() * 12 + date.getMonth();
const formatMonthLabel = (year: number, monthIndex: number) =>
  formatDate(new Date(year, monthIndex, 1), {
    month: "short",
    locale: "en-US",
  });
const formatMonthLabelWithYear = (year: number, monthIndex: number) =>
  `${formatMonthLabel(year, monthIndex)} '${String(year).slice(-2)}`;

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "");

const renderAccountIcon = (icon: string | null | undefined, name: string) => {
  if (icon?.startsWith("lucide:")) {
    const key = icon.slice("lucide:".length);
    const IconComp = (
      LucideIcons as unknown as Record<string, LucideIcon | undefined>
    )[key];
    if (IconComp) {
      const Icon = IconComp as LucideIcon;
      return (
        <Icon className="h-9 w-9 rounded-full border border-slate-100 bg-white p-1 text-slate-700" />
      );
    }
  }
  if (icon) {
    return (
      <img
        src={`/${icon}`}
        alt={name}
        className="h-9 w-9 rounded-full border border-slate-100 bg-white object-contain p-1"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-100 bg-white">
      <Landmark className="h-5 w-5 text-slate-600" />
    </div>
  );
};

const transactionTypeLabel: Record<TransactionType, string> = {
  [TransactionType.INCOME]: "Income",
  [TransactionType.EXPENSE]: "Expense",
  [TransactionType.TRANSFER]: "Transfer",
  [TransactionType.ADJUSTMENT]: "Adjustment",
  [TransactionType.INVESTMENT_EVENT]: "Investment",
};

const transactionTypeBadgeClass: Record<TransactionType, string> = {
  [TransactionType.INCOME]: "bg-emerald-100 text-emerald-800",
  [TransactionType.EXPENSE]: "bg-rose-100 text-rose-800",
  [TransactionType.TRANSFER]: "bg-slate-100 text-slate-700",
  [TransactionType.ADJUSTMENT]: "bg-amber-100 text-amber-800",
  [TransactionType.INVESTMENT_EVENT]: "bg-indigo-100 text-indigo-800",
};

export const AccountDetails: React.FC = () => {
  const { accountId } = useParams();
  const token = useAppSelector(selectToken);
  const [activeTab, setActiveTab] = useState<
    "overview" | "transactions" | "settings"
  >("overview");
  const [refreshSeq, setRefreshSeq] = useState(0);
  const [range, setRange] = useState<"ytd" | "1y" | "3y" | "all">("ytd");

  const {
    items: accounts,
    loading: accountsLoading,
    asOfDate,
    includeInactive,
    fetchAccounts,
    archiveAccount,
    updateAccount,
    reconcileAccounts,
    reconcileLoading,
    reconcileError,
  } = useAccountsApi();

  const {
    overview: investmentsOverview,
    loading: investmentsLoading,
    fetchOverview: fetchInvestmentsOverview,
  } = useInvestmentsApi();

  const { items: categories, fetchCategories } = useCategoriesApi();

  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const now = useMemo(() => new Date(), []);
  const currentYear = useMemo(() => now.getFullYear(), [now]);
  const currentMonthKey = useMemo(() => monthKeyFromDate(now), [now]);
  const endIso = useMemo(() => todayIso(), []);

  const rangeStartIso = useMemo(() => {
    if (range === "ytd") return startOfYear(currentYear);
    if (range === "1y") {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 1);
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }
    if (range === "3y") {
      const d = new Date(now);
      d.setFullYear(d.getFullYear() - 3);
      d.setDate(d.getDate() + 1);
      return d.toISOString().slice(0, 10);
    }
    return null;
  }, [currentYear, now, range]);

  const startMonthKey = useMemo(() => {
    if (range === "ytd") return currentYear * 12;
    if (range === "1y") return currentMonthKey - 11;
    if (range === "3y") return currentMonthKey - 35;
    return Number.NEGATIVE_INFINITY;
  }, [currentMonthKey, currentYear, range]);

  const yearsForFixedRange = useMemo(() => {
    if (!Number.isFinite(startMonthKey)) return [];
    const startYear = Math.floor(startMonthKey / 12);
    const endYear = Math.floor(currentMonthKey / 12);
    return Array.from(
      { length: endYear - startYear + 1 },
      (_, idx) => startYear + idx,
    );
  }, [currentMonthKey, startMonthKey]);

  const rangeLabel = useMemo(() => {
    if (range === "ytd") return `YTD (${startOfYear(currentYear)} → ${endIso})`;
    if (range === "1y") return `Last 1Y (${rangeStartIso} → ${endIso})`;
    if (range === "3y") return `Last 3Y (${rangeStartIso} → ${endIso})`;
    return "All time";
  }, [currentYear, endIso, range, rangeStartIso]);

  const account = useMemo(
    () => accounts.find((acc) => acc.id === accountId) ?? null,
    [accountId, accounts],
  );

  const categoryLookup = useMemo(() => {
    const map = new Map<string, (typeof categories)[number]>();
    categories.forEach((category) => map.set(category.id, category));
    return map;
  }, [categories]);

  useEffect(() => {
    if (accounts.length) return;
    fetchAccounts({ includeInactive: true });
  }, [accounts.length, fetchAccounts]);

  useEffect(() => {
    if (categories.length) return;
    fetchCategories({ includeArchived: true });
  }, [categories.length, fetchCategories]);

  useEffect(() => {
    if (!token) return;
    if (!accountId) return;
    if (account?.account_type !== AccountType.INVESTMENT) return;
    if (investmentsOverview) return;
    fetchInvestmentsOverview();
  }, [
    account?.account_type,
    accountId,
    fetchInvestmentsOverview,
    investmentsOverview,
    token,
  ]);

  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [availableYearsLoading, setAvailableYearsLoading] = useState(false);
  const [yearlyOverviews, setYearlyOverviews] = useState<
    Record<number, YearlyOverviewResponse>
  >({});
  const [yearlyOverviewLoading, setYearlyOverviewLoading] = useState(false);

  useEffect(() => {
    const loadAvailableYears = async () => {
      if (!token) return;
      if (!accountId) return;
      setAvailableYearsLoading(true);
      try {
        const { data } = await fetchYearlyReport({
          accountIds: accountId,
          token,
        });
        const years = (data.results ?? [])
          .map((row) => Number(row.year))
          .filter((y) => Number.isFinite(y))
          .sort((a, b) => a - b);
        setAvailableYears(years);
      } catch (err) {
        console.error("Failed to fetch yearly totals for account", err);
        setAvailableYears([]);
      } finally {
        setAvailableYearsLoading(false);
      }
    };
    void loadAvailableYears();
  }, [accountId, token]);

  useEffect(() => {
    const loadOverviews = async () => {
      if (!token) return;
      if (!accountId) return;
      const years =
        range === "all"
          ? availableYears
          : yearsForFixedRange.filter((y) => y > 1900 && y < 3000);
      if (!years.length) {
        setYearlyOverviews({});
        return;
      }

      setYearlyOverviewLoading(true);
      try {
        const results = await Promise.all(
          years.map(async (year) => {
            const { data } = await fetchYearlyOverview({
              year,
              token,
            });
            return [year, data] as const;
          }),
        );
        setYearlyOverviews(Object.fromEntries(results));
      } catch (err) {
        console.error("Failed to fetch yearly overview for account", err);
        setYearlyOverviews({});
      } finally {
        setYearlyOverviewLoading(false);
      }
    };
    void loadOverviews();
  }, [accountId, availableYears, range, refreshSeq, token, yearsForFixedRange]);

  const investmentSeries = useMemo(() => {
    if (!account) return null;
    const accounts = investmentsOverview?.accounts ?? [];
    if (!accounts.length) return null;

    const byId = accounts.find((a) => a.account_id === account.id);
    if (byId?.series?.length) return byId.series;

    const accountKey = normalizeKey(account.name);
    const byName = accounts.find((a) => normalizeKey(a.name) === accountKey);
    if (byName?.series?.length) return byName.series;

    return null;
  }, [account, investmentsOverview?.accounts]);

  const balanceSeries = useMemo(() => {
    const isSingleYear = range === "ytd";

    if (account?.account_type === AccountType.INVESTMENT && investmentSeries) {
      const byMonth = new Map<number, number>();
      investmentSeries.forEach((p) => {
        const date = new Date(p.date);
        const year = date.getFullYear();
        const monthIndex = date.getMonth();
        const value = Number(p.value);
        if (Number.isFinite(value)) {
          byMonth.set(year * 12 + monthIndex, value);
        }
      });

      const points = [...byMonth.entries()]
        .map(([monthKey, value]) => ({ monthKey, value }))
        .sort((a, b) => a.monthKey - b.monthKey);

      if (range === "all") {
        const byYear = new Map<number, number>();
        points.forEach((p) => {
          const year = Math.floor(p.monthKey / 12);
          byYear.set(year, p.value);
        });
        return [...byYear.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([year, balance]) => ({ month: String(year), balance }));
      }

      const filtered = points.filter(
        (p) => p.monthKey >= startMonthKey && p.monthKey <= currentMonthKey,
      );
      return filtered.map((p) => {
        const year = Math.floor(p.monthKey / 12);
        const monthIndex = p.monthKey % 12;
        const label = isSingleYear
          ? formatMonthLabel(year, monthIndex)
          : formatMonthLabelWithYear(year, monthIndex);
        return { month: label, balance: p.value };
      });
    }

    const points: Array<{ monthKey: number; balance: number }> = [];
    Object.entries(yearlyOverviews).forEach(([yearStr, overview]) => {
      const year = Number(yearStr);
      if (!Number.isFinite(year)) return;
      const flow =
        overview.account_flows.find((f) => f.account_id === accountId) ??
        overview.account_flows[0];
      if (!flow) return;

      if (range === "all") {
        const endBalance = Number(flow.end_balance);
        if (Number.isFinite(endBalance)) {
          points.push({ monthKey: year * 12 + 11, balance: endBalance });
        }
        return;
      }

      const startBalance = Number(flow.start_balance);
      const changes = flow.monthly_change.map((v) => Number(v) || 0);
      let running = Number.isFinite(startBalance) ? startBalance : 0;
      changes.forEach((change, monthIndex) => {
        running += change;
        points.push({ monthKey: year * 12 + monthIndex, balance: running });
      });
    });

    const sorted = points.sort((a, b) => a.monthKey - b.monthKey);

    if (range === "all") {
      return sorted.map((p) => ({
        month: String(Math.floor(p.monthKey / 12)),
        balance: p.balance,
      }));
    }

    const filtered = sorted.filter(
      (p) => p.monthKey >= startMonthKey && p.monthKey <= currentMonthKey,
    );
    return filtered.map((p) => {
      const year = Math.floor(p.monthKey / 12);
      const monthIndex = p.monthKey % 12;
      const label = isSingleYear
        ? formatMonthLabel(year, monthIndex)
        : formatMonthLabelWithYear(year, monthIndex);
      return { month: label, balance: p.balance };
    });
  }, [
    account?.account_type,
    accountId,
    currentMonthKey,
    range,
    startMonthKey,
    investmentSeries,
    yearlyOverviews,
  ]);

  const cashflowSeries = useMemo(() => {
    if (range === "all") {
      return Object.entries(yearlyOverviews)
        .map(([yearStr, overview]) => {
          const year = Number(yearStr);
          const flow =
            overview.account_flows.find((f) => f.account_id === accountId) ??
            overview.account_flows[0];
          if (!flow) return null;
          return {
            month: String(year),
            income: Number(flow.income),
            expense: Number(flow.expense),
            transfersIn: Number(flow.transfers_in),
            transfersOut: Number(flow.transfers_out),
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => Number(a.month) - Number(b.month));
    }

    const points: Array<{
      monthKey: number;
      income: number;
      expense: number;
      transfersIn: number;
      transfersOut: number;
    }> = [];

    Object.entries(yearlyOverviews).forEach(([yearStr, overview]) => {
      const year = Number(yearStr);
      if (!Number.isFinite(year)) return;
      const flow =
        overview.account_flows.find((f) => f.account_id === accountId) ??
        overview.account_flows[0];
      if (!flow) return;
      for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
        points.push({
          monthKey: year * 12 + monthIndex,
          income: Number(flow.monthly_income[monthIndex] ?? 0),
          expense: Number(flow.monthly_expense[monthIndex] ?? 0),
          transfersIn: Number(flow.monthly_transfers_in[monthIndex] ?? 0),
          transfersOut: Number(flow.monthly_transfers_out[monthIndex] ?? 0),
        });
      }
    });

    const isSingleYear = range === "ytd";
    return points
      .filter(
        (p) => p.monthKey >= startMonthKey && p.monthKey <= currentMonthKey,
      )
      .sort((a, b) => a.monthKey - b.monthKey)
      .map((p) => {
        const year = Math.floor(p.monthKey / 12);
        const monthIndex = p.monthKey % 12;
        const label = isSingleYear
          ? formatMonthLabel(year, monthIndex)
          : formatMonthLabelWithYear(year, monthIndex);
        return {
          month: label,
          income: p.income,
          expense: p.expense,
          transfersIn: p.transfersIn,
          transfersOut: p.transfersOut,
        };
      });
  }, [accountId, currentMonthKey, range, startMonthKey, yearlyOverviews]);

  const kpis = useMemo(() => {
    const balanceNow = account ? Number(account.balance) : 0;
    const first =
      balanceSeries.find((p) => p.balance !== null)?.balance ?? null;
    const last =
      [...balanceSeries].reverse().find((p) => p.balance !== null)?.balance ??
      null;
    const change =
      first !== null && last !== null ? Number(last) - Number(first) : 0;

    const sumIncome = cashflowSeries.reduce(
      (sum, row) => sum + Number(row.income ?? 0),
      0,
    );
    const sumExpense = cashflowSeries.reduce(
      (sum, row) => sum + Number(row.expense ?? 0),
      0,
    );
    const avgIncome = cashflowSeries.length
      ? sumIncome / cashflowSeries.length
      : 0;
    const avgExpense = cashflowSeries.length
      ? sumExpense / cashflowSeries.length
      : 0;
    const net = avgIncome - avgExpense;
    return { balanceNow, change, avgIncome, avgExpense, net };
  }, [account, balanceSeries, cashflowSeries]);

  const topExpenseCategories = useMemo(() => {
    const byName = new Map<string, number>();
    Object.entries(yearlyOverviews).forEach(([yearStr, overview]) => {
      const year = Number(yearStr);
      const rows = overview.category_breakdown ?? [];
      rows.forEach((row) => {
        if (range === "all") {
          byName.set(
            row.name,
            (byName.get(row.name) ?? 0) + Math.abs(Number(row.total)),
          );
          return;
        }
        const monthStart = Math.max(0, startMonthKey - year * 12);
        const monthEnd = Math.min(11, currentMonthKey - year * 12);
        if (monthEnd < 0 || monthStart > 11 || monthStart > monthEnd) return;
        const sum = row.monthly
          .slice(monthStart, monthEnd + 1)
          .reduce((acc, v) => acc + Math.abs(Number(v)), 0);
        byName.set(row.name, (byName.get(row.name) ?? 0) + sum);
      });
    });
    return [...byName.entries()]
      .map(([name, total]) => ({ name, total }))
      .filter((row) => Number.isFinite(row.total) && row.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [currentMonthKey, range, startMonthKey, yearlyOverviews]);

  const topIncomeCategories = useMemo(() => {
    const byName = new Map<string, number>();
    Object.entries(yearlyOverviews).forEach(([yearStr, overview]) => {
      const year = Number(yearStr);
      const rows = overview.income_category_breakdown ?? [];
      rows.forEach((row) => {
        if (range === "all") {
          byName.set(
            row.name,
            (byName.get(row.name) ?? 0) + Math.abs(Number(row.total)),
          );
          return;
        }
        const monthStart = Math.max(0, startMonthKey - year * 12);
        const monthEnd = Math.min(11, currentMonthKey - year * 12);
        if (monthEnd < 0 || monthStart > 11 || monthStart > monthEnd) return;
        const sum = row.monthly
          .slice(monthStart, monthEnd + 1)
          .reduce((acc, v) => acc + Math.abs(Number(v)), 0);
        byName.set(row.name, (byName.get(row.name) ?? 0) + sum);
      });
    });
    return [...byName.entries()]
      .map(([name, total]) => ({ name, total }))
      .filter((row) => Number.isFinite(row.total) && row.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [currentMonthKey, range, startMonthKey, yearlyOverviews]);

  const topMerchants = useMemo(() => {
    const byName = new Map<string, number>();
    Object.values(yearlyOverviews).forEach((overview) => {
      (overview.top_merchants ?? []).forEach((row) => {
        byName.set(
          row.merchant,
          (byName.get(row.merchant) ?? 0) + Math.abs(Number(row.amount)),
        );
      });
    });
    return [...byName.entries()]
      .map(([name, total]) => ({ name, total }))
      .filter((row) => Number.isFinite(row.total) && row.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [yearlyOverviews]);

  const [txItems, setTxItems] = useState<TransactionRead[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [txOffset, setTxOffset] = useState(0);
  const [txHasMore, setTxHasMore] = useState(true);
  const txLimit = 50;

  const loadTransactions = async (opts?: { reset?: boolean }) => {
    if (!token) return;
    if (!accountId) return;
    const reset = Boolean(opts?.reset);
    const nextOffset = reset ? 0 : txOffset;
    setTxLoading(true);
    setTxError(null);
    try {
      const query = {
        ...(rangeStartIso ? { start_date: rangeStartIso } : {}),
        end_date: endIso,
        account_ids: accountId,
        limit: txLimit,
        offset: nextOffset,
      };
      const { data } = await fetchTransactions({ token, query });
      const next = reset
        ? data.transactions
        : [...txItems, ...data.transactions];
      setTxItems(next);
      setTxOffset(nextOffset + data.transactions.length);
      setTxHasMore(data.transactions.length >= txLimit);
    } catch (err) {
      console.error("Failed to load account transactions", err);
      setTxError("Failed to load transactions.");
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    void loadTransactions({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, endIso, range, rangeStartIso, refreshSeq, token]);

  if (!accountId) {
    return (
      <MotionPage className="space-y-4">
        <Card className="border-slate-200">
          <CardContent className="p-6 text-sm text-slate-600">
            Missing account id.
          </CardContent>
        </Card>
      </MotionPage>
    );
  }

  return (
    <MotionPage className="space-y-4">
      <StaggerWrap className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <motion.div variants={fadeInUp} className="space-y-1">
          <Link
            to={PageRoutes.accounts}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to accounts
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            {account ? (
              renderAccountIcon(account.icon, account.name)
            ) : (
              <Skeleton className="h-9 w-9 rounded-full" />
            )}
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold text-slate-900">
                {account?.name ?? "Account"}
              </h1>
              {account ? (
                <>
                  <Badge className="bg-slate-100 text-slate-700">
                    {formatAccountType(account.account_type)}
                  </Badge>
                  <Badge
                    variant={account.is_active ? "default" : "outline"}
                    className={
                      account.is_active
                        ? "bg-emerald-50 text-emerald-700"
                        : "border-slate-300 text-slate-600"
                    }
                  >
                    {account.is_active ? "Active" : "Archived"}
                  </Badge>
                  {account.needs_reconciliation ? (
                    <Badge className="bg-amber-100 text-amber-800">Stale</Badge>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-slate-500">{rangeLabel}</p>
            <Tabs
              value={range}
              onValueChange={(v) => {
                setRange(v as typeof range);
                setTxItems([]);
                setTxOffset(0);
                setTxHasMore(true);
              }}
              className="w-auto"
            >
              <TabsList className="h-9 bg-slate-100">
                <TabsTrigger value="ytd" className="cursor-pointer text-xs">
                  YTD
                </TabsTrigger>
                <TabsTrigger value="1y" className="cursor-pointer text-xs">
                  1Y
                </TabsTrigger>
                <TabsTrigger value="3y" className="cursor-pointer text-xs">
                  3Y
                </TabsTrigger>
                <TabsTrigger value="all" className="cursor-pointer text-xs">
                  All
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <p className="text-xs text-slate-500">
            {asOfDate ? `As of ${asOfDate}` : "Live balances"}{" "}
            {includeInactive ? "(including inactive enabled)" : ""}
          </p>
        </motion.div>

        <motion.div variants={fadeInUp} className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-700"
            onClick={() => {
              fetchAccounts({ includeInactive: true });
              setRefreshSeq((v) => v + 1);
              toast.message("Refreshing…");
            }}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-700"
            onClick={() => setReconcileOpen(true)}
            disabled={!account || reconcileLoading}
          >
            {reconcileLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Reconcile
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-slate-300 text-slate-700"
            onClick={() => setEditOpen(true)}
            disabled={!account}
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
          {account ? (
            <Button
              variant="outline"
              className="gap-2 border-slate-300 text-slate-700"
              onClick={() => {
                if (account.is_active) {
                  archiveAccount(account.id);
                  toast.success("Account archived");
                } else {
                  updateAccount(account.id, { is_active: true });
                  toast.success("Account restored");
                }
              }}
            >
              {account.is_active ? (
                <>
                  <Archive className="h-4 w-4" /> Archive
                </>
              ) : (
                <>
                  <Undo className="h-4 w-4" /> Restore
                </>
              )}
            </Button>
          ) : null}
        </motion.div>
      </StaggerWrap>

      <ReconcileAccountsDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        accounts={accounts}
        targets={account ? [account] : []}
        mode="targets"
        loading={reconcileLoading}
        error={reconcileError}
        description={`Reconciled from ${account?.name ?? "Account"}`}
        onReconcile={reconcileAccounts}
        onSuccess={() => fetchAccounts({ includeInactive: true })}
      />

      <AccountModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        account={account ?? undefined}
      />

      <StaggerWrap className="grid gap-3 md:grid-cols-4">
        {[
          {
            label: "Balance",
            value: formatCurrency(kpis.balanceNow),
            tone: "text-slate-900",
          },
          {
            label: `Change (${range.toUpperCase()})`,
            value: `${kpis.change >= 0 ? "+" : "−"}${formatCurrency(
              Math.abs(kpis.change),
            )}`,
            tone: kpis.change >= 0 ? "text-emerald-700" : "text-rose-700",
          },
          {
            label: "Avg income / mo",
            value: formatCurrency(kpis.avgIncome),
            tone: "text-emerald-700",
          },
          {
            label: "Avg expense / mo",
            value: formatCurrency(kpis.avgExpense),
            tone: "text-rose-700",
          },
        ].map((kpi) => (
          <motion.div key={kpi.label} variants={fadeInUp} {...subtleHover}>
            <Card className="border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
              <CardContent className="p-4">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  {kpi.label}
                </p>
                {accountsLoading ? (
                  <Skeleton className="mt-2 h-8 w-36" />
                ) : (
                  <p className={cn("mt-2 text-2xl font-semibold", kpi.tone)}>
                    {kpi.value}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </StaggerWrap>

      <motion.div variants={fadeInUp} {...subtleHover}>
        <Card className="border-slate-200 shadow-[0_10px_40px_-24px_rgba(15,23,42,0.25)]">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-900">
                Account details
              </CardTitle>
              <p className="text-xs text-slate-500">
                Trends and activity for this account (YTD).
              </p>
            </div>
            {(yearlyOverviewLoading ||
              (account?.account_type === AccountType.INVESTMENT &&
                investmentsLoading)) && (
              <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
            )}
          </CardHeader>
          <CardContent className="p-0">
            <Separator />
            <div className="p-4">
              <Tabs
                value={activeTab}
                onValueChange={(v) => setActiveTab(v as typeof activeTab)}
              >
                <TabsList className="bg-slate-100">
                  <TabsTrigger value="overview" className="cursor-pointer">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="transactions" className="cursor-pointer">
                    Transactions
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="cursor-pointer">
                    Settings
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {activeTab === "overview" ? (
              <div className="grid gap-4 p-4 lg:grid-cols-2">
                <Card className="border-slate-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-500">
                      Balance trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    {yearlyOverviewLoading ||
                    availableYearsLoading ||
                    accountsLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : balanceSeries.length ? (
                      <ChartContainer
                        className="h-full w-full"
                        config={{
                          balance: {
                            label: "Balance",
                            color: "var(--chart-balance, #0ea5e9)",
                          },
                        }}
                      >
                        <AreaChart
                          data={balanceSeries}
                          margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="balanceFill"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-balance)"
                                stopOpacity={0.35}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-balance)"
                                stopOpacity={0.05}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                            tickMargin={12}
                            width={90}
                          />
                          <ReferenceLine
                            y={0}
                            stroke="#cbd5e1"
                            strokeDasharray="4 4"
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const point = payload[0].payload as {
                                month?: string;
                                balance?: number | null;
                              };
                              const value = point.balance;
                              return (
                                <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                                  <p className="font-semibold text-slate-800">
                                    {point.month}
                                  </p>
                                  <p className="text-slate-600">
                                    Balance:{" "}
                                    <span className="font-semibold text-slate-800 tabular-nums">
                                      {value === null || value === undefined
                                        ? "—"
                                        : formatCurrency(Number(value))}
                                    </span>
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Area
                            type="monotoneX"
                            dataKey="balance"
                            stroke="var(--color-balance)"
                            fill="url(#balanceFill)"
                            strokeWidth={2}
                            dot={false}
                            connectNulls={false}
                          />
                        </AreaChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        No balance history yet.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-500">
                      Cashflow ({range.toUpperCase()})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-72">
                    {yearlyOverviewLoading ||
                    availableYearsLoading ||
                    accountsLoading ? (
                      <Skeleton className="h-full w-full" />
                    ) : cashflowSeries.length ? (
                      <ChartContainer
                        className="h-full w-full"
                        config={{
                          income: { label: "Income", color: "#10b981" },
                          expense: { label: "Expense", color: "#ef4444" },
                          transfersIn: {
                            label: "Transfers in",
                            color: "#0ea5e9",
                          },
                          transfersOut: {
                            label: "Transfers out",
                            color: "#94a3b8",
                          },
                        }}
                      >
                        <BarChart
                          data={cashflowSeries}
                          margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient
                              id="cfIncome"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-income)"
                                stopOpacity={0.95}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-income)"
                                stopOpacity={0.35}
                              />
                            </linearGradient>
                            <linearGradient
                              id="cfExpense"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-expense)"
                                stopOpacity={0.9}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-expense)"
                                stopOpacity={0.3}
                              />
                            </linearGradient>
                            <linearGradient
                              id="cfTin"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-transfersIn)"
                                stopOpacity={0.85}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-transfersIn)"
                                stopOpacity={0.25}
                              />
                            </linearGradient>
                            <linearGradient
                              id="cfTout"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="var(--color-transfersOut)"
                                stopOpacity={0.85}
                              />
                              <stop
                                offset="100%"
                                stopColor="var(--color-transfersOut)"
                                stopOpacity={0.25}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                            tickMargin={12}
                            width={90}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const p = payload[0].payload as {
                                month?: string;
                                income?: number | null;
                                expense?: number | null;
                                transfersIn?: number | null;
                                transfersOut?: number | null;
                              };
                              return (
                                <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                                  <p className="font-semibold text-slate-800">
                                    {p.month}
                                  </p>
                                  <div className="mt-1 space-y-0.5 text-slate-700">
                                    <div className="flex justify-between gap-6">
                                      <span>Income</span>
                                      <span className="font-semibold tabular-nums">
                                        {formatCurrency(Number(p.income ?? 0))}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                      <span>Expense</span>
                                      <span className="font-semibold tabular-nums">
                                        {formatCurrency(Number(p.expense ?? 0))}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                      <span>Transfers in</span>
                                      <span className="font-semibold tabular-nums">
                                        {formatCurrency(
                                          Number(p.transfersIn ?? 0),
                                        )}
                                      </span>
                                    </div>
                                    <div className="flex justify-between gap-6">
                                      <span>Transfers out</span>
                                      <span className="font-semibold tabular-nums">
                                        {formatCurrency(
                                          Number(p.transfersOut ?? 0),
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }}
                          />
                          <Bar
                            dataKey="income"
                            fill="url(#cfIncome)"
                            radius={[6, 6, 0, 0]}
                            barSize={12}
                          />
                          <Bar
                            dataKey="expense"
                            fill="url(#cfExpense)"
                            radius={[6, 6, 0, 0]}
                            barSize={12}
                          />
                          <Bar
                            dataKey="transfersIn"
                            fill="url(#cfTin)"
                            radius={[6, 6, 0, 0]}
                            barSize={12}
                          />
                          <Bar
                            dataKey="transfersOut"
                            fill="url(#cfTout)"
                            radius={[6, 6, 0, 0]}
                            barSize={12}
                          />
                        </BarChart>
                      </ChartContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-slate-500">
                        No cashflow data yet.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-500">
                      Top categories ({range.toUpperCase()})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {yearlyOverviewLoading || availableYearsLoading ? (
                      <Skeleton className="h-28 w-full" />
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-lg border border-slate-100 bg-white p-3">
                          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Income
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {topIncomeCategories.length ? (
                              topIncomeCategories.map((row) => (
                                <div
                                  key={row.name}
                                  className="flex items-center justify-between gap-4 text-sm"
                                >
                                  <span className="min-w-0 truncate text-slate-700">
                                    {row.name}
                                  </span>
                                  <span className="font-semibold text-slate-900 tabular-nums">
                                    {formatCurrency(row.total)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500">
                                No income categories yet.
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-100 bg-white p-3">
                          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                            Expenses
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {topExpenseCategories.length ? (
                              topExpenseCategories.map((row) => (
                                <div
                                  key={row.name}
                                  className="flex items-center justify-between gap-4 text-sm"
                                >
                                  <span className="min-w-0 truncate text-slate-700">
                                    {row.name}
                                  </span>
                                  <span className="font-semibold text-slate-900 tabular-nums">
                                    {formatCurrency(row.total)}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <p className="text-sm text-slate-500">
                                No expense categories yet.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-slate-100">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-slate-500">
                      Top merchants ({range.toUpperCase()})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {yearlyOverviewLoading || availableYearsLoading ? (
                      <Skeleton className="h-28 w-full" />
                    ) : topMerchants.length ? (
                      topMerchants.map((row) => (
                        <div
                          key={row.name}
                          className="flex items-center justify-between gap-4 text-sm"
                        >
                          <span className="min-w-0 truncate text-slate-700">
                            {row.name}
                          </span>
                          <span className="font-semibold text-slate-900 tabular-nums">
                            {formatCurrency(row.total)}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-slate-500">
                        No merchant data yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {activeTab === "transactions" ? (
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Transactions
                    </p>
                    <p className="text-xs text-slate-500">
                      Showing {rangeLabel.toLowerCase()} transactions for this
                      account.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="gap-2 border-slate-300 text-slate-700"
                    onClick={() => loadTransactions({ reset: true })}
                    disabled={txLoading}
                  >
                    {txLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Refresh
                  </Button>
                </div>

                <Separator className="my-4" />

                {txError ? <InlineError message={txError} /> : null}

                {txLoading && txItems.length === 0 ? (
                  <LoadingCard className="rounded-lg" lines={6} />
                ) : txItems.length === 0 ? (
                  <EmptyState
                    className="rounded-lg"
                    title="No transactions in this range."
                    description="Adjust the filters or refresh to fetch the latest activity."
                    action={
                      <Button
                        variant="outline"
                        className="border-slate-300 text-slate-700"
                        onClick={() => loadTransactions({ reset: true })}
                        disabled={txLoading}
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="rounded-lg border border-slate-100 bg-white shadow-[0_10px_30px_-28px_rgba(15,23,42,0.25)]">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="w-44">Date</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="hidden md:table-cell">
                              Category
                            </TableHead>
                            <TableHead className="w-40 text-right">
                              Amount
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {txItems.map((tx) => {
                            const leg = tx.legs?.find(
                              (l) => l.account_id === accountId,
                            );
                            const amount = Number(leg?.amount ?? 0);
                            const isPositive = amount >= 0;
                            const category = tx.category_id
                              ? (categoryLookup.get(tx.category_id) ?? null)
                              : null;

                            const counterpartyNames = tx.legs
                              ?.filter((l) => l.account_id !== accountId)
                              .map(
                                (l) =>
                                  accounts.find(
                                    (acc) => acc.id === l.account_id,
                                  )?.name ?? "Other account",
                              )
                              .filter(Boolean);
                            const counterparty =
                              counterpartyNames && counterpartyNames.length
                                ? counterpartyNames.join(", ")
                                : null;

                            return (
                              <TableRow key={tx.id}>
                                <TableCell className="align-top text-sm text-slate-700">
                                  {new Date(tx.occurred_at).toLocaleDateString(
                                    "en-US",
                                    {
                                      month: "short",
                                      day: "numeric",
                                      year: "numeric",
                                    },
                                  )}
                                </TableCell>
                                <TableCell className="align-top">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-900">
                                      {tx.description?.trim() || "Transaction"}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                      <span
                                        className={cn(
                                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                                          transactionTypeBadgeClass[
                                            tx.transaction_type
                                          ],
                                        )}
                                      >
                                        {transactionTypeLabel[
                                          tx.transaction_type
                                        ] ?? tx.transaction_type}
                                      </span>
                                      {tx.transaction_type ===
                                        TransactionType.TRANSFER &&
                                      counterparty ? (
                                        <span className="truncate">
                                          {isPositive ? "From" : "To"}{" "}
                                          {counterparty}
                                        </span>
                                      ) : null}
                                      {tx.notes?.trim() ? (
                                        <span className="hidden lg:inline">
                                          • {tx.notes.trim()}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden align-top md:table-cell">
                                  {category ? (
                                    <div className="flex min-w-0 items-center gap-2">
                                      {category.color_hex ? (
                                        <span
                                          className="h-2 w-2 shrink-0 rounded-full"
                                          style={{
                                            backgroundColor: category.color_hex,
                                          }}
                                        />
                                      ) : null}
                                      {renderCategoryIcon(
                                        category.icon,
                                        category.name,
                                        "h-4 w-4 shrink-0 text-slate-700",
                                      )}
                                      <span className="min-w-0 truncate text-sm text-slate-700">
                                        {formatCategoryLabel(
                                          category.name,
                                          category.icon,
                                        )}
                                      </span>
                                      {category.is_archived ? (
                                        <Badge
                                          variant="outline"
                                          className="ml-1 border-slate-300 text-slate-600"
                                        >
                                          Archived
                                        </Badge>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <span className="text-sm text-slate-500">
                                      Uncategorized
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell
                                  className={cn(
                                    "text-right align-top text-sm font-semibold tabular-nums",
                                    isPositive
                                      ? "text-emerald-700"
                                      : "text-rose-700",
                                  )}
                                >
                                  {isPositive ? "+" : "−"}
                                  {formatCurrency(Math.abs(amount))}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="pt-2">
                      <Button
                        variant="outline"
                        className="w-full border-slate-300 text-slate-700"
                        onClick={() => loadTransactions({ reset: false })}
                        disabled={txLoading || !txHasMore}
                      >
                        {txLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {txHasMore ? "Load more" : "No more transactions"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {activeTab === "settings" ? (
              <div className="p-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    Account settings
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Edit, archive, and reconciliation actions are available in
                    the header.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="gap-2 border-slate-300 text-slate-700"
                      onClick={() => setEditOpen(true)}
                      disabled={!account}
                    >
                      <Edit className="h-4 w-4" />
                      Edit account
                    </Button>
                    {account?.account_type === AccountType.DEBT ? (
                      <Button
                        asChild
                        variant="outline"
                        className="border-slate-300 text-slate-700"
                      >
                        <Link to={`${PageRoutes.loans}/${account.id}`}>
                          Open loan page
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </motion.div>
    </MotionPage>
  );
};
