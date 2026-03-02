import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Plus, Upload } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, Tooltip, XAxis, YAxis } from "recharts";
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
import { Skeleton } from "@/components/ui/skeleton";
import { PageRoutes } from "@/data/routes";
import { selectIsAuthenticated, selectToken } from "@/features/auth/authSlice";
import {
  useAccountsApi,
  useCategoriesApi,
  useReportsApi,
  useTransactionsApi,
} from "@/hooks/use-api";
import { apiFetch } from "@/lib/apiClient";
import { buildEndpointRequest } from "@/lib/apiEndpoints";
import { currency } from "@/lib/format";
import {
  getDisplayTransactionType,
  getTransactionTypeLabel,
} from "@/lib/transactions";
import {
  AccountType,
  type MonthlyReportEntry,
  TransactionType,
  type YearlyOverviewResponse,
} from "@/types/api";
import type { EndpointResponse } from "@/types/contracts";
import { AccountIcon } from "./components/account-icon";
import { CategoryMixChartCard } from "./components/category-mix-chart-card";
import { IncomeExpenseChartCard } from "./components/income-expense-chart-card";
import { NetWorthChartCard } from "./components/net-worth-chart-card";
import { QuickActionsCard } from "./components/quick-actions-card";
import {
  RecentTransactionsCard,
  type DashboardRecentTransaction,
} from "./components/recent-transactions-card";
import { SavingsRateChartCard } from "./components/savings-rate-chart-card";
import {
  MONTH_LABELS,
  buildRollingMonthSlots,
  dedupeMonthlyEntries,
  formatCurrencyDelta,
  getPeriodMonthKey,
  getPeriodYear,
  numberFromString,
  type KPI,
  type SavingsMonthStatus,
} from "./dashboard-utils";

export const Dashboard: React.FC = () => {
  const { monthly, total, netWorth, fetchTotalReport, fetchNetWorthReport } =
    useReportsApi();
  const { recent, fetchRecentTransactions } = useTransactionsApi();
  const {
    items: accounts,
    loading: accountsLoading,
    fetchAccounts,
  } = useAccountsApi();
  const { items: categories, fetchCategories } = useCategoriesApi();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const token = useAppSelector(selectToken);
  const hasFetched = useRef(false);
  const [filteredMonthly, setFilteredMonthly] = useState<MonthlyReportEntry[]>(
    [],
  );
  const [monthlyWindowData, setMonthlyWindowData] = useState<
    MonthlyReportEntry[]
  >([]);
  const [yearlyOverviewsByYear, setYearlyOverviewsByYear] = useState<
    Record<number, YearlyOverviewResponse>
  >({});
  const [yearlyOverview, setYearlyOverview] =
    useState<YearlyOverviewResponse | null>(null);
  const [yearlyOverviewLoading, setYearlyOverviewLoading] = useState(false);
  const [accountDeltas, setAccountDeltas] = useState<Record<string, number>>(
    {},
  );
  const [recentTab, setRecentTab] = useState<"all" | "income" | "expense">(
    "all",
  );
  const activeAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => account.is_active !== false && account.name !== "Offset",
      ),
    [accounts],
  );
  const accountNameById = useMemo(
    () => new Map(accounts.map((acc) => [acc.id, acc.name])),
    [accounts],
  );
  const categoryById = useMemo(
    () => new Map(categories.map((cat) => [cat.id, cat])),
    [categories],
  );

  useEffect(() => {
    if (!isAuthenticated || hasFetched.current) return;
    hasFetched.current = true;
    fetchTotalReport();
    fetchNetWorthReport();
    fetchAccounts();
    fetchCategories();
  }, [
    fetchTotalReport,
    fetchNetWorthReport,
    fetchAccounts,
    fetchCategories,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const limit = 20;
    const transactionTypes =
      recentTab === "all"
        ? undefined
        : recentTab === "income"
          ? [TransactionType.INCOME, TransactionType.TRANSFER]
          : [TransactionType.EXPENSE, TransactionType.TRANSFER];
    fetchRecentTransactions({ limit, transactionTypes });
  }, [fetchRecentTransactions, isAuthenticated, recentTab]);

  useEffect(() => {
    const loadFilteredMonthly = async () => {
      if (!token) return;
      const nonInvestmentIds = accounts
        .filter((acc) => acc.account_type !== AccountType.INVESTMENT)
        .map((acc) => acc.id);
      const currentYear = new Date().getFullYear();
      const years = [currentYear - 1, currentYear];
      const collectMonthly = async (accountIds?: string[]) => {
        const responses = await Promise.all(
          years.map((year) =>
            apiFetch<EndpointResponse<"dashboardOverview">>(
              buildEndpointRequest("dashboardOverview", {
                query: {
                  year,
                  ...(accountIds?.length
                    ? { account_ids: accountIds.join(",") }
                    : {}),
                },
                token,
              }),
            ),
          ),
        );
        return responses.flatMap((response) => response.data.monthly ?? []);
      };

      try {
        const [windowEntries, filteredEntries] = await Promise.all([
          collectMonthly(),
          nonInvestmentIds.length
            ? collectMonthly(nonInvestmentIds)
            : Promise.resolve([]),
        ]);
        setMonthlyWindowData(dedupeMonthlyEntries(windowEntries));
        setFilteredMonthly(dedupeMonthlyEntries(filteredEntries));
      } catch (err) {
        console.error("Failed to fetch rolling monthly report", err);
        setMonthlyWindowData([]);
        setFilteredMonthly([]);
      }
    };
    void loadFilteredMonthly();
  }, [accounts, token]);

  useEffect(() => {
    const loadYearlyOverview = async () => {
      if (!token) return;
      const currentYear = new Date().getFullYear();
      setYearlyOverviewLoading(true);
      try {
        const { data } = await apiFetch<
          EndpointResponse<"yearlyOverviewRange">
        >(
          buildEndpointRequest("yearlyOverviewRange", {
            query: {
              start_year: currentYear - 1,
              end_year: currentYear,
            },
            token,
          }),
        );
        const byYear = (data.items ?? []).reduce<
          Record<number, YearlyOverviewResponse>
        >((acc, item) => {
          acc[item.year] = item;
          return acc;
        }, {});
        setYearlyOverviewsByYear(byYear);
        setYearlyOverview(byYear[currentYear] ?? null);
      } catch (err) {
        console.error("Failed to fetch yearly overview", err);
        setYearlyOverviewsByYear({});
        setYearlyOverview(null);
      } finally {
        setYearlyOverviewLoading(false);
      }
    };
    void loadYearlyOverview();
  }, [token]);

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const currentYearOverview = yearlyOverviewsByYear[currentYear];
    if (!currentYearOverview || !activeAccounts.length) {
      setAccountDeltas({});
      return;
    }
    const activeAccountIds = new Set(
      activeAccounts.map((account) => account.id),
    );
    const deltaMap: Record<string, number> = {};
    currentYearOverview.account_flows.forEach((flow) => {
      if (!activeAccountIds.has(flow.account_id)) return;
      deltaMap[flow.account_id] = (flow.monthly_change ?? []).reduce(
        (sum, value) => sum + Number(value),
        0,
      );
    });
    setAccountDeltas(deltaMap);
  }, [activeAccounts, yearlyOverviewsByYear]);

  const kpis: KPI[] = useMemo(() => {
    const rollingSlots = buildRollingMonthSlots();
    const cashFlowSource = filteredMonthly.length
      ? filteredMonthly
      : monthlyWindowData.length
        ? monthlyWindowData
        : monthly.data || [];
    const byMonth = new Map<string, { income: number; expense: number }>();
    cashFlowSource.forEach((entry) => {
      byMonth.set(getPeriodMonthKey(entry.period), {
        income: Number(entry.income),
        expense: Number(entry.expense),
      });
    });
    const trailing = rollingSlots.map((slot) => byMonth.get(slot.monthKey));
    const trailingIncome = trailing.reduce(
      (sum, entry) => sum + (entry?.income ?? 0),
      0,
    );
    const trailingExpense = trailing.reduce(
      (sum, entry) => sum + (entry?.expense ?? 0),
      0,
    );
    const trailingNet = trailingIncome - trailingExpense;
    const trailingSavingsRate =
      trailingIncome > 0 ? Math.round((trailingNet / trailingIncome) * 100) : 0;
    const netWorthNow = netWorth.data?.length
      ? Number(netWorth.data[netWorth.data.length - 1]?.net_worth)
      : numberFromString(total.data?.net);

    return [
      {
        title: "Net worth",
        value: currency(netWorthNow),
        trend: netWorthNow >= 0 ? "up" : "down",
        helper: "As of now",
      },
      {
        title: "Cash flow (12m)",
        value: currency(trailingNet),
        delta: formatCurrencyDelta(trailingNet, currency),
        trend: trailingNet >= 0 ? "up" : "down",
        helper: "Last 12 months",
      },
      {
        title: "Savings rate",
        value: `${trailingSavingsRate}%`,
        helper: "Income retained (last 12 months)",
        trend: trailingSavingsRate >= 0 ? "up" : "down",
      },
    ];
  }, [
    filteredMonthly,
    monthly.data,
    monthlyWindowData,
    netWorth.data,
    total.data,
  ]);

  const incomeExpenseChart = useMemo(() => {
    const rollingSlots = buildRollingMonthSlots();
    const source = filteredMonthly.length
      ? filteredMonthly
      : monthlyWindowData.length
        ? monthlyWindowData
        : monthly.data || [];
    const byMonth = new Map<string, { income: number; expense: number }>();

    source.forEach((entry) => {
      byMonth.set(getPeriodMonthKey(entry.period), {
        income: Number(entry.income),
        expense: Number(entry.expense),
      });
    });

    return rollingSlots.map((slot) => {
      const entry = byMonth.get(slot.monthKey);
      return {
        month: MONTH_LABELS[slot.monthIndex] ?? "",
        label: slot.label,
        monthIndex: slot.monthIndex,
        year: slot.year,
        monthKey: slot.monthKey,
        income: entry?.income ?? 0,
        expense: entry?.expense ?? 0,
      };
    });
  }, [monthly.data, filteredMonthly, monthlyWindowData]);

  const rollingCategoryBreakdown = useMemo(() => {
    const rollingSlots = buildRollingMonthSlots();
    const incomeTotals = new Map<
      string,
      { name: string; total: number; color?: string }
    >();
    const expenseTotals = new Map<
      string,
      { name: string; total: number; color?: string }
    >();

    const addTotals = (
      rows:
        | YearlyOverviewResponse["income_category_breakdown"]
        | YearlyOverviewResponse["category_breakdown"],
      monthIndex: number,
      target: Map<string, { name: string; total: number; color?: string }>,
    ) => {
      rows.forEach((row) => {
        const amount = Math.abs(Number(row.monthly[monthIndex] ?? 0));
        if (!Number.isFinite(amount) || amount <= 0) return;
        const key = row.category_id ?? row.name;
        const existing = target.get(key);
        if (existing) {
          existing.total += amount;
          return;
        }
        target.set(key, {
          name: row.name,
          total: amount,
          color: row.color_hex ?? undefined,
        });
      });
    };

    rollingSlots.forEach((slot) => {
      const overview = yearlyOverviewsByYear[slot.year];
      if (!overview) return;
      addTotals(
        overview.income_category_breakdown,
        slot.monthIndex,
        incomeTotals,
      );
      addTotals(overview.category_breakdown, slot.monthIndex, expenseTotals);
    });

    const income = Array.from(incomeTotals.values()).sort(
      (a, b) => b.total - a.total,
    );
    const expense = Array.from(expenseTotals.values()).sort(
      (a, b) => b.total - a.total,
    );
    const incomeTotal = income.reduce((sum, row) => sum + row.total, 0);
    const expenseTotal = expense.reduce((sum, row) => sum + row.total, 0);

    return { income, expense, incomeTotal, expenseTotal };
  }, [yearlyOverviewsByYear]);

  const categoryBreakdown = useMemo(() => {
    const { incomeTotal, expenseTotal } = rollingCategoryBreakdown;
    return incomeTotal || expenseTotal
      ? [
          { name: "Income", value: incomeTotal },
          { name: "Expenses", value: expenseTotal },
        ]
      : [];
  }, [rollingCategoryBreakdown]);

  const savingsRateData = useMemo(() => {
    const rollingSlots = buildRollingMonthSlots();
    const source = filteredMonthly.length
      ? filteredMonthly
      : monthlyWindowData.length
        ? monthlyWindowData
        : monthly.data || [];
    const byMonth = new Map<string, { income: number; expense: number }>();
    source.forEach((entry) => {
      byMonth.set(getPeriodMonthKey(entry.period), {
        income: Number(entry.income),
        expense: Number(entry.expense),
      });
    });
    return rollingSlots.map((slot) => {
      const income = byMonth.get(slot.monthKey)?.income ?? 0;
      const expense = byMonth.get(slot.monthKey)?.expense ?? 0;
      const status: SavingsMonthStatus =
        income <= 0 && expense <= 0
          ? "no-activity"
          : income <= 0
            ? "no-income"
            : "normal";
      const rate =
        income > 0 ? Math.round(((income - expense) / income) * 100) : 0;
      return {
        month: MONTH_LABELS[slot.monthIndex] ?? "",
        label: slot.label,
        rate,
        income,
        expense,
        status,
      };
    });
  }, [monthly.data, filteredMonthly, monthlyWindowData]);

  const savingsStatusSummary = useMemo(() => {
    return savingsRateData.reduce(
      (acc, point) => {
        if (point.status === "no-income") acc.noIncomeMonths += 1;
        if (point.status === "no-activity") acc.noActivityMonths += 1;
        return acc;
      },
      { noIncomeMonths: 0, noActivityMonths: 0 },
    );
  }, [savingsRateData]);

  const netWorthData = useMemo(() => {
    const points = netWorth.data || [];
    return points.map((point) => ({
      date: point.period,
      net: Number(point.net_worth),
      year: getPeriodYear(point.period),
    }));
  }, [netWorth.data]);

  const netWorthDomain = useMemo<[number, number]>(() => {
    if (!netWorthData.length) return [0, 0];
    const values = netWorthData.map((d) => d.net);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const upperPad = Math.abs(max) * 0.05 || 1;
    const lowerPad = Math.abs(min) * 0.1 || 1;
    const lower = min < 0 ? min - lowerPad : 0;
    const upper = max + upperPad;
    return [lower, upper];
  }, [netWorthData]);

  const cashOnHand = useMemo(
    () =>
      activeAccounts.reduce((sum, account) => {
        const bal = Number(account.balance);
        return sum + (Number.isFinite(bal) ? bal : 0);
      }, 0),
    [activeAccounts],
  );

  const runwayMetrics = useMemo(() => {
    const rollingSlots = buildRollingMonthSlots();
    const source = filteredMonthly.length
      ? filteredMonthly
      : monthlyWindowData.length
        ? monthlyWindowData
        : monthly.data || [];
    const byMonth = new Map<string, { income: number; expense: number }>();
    source.forEach((entry) => {
      byMonth.set(getPeriodMonthKey(entry.period), {
        income: Number(entry.income),
        expense: Number(entry.expense),
      });
    });
    const rollingData = rollingSlots.map((slot) => {
      const entry = byMonth.get(slot.monthKey);
      const income = entry?.income ?? 0;
      const expense = entry?.expense ?? 0;
      return {
        month: slot.label,
        income,
        expense,
        net: income - expense,
      };
    });

    const avgBurn =
      rollingData.reduce((sum, entry) => sum + Math.max(entry.expense, 0), 0) /
      rollingData.length;
    const avgIncome =
      rollingData.reduce((sum, entry) => sum + Math.max(entry.income, 0), 0) /
      rollingData.length;
    const nets = rollingData.map((entry) => entry.net);
    const lastNet = nets[nets.length - 1] ?? 0;
    const prevNet = nets[nets.length - 2] ?? lastNet;
    const trend =
      lastNet > prevNet ? "up" : lastNet < prevNet ? "down" : "neutral";

    let running = 0;
    const sparkline = rollingData.map((entry) => {
      running += entry.net;
      return {
        month: entry.month,
        balance: running,
      };
    });

    const months = avgBurn > 0 ? cashOnHand / avgBurn : null;

    return { avgBurn, avgIncome, months, trend, lastNet, prevNet, sparkline };
  }, [cashOnHand, filteredMonthly, monthly.data, monthlyWindowData]);

  const recentTransactions = useMemo<DashboardRecentTransaction[]>(() => {
    return recent.items.map((tx) => {
      const primaryLeg = tx.legs?.[0];
      const amount = primaryLeg ? Number(primaryLeg.amount) : 0;
      const txType = getDisplayTransactionType(tx);
      const typeLabel = getTransactionTypeLabel(tx);

      const accountLabel = (() => {
        const legs = tx.legs ?? [];
        if (!legs.length) return "—";
        if (txType === TransactionType.TRANSFER) {
          const fromLeg = legs.find((leg) => Number(leg.amount) < 0);
          const toLeg = legs.find((leg) => Number(leg.amount) > 0);
          const fromName = fromLeg
            ? (accountNameById.get(fromLeg.account_id) ?? "Unknown")
            : "Unknown";
          const toName = toLeg
            ? (accountNameById.get(toLeg.account_id) ?? "Unknown")
            : "Unknown";
          return `${fromName} → ${toName}`;
        }

        const preferredSign = txType === TransactionType.EXPENSE ? -1 : 1;
        const preferred =
          legs.find(
            (leg) =>
              Number(leg.amount) * preferredSign > 0 &&
              accountNameById.has(leg.account_id),
          ) ??
          legs.find((leg) => accountNameById.has(leg.account_id)) ??
          legs[0];
        return preferred
          ? (accountNameById.get(preferred.account_id) ?? "Unknown")
          : "—";
      })();

      const category = tx.category_id
        ? (categoryById.get(tx.category_id) ?? null)
        : null;

      return {
        id: tx.id,
        description: tx.description?.trim() || "Transaction",
        amount,
        occurred_at: tx.occurred_at,
        accountLabel,
        category,
        type: txType,
        typeLabel,
      };
    });
  }, [accountNameById, categoryById, recent.items]);

  const filteredRecentTransactions = useMemo(() => {
    if (recentTab === "all") return recentTransactions;
    return recentTransactions.filter((tx) =>
      tx.type === TransactionType.TRANSFER
        ? false
        : recentTab === "income"
          ? tx.type === TransactionType.INCOME || tx.amount > 0
          : tx.type === TransactionType.EXPENSE || tx.amount < 0,
    );
  }, [recentTab, recentTransactions]);

  return (
    <MotionPage className="space-y-4">
      <StaggerWrap className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <motion.div variants={fadeInUp}>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Overview
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Your money at a glance
          </h1>
          <p className="text-sm text-slate-500">
            Live net worth, cash flow, and savings snapshot.
          </p>
        </motion.div>
        <motion.div variants={fadeInUp} className="flex flex-wrap gap-2">
          <motion.div {...subtleHover}>
            <Button asChild variant="default" className="gap-2">
              <Link to={PageRoutes.transactions}>
                <Plus className="h-4 w-4" />
                Add transaction
              </Link>
            </Button>
          </motion.div>
          <motion.div {...subtleHover}>
            <Button
              asChild
              variant="outline"
              className="gap-2 border-slate-300 text-slate-800"
            >
              <Link to={PageRoutes.imports}>
                <Upload className="h-4 w-4" />
                Import file
              </Link>
            </Button>
          </motion.div>
        </motion.div>
      </StaggerWrap>

      <StaggerWrap className="grid gap-3 md:grid-cols-3">
        {kpis.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            variants={fadeInUp}
            {...subtleHover}
            transition={{
              duration: 0.35,
              ease: "easeOut",
              delay: index * 0.05,
            }}
          >
            <Card className="border-slate-200 bg-white shadow-[0_10px_30px_-24px_rgba(30,64,175,0.6)]">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                      {kpi.title}
                    </p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">
                      {kpi.value}
                    </p>
                    {kpi.helper ? (
                      <p className="text-xs text-slate-500">{kpi.helper}</p>
                    ) : null}
                  </div>
                  {kpi.delta ? (
                    <span
                      className={`flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                        kpi.trend === "up"
                          ? "bg-green-50 text-green-700"
                          : "bg-red-50 text-red-700"
                      }`}
                    >
                      {kpi.trend === "up" ? (
                        <ArrowUpRight className="mr-1 h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="mr-1 h-4 w-4" />
                      )}
                      {kpi.delta}
                    </span>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </StaggerWrap>

      <StaggerWrap className="grid gap-4 md:grid-cols-2">
        <motion.div variants={fadeInUp}>
          <IncomeExpenseChartCard
            data={incomeExpenseChart}
            loading={monthly.loading}
            yearlyOverview={yearlyOverview}
            yearlyOverviewLoading={yearlyOverviewLoading}
          />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <NetWorthChartCard
            data={netWorthData}
            loading={netWorth.loading}
            domain={netWorthDomain}
          />
        </motion.div>
      </StaggerWrap>

      <StaggerWrap className="grid gap-4 xl:grid-cols-[1fr_1.5fr_1fr]">
        <motion.div variants={fadeInUp}>
          <CategoryMixChartCard
            loading={yearlyOverviewLoading}
            categoryBreakdown={categoryBreakdown}
            rollingBreakdown={rollingCategoryBreakdown}
          />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <SavingsRateChartCard
            loading={monthly.loading}
            data={savingsRateData}
            summary={savingsStatusSummary}
          />
        </motion.div>
        <motion.div variants={fadeInUp} {...subtleHover}>
          <QuickActionsCard />
        </motion.div>
      </StaggerWrap>

      <StaggerWrap className="grid gap-4 md:grid-cols-2">
        <motion.div variants={fadeInUp} className="h-full">
          <Card className="flex h-full flex-col border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Cash on hand
              </CardTitle>
              <p className="text-sm text-slate-500">Active accounts combined</p>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              {accountsLoading ? (
                <Skeleton className="h-10 w-40" />
              ) : (
                <div className="text-3xl font-semibold text-slate-900">
                  {currency(cashOnHand)}
                </div>
              )}
              <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
                {activeAccounts.map((account) => {
                  const delta = accountDeltas[account.id] ?? 0;
                  const isPositive = delta >= 0;
                  return (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <AccountIcon icon={account.icon} name={account.name} />
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {account.name}
                          </p>
                          <p
                            className={`text-xs ${isPositive ? "text-emerald-600" : "text-rose-600"}`}
                          >
                            {isPositive ? "+" : "−"}
                            {currency(Math.abs(delta))} this year
                          </p>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {currency(Number(account.balance))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp} className="h-full">
          <Card className="flex h-full flex-col border-slate-200 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.25)]">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Cash runway
                </CardTitle>
                <p className="text-sm text-slate-500">
                  Based on average burn (last 12 months, non-investment
                  accounts)
                </p>
              </div>
              {runwayMetrics.trend === "up" ? (
                <ArrowUpRight className="h-5 w-5 text-emerald-500" />
              ) : runwayMetrics.trend === "down" ? (
                <ArrowDownRight className="h-5 w-5 text-rose-500" />
              ) : null}
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              {monthly.loading || accountsLoading ? (
                <Skeleton className="h-10 w-48" />
              ) : runwayMetrics.months === null ? (
                <p className="text-sm text-slate-500">
                  Add expense history to estimate runway.
                </p>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                    Runway
                  </div>
                  <div className="text-3xl font-semibold text-slate-900">
                    {`${runwayMetrics.months.toFixed(1)} months`}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 text-sm text-slate-700">
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-xs text-slate-500">Avg monthly burn</p>
                  <p className="text-base font-semibold text-rose-600">
                    {currency(runwayMetrics.avgBurn)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-xs text-slate-500">Avg monthly income</p>
                  <p className="text-base font-semibold text-emerald-600">
                    {currency(runwayMetrics.avgIncome)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-xs text-slate-500">Last month net</p>
                  <p
                    className={`text-base font-semibold ${
                      runwayMetrics.lastNet >= 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {currency(runwayMetrics.lastNet)}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
                  <p className="text-xs text-slate-500">Previous month net</p>
                  <p
                    className={`text-base font-semibold ${
                      runwayMetrics.prevNet >= 0
                        ? "text-emerald-600"
                        : "text-rose-600"
                    }`}
                  >
                    {currency(runwayMetrics.prevNet)}
                  </p>
                </div>
              </div>
              {runwayMetrics.sparkline.length ? (
                <div className="min-h-36 flex-1 rounded-lg border border-slate-100 p-3">
                  <ChartContainer
                    className="!aspect-auto h-full w-full"
                    config={{
                      balance: { label: "Cash trend", color: "#0ea5e9" },
                    }}
                  >
                    <AreaChart
                      data={runwayMetrics.sparkline}
                      margin={{ left: 0, right: 0, top: 6, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="cashSpark"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#0ea5e9"
                            stopOpacity={0.25}
                          />
                          <stop
                            offset="95%"
                            stopColor="#0ea5e9"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" hide />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltipContent />} />
                      <Area
                        type="monotoneX"
                        dataKey="balance"
                        stroke="#0ea5e9"
                        fill="url(#cashSpark)"
                        strokeWidth={2}
                        name="Cash trend"
                        dot={false}
                      />
                    </AreaChart>
                  </ChartContainer>
                </div>
              ) : (
                <Skeleton className="min-h-36 w-full flex-1" />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </StaggerWrap>

      <motion.div variants={fadeInUp}>
        <RecentTransactionsCard
          loading={recent.loading}
          tab={recentTab}
          onTabChange={setRecentTab}
          transactions={filteredRecentTransactions}
        />
      </motion.div>
    </MotionPage>
  );
};
