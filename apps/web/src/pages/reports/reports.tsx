import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { PageRoutes } from "@/data/routes";
import { selectToken } from "@/features/auth/authSlice";
import { apiFetch } from "@/lib/apiClient";
import type {
  TotalOverviewResponse,
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
} from "@/types/api";
import {
  monthlyReportSchema,
  totalOverviewSchema,
  yearlyCategoryDetailSchema,
  yearlyOverviewSchema,
} from "@/types/schemas";
import { ReportsHeader } from "./components/reports-header";
import { ReportsOverviewCard } from "./components/reports-overview-card";
import { TotalAccountsOverviewCard } from "./components/total-accounts-overview-card";
import { TotalCategoryByYearCard } from "./components/total-category-by-year-card";
import { TotalCategoryChangesCard } from "./components/total-category-changes-card";
import { TotalCategoryMixCard } from "./components/total-category-mix-card";
import { TotalCompositionOverTimeCard } from "./components/total-composition-over-time-card";
import { TotalDebtOverviewCard } from "./components/total-debt-overview-card";
import { TotalDrilldownDialog } from "./components/total-drilldown-dialog";
import { TotalHeatmapDialog } from "./components/total-heatmap-dialog";
import { TotalInvestmentsSnapshotCard } from "./components/total-investments-snapshot-card";
import { TotalLifetimeCategoriesCard } from "./components/total-lifetime-categories-card";
import { TotalNetWorthBreakdownCard } from "./components/total-net-worth-breakdown-card";
import { TotalNetWorthGrowthCard } from "./components/total-net-worth-growth-card";
import { TotalNetWorthTrajectoryCard } from "./components/total-net-worth-trajectory-card";
import { TotalSavingsRateCard } from "./components/total-savings-rate-card";
import { TotalSeasonalityCard } from "./components/total-seasonality-card";
import { TotalSourcesCard } from "./components/total-sources-card";
import { TotalTimeseriesDialog } from "./components/total-timeseries-dialog";
import { TotalYearByYearPerformanceCard } from "./components/total-year-by-year-performance-card";
import { YearlyAccountFlowsCard } from "./components/yearly-account-flows-card";
import { YearlyCategoryBreakdownCard } from "./components/yearly-category-breakdown-card";
import { YearlyCategoryDetailDialog } from "./components/yearly-category-detail-dialog";
import { YearlyCategoryHeatmapCard } from "./components/yearly-category-heatmap-card";
import { YearlyDebtCard } from "./components/yearly-debt-card";
import { YearlyDetailDialog } from "./components/yearly-detail-dialog";
import { YearlyDriversGrid } from "./components/yearly-drivers-grid";
import { YearlyExtraDialog } from "./components/yearly-extra-dialog";
import { YearlyIncomeExpenseCard } from "./components/yearly-income-expense-card";
import { YearlyInvestmentsSummaryCard } from "./components/yearly-investments-summary-card";
import { YearlyNetWorthGrowthCard } from "./components/yearly-net-worth-growth-card";
import { YearlySavingsRateCard } from "./components/yearly-savings-rate-card";
import { YearlySourcesGrid } from "./components/yearly-sources-grid";
import { YearlySummaryCard } from "./components/yearly-summary-card";
import { YearlyTransactionsAndChangesRow } from "./components/yearly-transactions-and-changes-row";
import { MoneyFlowSankeyCard } from "./reports-sankey";
import type {
  DetailDialogState,
  ReportMode,
  TotalDrilldownState,
  TotalHeatmapDialogState,
  TotalTimeseriesDialogState,
  YearlyExtraDialogState,
} from "./reports-types";
import { median, medianAbsoluteDeviation, monthLabel } from "./reports-utils";

export const Reports: React.FC = () => {
  const token = useAppSelector(selectToken);
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams<{ year?: string }>();
  const isTotalRoute = location.pathname.startsWith(PageRoutes.reportsTotal);
  const isYearlyRoute = location.pathname.startsWith(PageRoutes.reportsYearly);
  const routeMode: ReportMode = isTotalRoute ? "total" : "yearly";
  const currentYear = new Date().getFullYear();
  const year = isYearlyRoute ? Number(params.year) || currentYear : currentYear;
  const [overview, setOverview] = useState<YearlyOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [prevOverview, setPrevOverview] =
    useState<YearlyOverviewResponse | null>(null);
  const [prevOverviewLoading, setPrevOverviewLoading] = useState(false);
  const [totalOverview, setTotalOverview] =
    useState<TotalOverviewResponse | null>(null);
  const [totalOverviewLoading, setTotalOverviewLoading] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [selectedCategoryFlow, setSelectedCategoryFlow] = useState<
    "expense" | "income"
  >("expense");
  const [categoryDetail, setCategoryDetail] =
    useState<YearlyCategoryDetailResponse | null>(null);
  const [categoryDetailLoading, setCategoryDetailLoading] = useState(false);
  const [detailDialog, setDetailDialog] = useState<DetailDialogState | null>(
    null,
  );
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [yearlyExtraDialog, setYearlyExtraDialog] =
    useState<YearlyExtraDialogState | null>(null);
  const [totalWindowPreset, setTotalWindowPreset] = useState<
    "all" | "10" | "5" | "3"
  >("all");
  const [totalDrilldown, setTotalDrilldown] =
    useState<TotalDrilldownState | null>(null);
  const [totalDrilldownOpen, setTotalDrilldownOpen] = useState(false);
  const [totalDrilldownLoading, setTotalDrilldownLoading] = useState(false);
  const [totalDrilldownError, setTotalDrilldownError] = useState<string | null>(
    null,
  );
  const [totalDrilldownSeries, setTotalDrilldownSeries] = useState<
    Array<{ period: string; income: number; expense: number; net: number }>
  >([]);
  const [totalYearDrilldown, setTotalYearDrilldown] =
    useState<YearlyOverviewResponse | null>(null);
  const [totalYearDrilldownLoading, setTotalYearDrilldownLoading] =
    useState(false);
  const [totalYearDrilldownError, setTotalYearDrilldownError] = useState<
    string | null
  >(null);
  const [totalHeatmapDialog, setTotalHeatmapDialog] =
    useState<TotalHeatmapDialogState | null>(null);
  const [totalHeatmapDialogOpen, setTotalHeatmapDialogOpen] = useState(false);
  const [totalTimeseriesDialog, setTotalTimeseriesDialog] =
    useState<TotalTimeseriesDialogState | null>(null);
  const [totalTimeseriesDialogOpen, setTotalTimeseriesDialogOpen] =
    useState(false);

  const yearOptions = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 11 }, (_, idx) => current - idx);
  }, []);

  useEffect(() => {
    if (!isYearlyRoute) return;
    const parsed = Number(params.year);
    if (Number.isFinite(parsed) && parsed > 1900 && parsed < 3000) return;
    navigate(`${PageRoutes.reportsYearly}/${currentYear}`, { replace: true });
  }, [currentYear, isYearlyRoute, navigate, params.year]);

  useEffect(() => {
    const loadOverview = async () => {
      if (!token) return;
      if (!isYearlyRoute) return;
      setOverviewLoading(true);
      try {
        const { data } = await apiFetch<YearlyOverviewResponse>({
          path: "/reports/yearly-overview",
          schema: yearlyOverviewSchema,
          query: { year },
          token,
        });
        setOverview(data);
      } catch (error) {
        console.error(error);
        setOverview(null);
      } finally {
        setOverviewLoading(false);
      }
    };
    void loadOverview();
  }, [isYearlyRoute, token, year]);

  useEffect(() => {
    const loadPrevOverview = async () => {
      if (!token) return;
      if (!isYearlyRoute) return;
      if (year <= 1900) {
        setPrevOverview(null);
        return;
      }
      setPrevOverviewLoading(true);
      try {
        const { data } = await apiFetch<YearlyOverviewResponse>({
          path: "/reports/yearly-overview",
          schema: yearlyOverviewSchema,
          query: { year: year - 1 },
          token,
        });
        setPrevOverview(data);
      } catch (error) {
        console.error(error);
        setPrevOverview(null);
      } finally {
        setPrevOverviewLoading(false);
      }
    };
    void loadPrevOverview();
  }, [isYearlyRoute, token, year]);

  useEffect(() => {
    const loadTotalOverview = async () => {
      if (!token) return;
      if (!isTotalRoute) return;
      setTotalOverviewLoading(true);
      try {
        const { data } = await apiFetch<TotalOverviewResponse>({
          path: "/reports/total-overview",
          schema: totalOverviewSchema,
          token,
        });
        setTotalOverview(data);
      } catch (error) {
        console.error(error);
        setTotalOverview(null);
      } finally {
        setTotalOverviewLoading(false);
      }
    };
    void loadTotalOverview();
  }, [isTotalRoute, token]);

  const totalAllRange = useMemo(() => {
    if (!totalOverview) return null;
    const years = totalOverview.yearly.map((row) => row.year);
    const minYear = years.length
      ? Math.min(...years)
      : new Date().getFullYear();
    return {
      start: `${minYear}-01-01`,
      end: totalOverview.as_of.slice(0, 10),
    };
  }, [totalOverview]);

  const totalWindowRange = useMemo(() => {
    if (!totalAllRange) return null;
    if (totalWindowPreset === "all") return totalAllRange;
    const asOfYear = Number(totalAllRange.end.slice(0, 4));
    const minYear = Number(totalAllRange.start.slice(0, 4));
    const yearsBack = Number(totalWindowPreset);
    const startYear = Math.max(minYear, asOfYear - yearsBack + 1);
    return { start: `${startYear}-01-01`, end: totalAllRange.end };
  }, [totalAllRange, totalWindowPreset]);

  useEffect(() => {
    const loadDrilldown = async () => {
      if (!token) return;
      if (routeMode !== "total") return;
      if (!totalDrilldownOpen) return;
      if (!totalWindowRange) return;
      if (!totalDrilldown) return;
      if (
        totalDrilldown.kind !== "category" &&
        totalDrilldown.kind !== "source" &&
        totalDrilldown.kind !== "account"
      ) {
        setTotalDrilldownSeries([]);
        setTotalDrilldownError(null);
        return;
      }

      setTotalDrilldownLoading(true);
      setTotalDrilldownError(null);
      try {
        const accountIds =
          totalDrilldown.kind === "account"
            ? totalDrilldown.accountId
            : undefined;
        const categoryIds =
          totalDrilldown.kind === "category"
            ? totalDrilldown.categoryId
            : undefined;
        const source =
          totalDrilldown.kind === "source" ? totalDrilldown.source : undefined;

        const { data } = await apiFetch<{
          results: Array<{
            period: string;
            income: string;
            expense: string;
            net: string;
          }>;
        }>({
          path: "/reports/custom",
          schema: monthlyReportSchema,
          query: {
            start_date: totalWindowRange.start,
            end_date: totalWindowRange.end,
            ...(accountIds ? { account_ids: accountIds } : {}),
            ...(categoryIds ? { category_ids: categoryIds } : {}),
            ...(source ? { source } : {}),
          },
          token,
        });

        setTotalDrilldownSeries(
          data.results.map((row) => ({
            period: row.period,
            income: Number(row.income),
            expense: Number(row.expense),
            net: Number(row.net),
          })),
        );
      } catch (error) {
        console.error(error);
        setTotalDrilldownSeries([]);
        setTotalDrilldownError("Failed to load drilldown.");
      } finally {
        setTotalDrilldownLoading(false);
      }
    };
    void loadDrilldown();
  }, [routeMode, token, totalDrilldown, totalDrilldownOpen, totalWindowRange]);

  useEffect(() => {
    const loadYearDrilldown = async () => {
      if (!token) return;
      if (routeMode !== "total") return;
      if (!totalDrilldownOpen) return;
      if (!totalDrilldown || totalDrilldown.kind !== "year") return;

      setTotalYearDrilldownLoading(true);
      setTotalYearDrilldownError(null);
      setTotalYearDrilldown(null);

      try {
        const { data } = await apiFetch<YearlyOverviewResponse>({
          path: "/reports/yearly-overview",
          schema: yearlyOverviewSchema,
          query: { year: totalDrilldown.year },
          token,
        });
        setTotalYearDrilldown(data);
      } catch (error) {
        console.error(error);
        setTotalYearDrilldown(null);
        setTotalYearDrilldownError("Failed to load yearly details.");
      } finally {
        setTotalYearDrilldownLoading(false);
      }
    };

    void loadYearDrilldown();
  }, [routeMode, token, totalDrilldown, totalDrilldownOpen]);

  useEffect(() => {
    const loadCategoryDetail = async () => {
      if (!token) return;
      if (!selectedCategoryId) return;
      setCategoryDetailLoading(true);
      setCategoryDetail(null);
      try {
        const { data } = await apiFetch<YearlyCategoryDetailResponse>({
          path: "/reports/yearly-category-detail",
          schema: yearlyCategoryDetailSchema,
          query: {
            year,
            category_id: selectedCategoryId,
            flow: selectedCategoryFlow,
          },
          token,
        });
        setCategoryDetail(data);
      } catch (error) {
        console.error(error);
        setCategoryDetail(null);
      } finally {
        setCategoryDetailLoading(false);
      }
    };
    void loadCategoryDetail();
  }, [selectedCategoryFlow, selectedCategoryId, token, year]);

  const categoryDetailPrevMonthly = useMemo(() => {
    if (!prevOverview) return null;
    if (!selectedCategoryId) return null;
    const rows =
      selectedCategoryFlow === "income"
        ? prevOverview.income_category_breakdown
        : prevOverview.category_breakdown;
    const match = rows.find((row) => row.category_id === selectedCategoryId);
    if (!match) return null;
    return match.monthly.map((value) => Number(value));
  }, [prevOverview, selectedCategoryFlow, selectedCategoryId]);

  const yearOverviewMonthChart = useMemo(
    () =>
      (overview?.monthly || []).map((row, monthIndex) => ({
        month: monthLabel(row.date),
        monthIndex,
        income: Number(row.income),
        expense: Number(row.expense),
        net: Number(row.net),
      })),
    [overview?.monthly],
  );

  const yearSeasonalityChart = useMemo(
    () =>
      yearOverviewMonthChart.map((row) => ({
        ...row,
        expense: Number.isFinite(row.expense) ? Math.abs(row.expense) : null,
      })),
    [yearOverviewMonthChart],
  );

  const netWorthChart = useMemo(
    () =>
      (overview?.net_worth || []).map((row) => ({
        date: row.date,
        net: Number(row.net_worth),
        year: new Date(row.date).getFullYear(),
      })),
    [overview?.net_worth],
  );

  const netWorthDomain = useMemo<[number, number]>(() => {
    if (!netWorthChart.length) return [0, 0];
    const values = netWorthChart.map((d) => d.net);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const upperPad = Math.abs(max) * 0.05 || 1;
    const lower = min;
    const upper = max + upperPad;
    return [lower, upper];
  }, [netWorthChart]);

  const netWorthQuarterMarkers = useMemo(() => {
    const quarterStartMonths = new Set([1, 4, 7, 10]);
    return netWorthChart
      .map((point) => {
        const date = new Date(point.date);
        const month = date.getMonth() + 1;
        const quarter = Math.floor((month - 1) / 3) + 1;
        return { date: point.date, month, quarter };
      })
      .filter((point) => quarterStartMonths.has(point.month))
      .map((point) => ({ date: point.date, label: `Q${point.quarter}` }));
  }, [netWorthChart]);

  const debtChart = useMemo(
    () =>
      (overview?.debt || []).map((row) => ({
        month: monthLabel(row.date),
        debt: Number(row.debt),
      })),
    [overview?.debt],
  );

  const categoryChartData = useMemo(() => {
    if (!overview?.category_breakdown) return [];
    return overview.category_breakdown.map((item) => ({
      id: item.category_id ?? null,
      name: item.name,
      total: Number(item.total),
      color: item.color_hex ?? "#ef4444",
      monthly: item.monthly.map((v) => Number(v)),
    }));
  }, [overview?.category_breakdown]);

  const heatmap = useMemo(() => {
    if (!categoryChartData.length) return { rows: [], max: 0 };
    const max = Math.max(
      ...categoryChartData.flatMap((item) => item.monthly),
      0,
    );
    return { rows: categoryChartData, max };
  }, [categoryChartData]);

  const incomeCategoryChartData = useMemo(() => {
    if (!overview?.income_category_breakdown) return [];
    return overview.income_category_breakdown.map((item) => ({
      id: item.category_id ?? null,
      name: item.name,
      total: Number(item.total),
      color: item.color_hex ?? "#10b981",
      monthly: item.monthly.map((v) => Number(v)),
    }));
  }, [overview?.income_category_breakdown]);

  const incomeHeatmap = useMemo(() => {
    if (!incomeCategoryChartData.length) return { rows: [], max: 0 };
    const max = Math.max(
      ...incomeCategoryChartData.flatMap((item) => item.monthly),
      0,
    );
    return { rows: incomeCategoryChartData, max };
  }, [incomeCategoryChartData]);

  const savings = overview?.savings
    ? {
        income: Number(overview.savings.income),
        expense: Number(overview.savings.expense),
        saved: Number(overview.savings.saved),
        rate: overview.savings.savings_rate_pct
          ? Number(overview.savings.savings_rate_pct)
          : null,
      }
    : null;

  const investmentsSummary = useMemo(() => {
    if (!overview?.investments_summary) return null;
    const monthly = overview.investments_summary.monthly_values.map(
      (value, idx) => ({
        month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
        value: Number(value),
      }),
    );
    const accounts = overview.investments_summary.accounts
      .map((row) => ({
        name: row.account_name,
        start: Number(row.start_value),
        end: Number(row.end_value),
        change: Number(row.change),
      }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    return {
      asOf: overview.investments_summary.as_of,
      start: Number(overview.investments_summary.start_value),
      end: Number(overview.investments_summary.end_value),
      change: Number(overview.investments_summary.change),
      changePct: overview.investments_summary.change_pct
        ? Number(overview.investments_summary.change_pct)
        : null,
      contributions: Number(overview.investments_summary.contributions),
      withdrawals: Number(overview.investments_summary.withdrawals),
      monthly,
      accounts,
    };
  }, [overview?.investments_summary, year]);

  const debtOverviewRows = useMemo(() => {
    if (!overview?.debt_overview) return [];
    return overview.debt_overview
      .map((row) => ({
        id: row.account_id,
        name: row.name || "Debt account",
        startDebt: Number(row.start_debt),
        endDebt: Number(row.end_debt),
        delta: Number(row.delta),
        monthly: row.monthly_debt.map((v, idx) => ({
          month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
          value: Number(v),
        })),
      }))
      .sort((a, b) => b.endDebt - a.endDebt);
  }, [overview?.debt_overview, year]);

  const accountFlowRows = useMemo(() => {
    if (!overview?.account_flows) return [];
    return overview.account_flows
      .map((row) => {
        const monthly = Array.from({ length: 12 }, (_, idx) => ({
          month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
          income: Number(row.monthly_income[idx] ?? 0),
          expense: Number(row.monthly_expense[idx] ?? 0),
          transfersIn: Number(row.monthly_transfers_in[idx] ?? 0),
          transfersOut: Number(row.monthly_transfers_out[idx] ?? 0),
          change: Number(row.monthly_change[idx] ?? 0),
        }));
        return {
          id: row.account_id,
          name: row.name || "Account",
          accountType: row.account_type,
          startBalance: Number(row.start_balance),
          endBalance: Number(row.end_balance),
          change: Number(row.change),
          netOperating: Number(row.net_operating),
          netTransfers: Number(row.net_transfers),
          income: Number(row.income),
          expense: Number(row.expense),
          transfersIn: Number(row.transfers_in),
          transfersOut: Number(row.transfers_out),
          monthly,
        };
      })
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }, [overview?.account_flows, year]);

  const incomeSourceRows = useMemo(() => {
    if (!overview?.income_sources) return [];
    return overview.income_sources
      .map((row) => ({
        source: row.source,
        total: Number(row.total),
        txCount: row.transaction_count,
        monthly: row.monthly.map((v, idx) => ({
          month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
          total: Number(v),
        })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [overview?.income_sources, year]);

  const expenseSourceRows = useMemo(() => {
    if (!overview?.expense_sources) return [];
    return overview.expense_sources
      .map((row) => ({
        source: row.source,
        total: Number(row.total),
        txCount: row.transaction_count,
        monthly: row.monthly.map((v, idx) => ({
          month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
          total: Number(v),
        })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [overview?.expense_sources, year]);

  const prevIncomeSourceRows = useMemo(() => {
    if (!prevOverview?.income_sources) return [];
    const prevYear = year - 1;
    return prevOverview.income_sources
      .map((row) => ({
        source: row.source,
        total: Number(row.total),
        txCount: row.transaction_count,
        monthly: row.monthly.map((v, idx) => ({
          month: monthLabel(new Date(Date.UTC(prevYear, idx, 1)).toISOString()),
          total: Number(v),
        })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [prevOverview?.income_sources, year]);

  const prevExpenseSourceRows = useMemo(() => {
    if (!prevOverview?.expense_sources) return [];
    const prevYear = year - 1;
    return prevOverview.expense_sources
      .map((row) => ({
        source: row.source,
        total: Number(row.total),
        txCount: row.transaction_count,
        monthly: row.monthly.map((v, idx) => ({
          month: monthLabel(new Date(Date.UTC(prevYear, idx, 1)).toISOString()),
          total: Number(v),
        })),
      }))
      .sort((a, b) => b.total - a.total);
  }, [prevOverview?.expense_sources, year]);

  const yearlyExpenseCategoryDeltas = useMemo(() => {
    if (!overview || !prevOverview) return [];
    const currentMap = new Map<
      string,
      { id: string | null; name: string; total: number }
    >();
    overview.category_breakdown.forEach((row) => {
      const key =
        row.category_id ??
        (typeof row.name === "string" ? `name:${row.name}` : "unknown");
      currentMap.set(key, {
        id: row.category_id ?? null,
        name: row.name,
        total: Number(row.total),
      });
    });
    const prevMap = new Map<
      string,
      { id: string | null; name: string; total: number }
    >();
    prevOverview.category_breakdown.forEach((row) => {
      const key =
        row.category_id ??
        (typeof row.name === "string" ? `name:${row.name}` : "unknown");
      prevMap.set(key, {
        id: row.category_id ?? null,
        name: row.name,
        total: Number(row.total),
      });
    });

    const keys = new Set([...currentMap.keys(), ...prevMap.keys()]);
    return Array.from(keys)
      .map((key) => {
        const currentRow = currentMap.get(key);
        const prevRow = prevMap.get(key);
        const current = currentRow?.total ?? 0;
        const prev = prevRow?.total ?? 0;
        const delta = current - prev;
        const deltaPct = prev > 0 ? (delta / prev) * 100 : null;
        return {
          key,
          id: currentRow?.id ?? prevRow?.id ?? null,
          name: currentRow?.name ?? prevRow?.name ?? "Category",
          current,
          prev,
          delta,
          deltaPct,
        };
      })
      .filter((row) => row.name !== "Other")
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [overview, prevOverview]);

  const yearlyIncomeCategoryDeltas = useMemo(() => {
    if (!overview || !prevOverview) return [];
    const currentMap = new Map<
      string,
      { id: string | null; name: string; total: number }
    >();
    overview.income_category_breakdown.forEach((row) => {
      const key =
        row.category_id ??
        (typeof row.name === "string" ? `name:${row.name}` : "unknown");
      currentMap.set(key, {
        id: row.category_id ?? null,
        name: row.name,
        total: Number(row.total),
      });
    });
    const prevMap = new Map<
      string,
      { id: string | null; name: string; total: number }
    >();
    prevOverview.income_category_breakdown.forEach((row) => {
      const key =
        row.category_id ??
        (typeof row.name === "string" ? `name:${row.name}` : "unknown");
      prevMap.set(key, {
        id: row.category_id ?? null,
        name: row.name,
        total: Number(row.total),
      });
    });

    const keys = new Set([...currentMap.keys(), ...prevMap.keys()]);
    return Array.from(keys)
      .map((key) => {
        const currentRow = currentMap.get(key);
        const prevRow = prevMap.get(key);
        const current = currentRow?.total ?? 0;
        const prev = prevRow?.total ?? 0;
        const delta = current - prev;
        const deltaPct = prev > 0 ? (delta / prev) * 100 : null;
        return {
          key,
          id: currentRow?.id ?? prevRow?.id ?? null,
          name: currentRow?.name ?? prevRow?.name ?? "Category",
          current,
          prev,
          delta,
          deltaPct,
        };
      })
      .filter((row) => row.name !== "Other")
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [overview, prevOverview]);

  const yearlyExpenseSourceDeltas = useMemo(() => {
    if (!overview || !prevOverview) return [];
    const currentMap = new Map<
      string,
      {
        total: number;
        txCount: number;
        monthly: Array<{ month: string; total: number }>;
      }
    >();
    expenseSourceRows.forEach((row) =>
      currentMap.set(row.source, {
        total: row.total,
        txCount: row.txCount,
        monthly: row.monthly,
      }),
    );
    const prevMap = new Map<
      string,
      {
        total: number;
        txCount: number;
        monthly: Array<{ month: string; total: number }>;
      }
    >();
    prevExpenseSourceRows.forEach((row) =>
      prevMap.set(row.source, {
        total: row.total,
        txCount: row.txCount,
        monthly: row.monthly,
      }),
    );
    const zeroMonthly = Array.from({ length: 12 }, (_, idx) => ({
      month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
      total: 0,
    }));

    const keys = new Set([...currentMap.keys(), ...prevMap.keys()]);
    return Array.from(keys)
      .map((source) => {
        const currentRow = currentMap.get(source);
        const prevRow = prevMap.get(source);
        const current = currentRow?.total ?? 0;
        const prev = prevRow?.total ?? 0;
        const delta = current - prev;
        const deltaPct = prev > 0 ? (delta / prev) * 100 : null;
        return {
          source,
          current,
          prev,
          delta,
          deltaPct,
          txCount: currentRow?.txCount ?? 0,
          monthly: currentRow?.monthly ?? zeroMonthly,
          prevMonthly: prevRow?.monthly,
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [expenseSourceRows, overview, prevExpenseSourceRows, prevOverview, year]);

  const yearlyIncomeSourceDeltas = useMemo(() => {
    if (!overview || !prevOverview) return [];
    const currentMap = new Map<
      string,
      {
        total: number;
        txCount: number;
        monthly: Array<{ month: string; total: number }>;
      }
    >();
    incomeSourceRows.forEach((row) =>
      currentMap.set(row.source, {
        total: row.total,
        txCount: row.txCount,
        monthly: row.monthly,
      }),
    );
    const prevMap = new Map<
      string,
      {
        total: number;
        txCount: number;
        monthly: Array<{ month: string; total: number }>;
      }
    >();
    prevIncomeSourceRows.forEach((row) =>
      prevMap.set(row.source, {
        total: row.total,
        txCount: row.txCount,
        monthly: row.monthly,
      }),
    );
    const zeroMonthly = Array.from({ length: 12 }, (_, idx) => ({
      month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
      total: 0,
    }));

    const keys = new Set([...currentMap.keys(), ...prevMap.keys()]);
    return Array.from(keys)
      .map((source) => {
        const currentRow = currentMap.get(source);
        const prevRow = prevMap.get(source);
        const current = currentRow?.total ?? 0;
        const prev = prevRow?.total ?? 0;
        const delta = current - prev;
        const deltaPct = prev > 0 ? (delta / prev) * 100 : null;
        return {
          source,
          current,
          prev,
          delta,
          deltaPct,
          txCount: currentRow?.txCount ?? 0,
          monthly: currentRow?.monthly ?? zeroMonthly,
          prevMonthly: prevRow?.monthly,
        };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [incomeSourceRows, overview, prevIncomeSourceRows, prevOverview, year]);

  const yearlySavingsDecomposition = useMemo(() => {
    if (!overview || !prevOverview) return null;
    const incomeNow = Number(overview.stats.total_income);
    const expenseNow = Number(overview.stats.total_expense);
    const netNow = Number(overview.stats.net_savings);
    const incomePrev = Number(prevOverview.stats.total_income);
    const expensePrev = Number(prevOverview.stats.total_expense);
    const netPrev = Number(prevOverview.stats.net_savings);
    const incomeDelta = incomeNow - incomePrev;
    const expenseDelta = expenseNow - expensePrev;
    const netDelta = netNow - netPrev;

    const contributions: Array<{
      kind: "income" | "expense";
      id: string | null;
      name: string;
      contribution: number;
    }> = [];

    yearlyIncomeCategoryDeltas.forEach((row) => {
      contributions.push({
        kind: "income",
        id: row.id,
        name: row.name,
        contribution: row.delta,
      });
    });
    yearlyExpenseCategoryDeltas.forEach((row) => {
      contributions.push({
        kind: "expense",
        id: row.id,
        name: row.name,
        contribution: -row.delta,
      });
    });
    contributions.sort(
      (a, b) => Math.abs(b.contribution) - Math.abs(a.contribution),
    );

    return {
      incomeNow,
      expenseNow,
      netNow,
      incomePrev,
      expensePrev,
      netPrev,
      incomeDelta,
      expenseDelta,
      netDelta,
      contributions,
    };
  }, [
    overview,
    prevOverview,
    yearlyExpenseCategoryDeltas,
    yearlyIncomeCategoryDeltas,
  ]);

  const openYearlySourceDetail = (
    flow: "income" | "expense",
    source: string,
  ) => {
    const zeroMonthly = (yearForLabels: number) =>
      Array.from({ length: 12 }, (_, idx) => ({
        month: monthLabel(
          new Date(Date.UTC(yearForLabels, idx, 1)).toISOString(),
        ),
        total: 0,
      }));

    const current =
      flow === "income"
        ? incomeSourceRows.find((row) => row.source === source)
        : expenseSourceRows.find((row) => row.source === source);
    const prev =
      flow === "income"
        ? prevIncomeSourceRows.find((row) => row.source === source)
        : prevExpenseSourceRows.find((row) => row.source === source);

    if (!current && !prev) return;

    openDetailDialog({
      kind: "source",
      title: source,
      subtitle: `${flow === "income" ? "Income" : "Expense"} • ${year}`,
      monthly: current?.monthly ?? zeroMonthly(year),
      total: current?.total ?? 0,
      txCount: current?.txCount ?? 0,
      ...(prev
        ? {
            compareLabel: String(year - 1),
            compareTotal: prev.total,
            compareMonthly: prev.monthly,
          }
        : {}),
    });
  };

  const totalKpis = useMemo(() => {
    if (!totalOverview) return null;
    const kpis = totalOverview.kpis;
    return {
      netWorth: Number(kpis.net_worth),
      cashBalance: Number(kpis.cash_balance),
      debtTotal: Number(kpis.debt_total),
      investmentsValue: kpis.investments_value
        ? Number(kpis.investments_value)
        : null,
      lifetimeIncome: Number(kpis.lifetime_income),
      lifetimeExpense: Number(kpis.lifetime_expense),
      lifetimeSaved: Number(kpis.lifetime_saved),
      lifetimeSavingsRate: kpis.lifetime_savings_rate_pct
        ? Number(kpis.lifetime_savings_rate_pct)
        : null,
    };
  }, [totalOverview]);

  const totalNetWorthSeriesAll = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.net_worth_series.map((row) => ({
      date: row.date,
      label: new Date(row.date).toLocaleDateString("sv-SE", {
        month: "short",
        year: "2-digit",
      }),
      netWorth: Number(row.net_worth),
    }));
  }, [totalOverview]);

  const totalNetWorthSeries = useMemo(() => {
    if (!totalWindowRange) return totalNetWorthSeriesAll;
    return totalNetWorthSeriesAll.filter(
      (row) => row.date >= totalWindowRange.start,
    );
  }, [totalNetWorthSeriesAll, totalWindowRange]);

  const totalNetWorthStats = useMemo(() => {
    if (!totalNetWorthSeries.length) return null;
    const first = totalNetWorthSeries[0];
    const latest = totalNetWorthSeries[totalNetWorthSeries.length - 1];
    const maxPoint = totalNetWorthSeries.reduce((best, candidate) =>
      candidate.netWorth > best.netWorth ? candidate : best,
    );
    const minPoint = totalNetWorthSeries.reduce((best, candidate) =>
      candidate.netWorth < best.netWorth ? candidate : best,
    );

    const latestDate = new Date(latest.date);
    const yearAgoTarget = new Date(latestDate);
    yearAgoTarget.setUTCFullYear(yearAgoTarget.getUTCFullYear() - 1);
    const targetIso = yearAgoTarget.toISOString().slice(0, 10);

    let yearAgo: (typeof totalNetWorthSeries)[number] | null = null;
    for (let idx = totalNetWorthSeries.length - 1; idx >= 0; idx -= 1) {
      const point = totalNetWorthSeries[idx];
      if (point.date <= targetIso) {
        yearAgo = point;
        break;
      }
    }

    const delta12m = yearAgo ? latest.netWorth - yearAgo.netWorth : null;
    const delta12mPct =
      yearAgo && yearAgo.netWorth !== 0
        ? ((latest.netWorth - yearAgo.netWorth) / yearAgo.netWorth) * 100
        : null;

    const deltaSinceStart = latest.netWorth - first.netWorth;
    const deltaSinceStartPct =
      first.netWorth !== 0 ? (deltaSinceStart / first.netWorth) * 100 : null;

    return {
      asOf: latest.date,
      current: latest.netWorth,
      delta12m,
      delta12mPct,
      deltaSinceStart,
      deltaSinceStartPct,
      allTimeHigh: maxPoint.netWorth,
      allTimeHighDate: maxPoint.date,
      allTimeLow: minPoint.netWorth,
      allTimeLowDate: minPoint.date,
    };
  }, [totalNetWorthSeries]);

  const totalMonthlyIncomeExpense = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.monthly_income_expense.map((row) => {
      const parsed = new Date(row.date);
      return {
        date: row.date,
        year: parsed.getUTCFullYear(),
        month: parsed.getUTCMonth() + 1,
        income: Number(row.income),
        expense: Number(row.expense),
      };
    });
  }, [totalOverview]);

  const totalNetWorthAttribution = useMemo(() => {
    if (!totalOverview) return null;
    if (!totalWindowRange) return null;
    if (totalNetWorthSeries.length < 2) return null;

    const startNetWorth = totalNetWorthSeries[0].netWorth;
    const endNetWorth =
      totalNetWorthSeries[totalNetWorthSeries.length - 1].netWorth;
    const netWorthDelta = endNetWorth - startNetWorth;

    const savings = totalMonthlyIncomeExpense
      .filter(
        (row) =>
          row.date >= totalWindowRange.start &&
          row.date <= totalWindowRange.end,
      )
      .reduce((sum, row) => sum + (row.income - row.expense), 0);

    const debtSeries = totalOverview.debt.series
      .map((row) => ({ date: row.date, debt: Number(row.debt) }))
      .filter(
        (row) =>
          row.date >= totalWindowRange.start &&
          row.date <= totalWindowRange.end,
      );
    const debtStart = debtSeries.length ? debtSeries[0].debt : 0;
    const debtEnd = debtSeries.length
      ? debtSeries[debtSeries.length - 1].debt
      : 0;
    const debtDelta = debtEnd - debtStart;
    const debtContribution = -debtDelta;

    const invSeries = (totalOverview.investments?.series ?? [])
      .map((row) => ({ date: row.date, value: Number(row.value) }))
      .filter(
        (row) =>
          row.date >= totalWindowRange.start &&
          row.date <= totalWindowRange.end,
      );
    const invStart = invSeries.length ? invSeries[0].value : 0;
    const invEnd = invSeries.length ? invSeries[invSeries.length - 1].value : 0;
    const investmentsContribution = totalOverview.investments
      ? invEnd - invStart
      : null;

    const explained =
      savings +
      debtContribution +
      (investmentsContribution === null ? 0 : investmentsContribution);
    const remainder = netWorthDelta - explained;

    return {
      windowStart: totalWindowRange.start,
      windowEnd: totalWindowRange.end,
      netWorthDelta,
      savings,
      investmentsContribution,
      debtContribution,
      remainder,
    };
  }, [
    totalMonthlyIncomeExpense,
    totalNetWorthSeries,
    totalOverview,
    totalWindowRange,
  ]);

  const totalNetWorthTrajectoryData = useMemo(
    () =>
      totalNetWorthSeries.map((row) => ({
        date: row.date,
        net: row.netWorth,
        year: new Date(row.date).getFullYear(),
      })),
    [totalNetWorthSeries],
  );

  const totalNetWorthTrajectoryDomain = useMemo<[number, number]>(() => {
    if (!totalNetWorthTrajectoryData.length) return [0, 0];
    const values = totalNetWorthTrajectoryData.map((d) => d.net);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const upperPad = Math.abs(max) * 0.05 || 1;
    return [min, max + upperPad];
  }, [totalNetWorthTrajectoryData]);

  const totalNetWorthBreakdownSeries = useMemo(() => {
    if (!totalOverview) return [];
    const invMap = new Map<string, number>();
    (totalOverview.investments?.series ?? []).forEach((row) => {
      invMap.set(row.date, Number(row.value));
    });
    const debtMap = new Map<string, number>();
    totalOverview.debt.series.forEach((row) => {
      debtMap.set(row.date, Number(row.debt));
    });
    const start = totalWindowRange?.start ?? null;
    return totalOverview.net_worth_series
      .filter((row) => (start ? row.date >= start : true))
      .map((row) => {
        const investments = invMap.get(row.date) ?? 0;
        const debt = debtMap.get(row.date) ?? 0;
        const netWorth = Number(row.net_worth);
        const cash = netWorth - investments + debt;
        return {
          date: row.date,
          label: new Date(row.date).toLocaleDateString("sv-SE", {
            month: "short",
            year: "2-digit",
          }),
          cash,
          investments,
          debtNeg: -debt,
          debt,
          netWorth,
        };
      });
  }, [totalOverview, totalWindowRange]);

  const totalNetWorthBreakdownDomain = useMemo<[number, number]>(() => {
    if (!totalNetWorthBreakdownSeries.length) return [0, 0];
    const values = totalNetWorthBreakdownSeries.flatMap((row) => [
      row.cash,
      row.investments,
      row.debtNeg,
      row.netWorth,
    ]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(1, Math.abs(max) * 0.08);
    return [min - pad * 0.2, max + pad];
  }, [totalNetWorthBreakdownSeries]);

  const totalSavingsRateSeriesAll = useMemo(() => {
    const sorted = [...totalMonthlyIncomeExpense].sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    return sorted.map((row, idx) => {
      const net = row.income - row.expense;
      const ratePct = row.income > 0 ? (net / row.income) * 100 : null;
      const window = sorted.slice(Math.max(0, idx - 11), idx + 1);
      const windowIncome = window.reduce((sum, w) => sum + w.income, 0);
      const windowNet = window.reduce(
        (sum, w) => sum + (w.income - w.expense),
        0,
      );
      const rolling12mPct =
        windowIncome > 0 ? (windowNet / windowIncome) * 100 : null;
      return {
        date: row.date,
        label: new Date(row.date).toLocaleDateString("sv-SE", {
          month: "short",
          year: "2-digit",
        }),
        income: row.income,
        expense: row.expense,
        net,
        ratePct,
        rolling12mPct,
        index: idx,
      };
    });
  }, [totalMonthlyIncomeExpense]);

  const totalSavingsRateSeries = useMemo(() => {
    const start = totalWindowRange?.start ?? null;
    return totalSavingsRateSeriesAll.filter((row) =>
      start ? row.date >= start : true,
    );
  }, [totalSavingsRateSeriesAll, totalWindowRange]);

  const totalSavingsRateDomain = useMemo<[number, number]>(() => {
    const values = totalSavingsRateSeries.flatMap((row) =>
      [row.ratePct, row.rolling12mPct].filter(
        (value): value is number => typeof value === "number",
      ),
    );
    if (!values.length) return [0, 100];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(5, (max - min) * 0.12);
    return [
      Math.floor((min - pad) / 10) * 10,
      Math.ceil((max + pad) / 10) * 10,
    ];
  }, [totalSavingsRateSeries]);

  const totalExpenseComposition = useMemo(() => {
    if (!totalOverview) return null;
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    const rows = totalOverview.expense_category_mix_by_year
      .filter((row) => (windowStartYear ? row.year >= windowStartYear : true))
      .sort((a, b) => a.year - b.year);
    if (!rows.length) return null;
    const latest = rows[rows.length - 1];
    const sortedCats = [...latest.categories].sort(
      (a, b) => Number(b.total) - Number(a.total),
    );
    const top = sortedCats.filter((c) => c.name !== "Other").slice(0, 7);
    const includesOther = latest.categories.some((c) => c.name === "Other");
    const keys = [
      ...top.map((c) => c.name),
      ...(includesOther ? ["Other"] : []),
    ];
    const years = rows.map((row) => row.year);
    const colors: Record<string, string> = {};
    const ids: Record<string, string | null> = {};
    latest.categories.forEach((c) => {
      colors[c.name] = c.color_hex ?? "#ef4444";
      ids[c.name] = c.category_id ?? null;
    });
    colors.Other ??= "#94a3b8";
    ids.Other ??= null;

    const totalsByYear: Record<number, number> = {};
    const amountByYear: Record<number, Record<string, number>> = {};
    const data = rows.map((row) => {
      const total = row.categories.reduce((sum, c) => sum + Number(c.total), 0);
      totalsByYear[row.year] = total;
      const entry: Record<string, number | string> = { year: String(row.year) };
      const amounts: Record<string, number> = {};
      keys.forEach((key) => {
        const cat = row.categories.find((c) => c.name === key);
        const amount = cat ? Number(cat.total) : 0;
        amounts[key] = amount;
        entry[key] = total > 0 ? (amount / total) * 100 : 0;
      });
      amountByYear[row.year] = amounts;
      return entry;
    });

    return { years, keys, colors, ids, totalsByYear, amountByYear, data };
  }, [totalOverview, totalWindowRange]);

  const totalIncomeComposition = useMemo(() => {
    if (!totalOverview) return null;
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    const rows = totalOverview.income_category_mix_by_year
      .filter((row) => (windowStartYear ? row.year >= windowStartYear : true))
      .sort((a, b) => a.year - b.year);
    if (!rows.length) return null;
    const latest = rows[rows.length - 1];
    const sortedCats = [...latest.categories].sort(
      (a, b) => Number(b.total) - Number(a.total),
    );
    const top = sortedCats.filter((c) => c.name !== "Other").slice(0, 7);
    const includesOther = latest.categories.some((c) => c.name === "Other");
    const keys = [
      ...top.map((c) => c.name),
      ...(includesOther ? ["Other"] : []),
    ];
    const years = rows.map((row) => row.year);
    const colors: Record<string, string> = {};
    const ids: Record<string, string | null> = {};
    latest.categories.forEach((c) => {
      colors[c.name] = c.color_hex ?? "#10b981";
      ids[c.name] = c.category_id ?? null;
    });
    colors.Other ??= "#94a3b8";
    ids.Other ??= null;

    const totalsByYear: Record<number, number> = {};
    const amountByYear: Record<number, Record<string, number>> = {};
    const data = rows.map((row) => {
      const total = row.categories.reduce((sum, c) => sum + Number(c.total), 0);
      totalsByYear[row.year] = total;
      const entry: Record<string, number | string> = { year: String(row.year) };
      const amounts: Record<string, number> = {};
      keys.forEach((key) => {
        const cat = row.categories.find((c) => c.name === key);
        const amount = cat ? Number(cat.total) : 0;
        amounts[key] = amount;
        entry[key] = total > 0 ? (amount / total) * 100 : 0;
      });
      amountByYear[row.year] = amounts;
      return entry;
    });

    return { years, keys, colors, ids, totalsByYear, amountByYear, data };
  }, [totalOverview, totalWindowRange]);

  const totalYearly = useMemo(() => {
    if (!totalOverview) return [];
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    return totalOverview.yearly
      .filter((row) => (windowStartYear ? row.year >= windowStartYear : true))
      .map((row) => ({
        year: row.year,
        income: Number(row.income),
        expense: Number(row.expense),
        net: Number(row.net),
        savingsRate: row.savings_rate_pct ? Number(row.savings_rate_pct) : null,
      }))
      .sort((a, b) => a.year - b.year);
  }, [totalOverview, totalWindowRange]);

  const totalYearlyTable = useMemo(
    () => [...totalYearly].reverse(),
    [totalYearly],
  );

  const totalExpenseMix = useMemo(() => {
    if (!totalOverview) {
      return { data: [], keys: [], colors: {} as Record<string, string> };
    }
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    const filtered = totalOverview.expense_category_mix_by_year.filter((row) =>
      windowStartYear ? row.year >= windowStartYear : true,
    );
    const recent = filtered.slice(-6);
    const latest = recent[recent.length - 1];
    const keys = (latest?.categories ?? [])
      .filter((c) => c.name !== "Other")
      .sort((a, b) => Number(b.total) - Number(a.total))
      .map((c) => c.name);
    const colors: Record<string, string> = {};
    (latest?.categories ?? []).forEach((c) => {
      colors[c.name] = c.color_hex ?? "#ef4444";
    });
    if ((latest?.categories ?? []).some((c) => c.name === "Other")) {
      keys.push("Other");
      colors["Other"] ??= "#94a3b8";
    }
    const data = recent.map((row) => {
      const total = row.categories.reduce((sum, c) => sum + Number(c.total), 0);
      const entry: Record<string, number | string> = { year: String(row.year) };
      row.categories.forEach((c) => {
        entry[c.name] = total > 0 ? (Number(c.total) / total) * 100 : 0;
      });
      return entry;
    });
    return { data, keys, colors };
  }, [totalOverview, totalWindowRange]);

  const totalIncomeMix = useMemo(() => {
    if (!totalOverview) {
      return { data: [], keys: [], colors: {} as Record<string, string> };
    }
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    const filtered = totalOverview.income_category_mix_by_year.filter((row) =>
      windowStartYear ? row.year >= windowStartYear : true,
    );
    const recent = filtered.slice(-6);
    const latest = recent[recent.length - 1];
    const keys = (latest?.categories ?? [])
      .filter((c) => c.name !== "Other")
      .sort((a, b) => Number(b.total) - Number(a.total))
      .map((c) => c.name);
    const colors: Record<string, string> = {};
    (latest?.categories ?? []).forEach((c) => {
      colors[c.name] = c.color_hex ?? "#10b981";
    });
    if ((latest?.categories ?? []).some((c) => c.name === "Other")) {
      keys.push("Other");
      colors["Other"] ??= "#94a3b8";
    }
    const data = recent.map((row) => {
      const total = row.categories.reduce((sum, c) => sum + Number(c.total), 0);
      const entry: Record<string, number | string> = { year: String(row.year) };
      row.categories.forEach((c) => {
        entry[c.name] = total > 0 ? (Number(c.total) / total) * 100 : 0;
      });
      return entry;
    });
    return { data, keys, colors };
  }, [totalOverview, totalWindowRange]);

  const totalInvestments = useMemo(() => {
    if (!totalOverview?.investments) return null;
    return {
      series: totalOverview.investments.series.map((row) => ({
        date: monthLabel(row.date),
        value: Number(row.value),
      })),
      yearly: totalOverview.investments.yearly.map((row) => ({
        year: row.year,
        endValue: Number(row.end_value),
        netContributions: Number(row.net_contributions),
        impliedReturn: row.implied_return ? Number(row.implied_return) : null,
      })),
      accounts: totalOverview.investments.accounts_latest.map((row) => ({
        name: row.account_name,
        value: Number(row.value),
      })),
    };
  }, [totalOverview?.investments]);

  const totalInvestmentsYearlyTable = useMemo(
    () =>
      totalInvestments
        ? [...totalInvestments.yearly].sort((a, b) => b.year - a.year)
        : [],
    [totalInvestments],
  );

  const totalExpenseCategoriesLifetime = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.expense_categories_lifetime
      .map((row) => ({
        id: row.category_id ?? null,
        name: row.name,
        total: Number(row.total),
        color: row.color_hex ?? "#ef4444",
        txCount: row.transaction_count,
      }))
      .sort((a, b) => b.total - a.total);
  }, [totalOverview]);

  const totalIncomeCategoriesLifetime = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.income_categories_lifetime
      .map((row) => ({
        id: row.category_id ?? null,
        name: row.name,
        total: Number(row.total),
        color: row.color_hex ?? "#10b981",
        txCount: row.transaction_count,
      }))
      .sort((a, b) => b.total - a.total);
  }, [totalOverview]);

  const totalExpenseCategoryChanges = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.expense_category_changes_yoy
      .map((row) => ({
        id: row.category_id ?? null,
        name: row.name,
        amount: Number(row.amount),
        prev: Number(row.prev_amount),
        delta: Number(row.delta),
        deltaPct: row.delta_pct ? Number(row.delta_pct) : null,
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [totalOverview]);

  const totalIncomeCategoryChanges = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.income_category_changes_yoy
      .map((row) => ({
        id: row.category_id ?? null,
        name: row.name,
        amount: Number(row.amount),
        prev: Number(row.prev_amount),
        delta: Number(row.delta),
        deltaPct: row.delta_pct ? Number(row.delta_pct) : null,
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [totalOverview]);

  const totalIncomeSourcesLifetime = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.income_sources_lifetime
      .map((row) => ({
        source: row.source,
        total: Number(row.total),
        txCount: row.transaction_count,
      }))
      .sort((a, b) => b.total - a.total);
  }, [totalOverview]);

  const totalExpenseSourcesLifetime = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.expense_sources_lifetime
      .map((row) => ({
        source: row.source,
        total: Number(row.total),
        txCount: row.transaction_count,
      }))
      .sort((a, b) => b.total - a.total);
  }, [totalOverview]);

  const totalIncomeSourceChanges = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.income_source_changes_yoy
      .map((row) => ({
        source: row.source,
        amount: Number(row.amount),
        prev: Number(row.prev_amount),
        delta: Number(row.delta),
        deltaPct: row.delta_pct ? Number(row.delta_pct) : null,
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [totalOverview]);

  const totalExpenseSourceChanges = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.expense_source_changes_yoy
      .map((row) => ({
        source: row.source,
        amount: Number(row.amount),
        prev: Number(row.prev_amount),
        delta: Number(row.delta),
        deltaPct: row.delta_pct ? Number(row.delta_pct) : null,
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [totalOverview]);

  const totalAccountsOverview = useMemo(() => {
    if (!totalOverview) return [];
    const debtByAccountId = new Map<string, number>();
    totalOverview.debt.accounts.forEach((row) => {
      debtByAccountId.set(row.account_id, Number(row.current_debt));
    });

    const investmentsByAccountName = new Map<string, number>();
    totalOverview.investments?.accounts_latest.forEach((row) => {
      investmentsByAccountName.set(row.account_name, Number(row.value));
    });

    return totalOverview.accounts
      .map((row) => ({
        balance:
          row.account_type === "investment" &&
          investmentsByAccountName.has(row.name) &&
          Number(row.current_balance) === 0
            ? (investmentsByAccountName.get(row.name) ?? 0)
            : row.account_type === "debt" &&
                debtByAccountId.has(row.account_id) &&
                Number(row.current_balance) === 0
              ? -(debtByAccountId.get(row.account_id) ?? 0)
              : Number(row.current_balance),
        id: row.account_id,
        name: row.name,
        type: row.account_type,
        netOperating: Number(row.net_operating),
        netTransfers: Number(row.net_transfers),
        firstDate: row.first_transaction_date ?? null,
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [totalOverview]);

  const totalDebtSeries = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.debt.series.map((row) => ({
      date: monthLabel(row.date),
      debt: Number(row.debt),
    }));
  }, [totalOverview]);

  const totalDebtAccounts = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.debt.accounts
      .map((row) => ({
        id: row.account_id,
        name: row.name,
        current: Number(row.current_debt),
        prev: row.prev_year_end_debt ? Number(row.prev_year_end_debt) : null,
        delta: row.delta ? Number(row.delta) : null,
      }))
      .sort((a, b) => b.current - a.current);
  }, [totalOverview]);

  const totalSeasonalityHeatmaps = useMemo(() => {
    if (!totalMonthlyIncomeExpense.length) return null;
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    const years = Array.from(
      new Set(totalMonthlyIncomeExpense.map((row) => row.year)),
    )
      .filter((yr) => (windowStartYear ? yr >= windowStartYear : true))
      .sort((a, b) => a - b);
    const yearIndex = new Map<number, number>();
    years.forEach((yr, idx) => yearIndex.set(yr, idx));
    const income = years.map(() => Array.from({ length: 12 }, () => 0));
    const expense = years.map(() => Array.from({ length: 12 }, () => 0));
    for (const row of totalMonthlyIncomeExpense) {
      const idx = yearIndex.get(row.year);
      if (idx === undefined) continue;
      const monthIdx = row.month - 1;
      if (monthIdx < 0 || monthIdx > 11) continue;
      income[idx][monthIdx] += row.income;
      expense[idx][monthIdx] += row.expense;
    }
    const maxIncome = Math.max(0, ...income.flat());
    const maxExpense = Math.max(0, ...expense.flat());
    const months = Array.from({ length: 12 }, (_, idx) =>
      monthLabel(new Date(Date.UTC(2000, idx, 1)).toISOString()),
    );
    return { years, months, income, expense, maxIncome, maxExpense };
  }, [totalMonthlyIncomeExpense, totalWindowRange]);

  const totalExpenseCategoryYearHeatmap = useMemo(() => {
    if (!totalOverview) return null;
    const heatmap = totalOverview.expense_category_heatmap_by_year;
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    const yearIndices = heatmap.years
      .map((yr, idx) => ({ yr, idx }))
      .filter((entry) =>
        windowStartYear ? entry.yr >= windowStartYear : true,
      );
    const years = yearIndices.map((entry) => entry.yr);
    const rows = heatmap.rows.map((row) => ({
      categoryId: row.category_id ?? null,
      name: row.name,
      icon: row.icon ?? null,
      color: row.color_hex ?? null,
      totals: yearIndices.map((entry) => Number(row.totals[entry.idx] ?? 0)),
    }));
    const max = Math.max(0, ...rows.flatMap((row) => row.totals));
    return { years, rows, max };
  }, [totalOverview, totalWindowRange]);

  const totalIncomeCategoryYearHeatmap = useMemo(() => {
    if (!totalOverview) return null;
    const heatmap = totalOverview.income_category_heatmap_by_year;
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    const yearIndices = heatmap.years
      .map((yr, idx) => ({ yr, idx }))
      .filter((entry) =>
        windowStartYear ? entry.yr >= windowStartYear : true,
      );
    const years = yearIndices.map((entry) => entry.yr);
    const rows = heatmap.rows.map((row) => ({
      categoryId: row.category_id ?? null,
      name: row.name,
      icon: row.icon ?? null,
      color: row.color_hex ?? null,
      totals: yearIndices.map((entry) => Number(row.totals[entry.idx] ?? 0)),
    }));
    const max = Math.max(0, ...rows.flatMap((row) => row.totals));
    return { years, rows, max };
  }, [totalOverview, totalWindowRange]);

  const totalDrilldownAnomalies = useMemo(() => {
    if (!totalDrilldown) return [];
    if (
      totalDrilldown.kind !== "category" &&
      totalDrilldown.kind !== "source" &&
      totalDrilldown.kind !== "account"
    ) {
      return [];
    }
    if (!totalDrilldownSeries.length) return [];
    const values = totalDrilldownSeries.map((row) => {
      if (totalDrilldown.kind === "account") return row.net;
      return totalDrilldown.flow === "expense" ? row.expense : row.income;
    });
    const med = median(values);
    const mad = medianAbsoluteDeviation(values, med);
    const scale = mad > 0 ? mad * 1.4826 : 0;
    const mean =
      values.reduce((sum, value) => sum + value, 0) /
      Math.max(1, values.length);
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      Math.max(1, values.length);
    const std = Math.sqrt(variance);
    const denom = scale > 0 ? scale : std > 0 ? std : 1;

    const labeled = totalDrilldownSeries.map((row, idx) => {
      const value = values[idx] ?? 0;
      const score = (value - med) / denom;
      return {
        period: row.period,
        value,
        score,
      };
    });

    return labeled
      .filter((row) => row.score >= 2.8 && row.value !== 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [totalDrilldown, totalDrilldownSeries]);

  const openDetailDialog = (state: DetailDialogState) => {
    setDetailDialog(state);
    setDetailDialogOpen(true);
  };

  const openTotalDrilldownDialog = (state: TotalDrilldownState) => {
    setTotalDrilldown(state);
    setTotalDrilldownOpen(true);
  };

  const openTotalHeatmapDialog = (state: TotalHeatmapDialogState) => {
    setTotalHeatmapDialog(state);
    setTotalHeatmapDialogOpen(true);
  };

  const openTotalTimeseriesDialog = (state: TotalTimeseriesDialogState) => {
    setTotalTimeseriesDialog(state);
    setTotalTimeseriesDialogOpen(true);
  };

  // Exports removed for the total report view.

  return (
    <MotionPage className="space-y-4">
      <ReportsHeader
        routeMode={routeMode}
        year={year}
        yearOptions={yearOptions}
        totalWindowPreset={totalWindowPreset}
        onTotalWindowPresetChange={setTotalWindowPreset}
      />

      <ReportsOverviewCard
        routeMode={routeMode}
        year={year}
        overview={overview}
        totalKpis={totalKpis}
      />

      {routeMode === "yearly" ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <YearlyIncomeExpenseCard
              year={year}
              overview={overview}
              overviewLoading={overviewLoading}
              chartData={yearSeasonalityChart}
            />

            <YearlyNetWorthGrowthCard
              year={year}
              loading={overviewLoading}
              data={netWorthChart}
              domain={netWorthDomain}
              quarterMarkers={netWorthQuarterMarkers}
            />
          </div>

          <MoneyFlowSankeyCard
            title={`Where the money went (${year})`}
            description="Income categories flowing into expenses and savings."
            incomeCategories={incomeCategoryChartData}
            expenseCategories={categoryChartData}
            loading={overviewLoading}
          />

          <div className="grid gap-3 lg:grid-cols-3">
            <YearlyDebtCard
              year={year}
              loading={overviewLoading}
              debtChart={debtChart}
              debtOverviewRows={debtOverviewRows}
              onOpenDetailDialog={openDetailDialog}
            />

            <YearlySavingsRateCard savings={savings} />

            <YearlySummaryCard year={year} overview={overview} />
          </div>

          <YearlyDriversGrid
            year={year}
            overview={overview}
            prevOverview={prevOverview}
            prevOverviewLoading={prevOverviewLoading}
            yearlyExpenseCategoryDeltas={yearlyExpenseCategoryDeltas}
            yearlyExpenseSourceDeltas={yearlyExpenseSourceDeltas}
            yearlySavingsDecomposition={yearlySavingsDecomposition}
            onOpenExtraDialog={setYearlyExtraDialog}
            onOpenSourceDetail={openYearlySourceDetail}
            onSelectCategory={(flow, categoryId) => {
              setSelectedCategoryFlow(flow);
              setSelectedCategoryId(categoryId);
            }}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <YearlyCategoryBreakdownCard
              flow="expense"
              loading={overviewLoading}
              rows={categoryChartData}
              onSelectCategory={(categoryId) => {
                setSelectedCategoryFlow("expense");
                setSelectedCategoryId(categoryId);
              }}
            />

            <YearlyCategoryHeatmapCard
              title="Spending heatmap"
              description="Seasonality by category and month."
              year={year}
              hasOverview={Boolean(overview)}
              heatmap={heatmap}
              color="expense"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <YearlyCategoryBreakdownCard
              flow="income"
              loading={overviewLoading}
              rows={incomeCategoryChartData}
              onSelectCategory={(categoryId) => {
                setSelectedCategoryFlow("income");
                setSelectedCategoryId(categoryId);
              }}
            />

            <YearlyCategoryHeatmapCard
              title="Income heatmap"
              description="Seasonality by category and month."
              year={year}
              hasOverview={Boolean(overview)}
              heatmap={incomeHeatmap}
              color="income"
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-1">
            <YearlyInvestmentsSummaryCard
              year={year}
              hasOverview={Boolean(overview)}
              investmentsSummary={investmentsSummary}
              onOpenDetailDialog={openDetailDialog}
            />
          </div>

          <YearlySourcesGrid
            overview={overview}
            incomeSourceRows={incomeSourceRows}
            expenseSourceRows={expenseSourceRows}
            onOpenSourceDetail={openYearlySourceDetail}
          />

          <YearlyAccountFlowsCard
            year={year}
            hasOverview={Boolean(overview)}
            rows={accountFlowRows}
            onOpenDetailDialog={openDetailDialog}
          />

          <YearlyTransactionsAndChangesRow
            overview={overview}
            onOpenOneOffs={() => setYearlyExtraDialog({ kind: "oneOffs" })}
            onSelectExpenseCategory={(categoryId) => {
              setSelectedCategoryFlow("expense");
              setSelectedCategoryId(categoryId);
            }}
          />

          <YearlyExtraDialog
            year={year}
            open={Boolean(yearlyExtraDialog)}
            state={yearlyExtraDialog}
            overview={overview}
            yearlyExpenseCategoryDeltas={yearlyExpenseCategoryDeltas}
            yearlyIncomeCategoryDeltas={yearlyIncomeCategoryDeltas}
            yearlyExpenseSourceDeltas={yearlyExpenseSourceDeltas}
            yearlyIncomeSourceDeltas={yearlyIncomeSourceDeltas}
            yearlySavingsDecomposition={yearlySavingsDecomposition}
            onClose={() => setYearlyExtraDialog(null)}
            onSetState={(next) => setYearlyExtraDialog(next)}
            onSelectCategory={(flow, categoryId) => {
              setSelectedCategoryFlow(flow);
              setSelectedCategoryId(categoryId);
            }}
            onOpenYearlySourceDetail={(flow, source) =>
              openYearlySourceDetail(flow, source)
            }
          />

          <YearlyDetailDialog
            open={detailDialogOpen}
            detailDialog={detailDialog}
            onOpenChange={(open) => {
              setDetailDialogOpen(open);
              if (!open) setDetailDialog(null);
            }}
          />

          <YearlyCategoryDetailDialog
            open={Boolean(selectedCategoryId)}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedCategoryId(null);
                setSelectedCategoryFlow("expense");
                setCategoryDetail(null);
              }
            }}
            selectedCategoryFlow={selectedCategoryFlow}
            year={year}
            categoryDetailLoading={categoryDetailLoading}
            categoryDetail={categoryDetail}
            categoryDetailPrevMonthly={categoryDetailPrevMonthly}
          />
        </>
      ) : (
        <>
          <div className="grid gap-3">
            <TotalNetWorthTrajectoryCard
              loading={totalOverviewLoading}
              data={totalNetWorthTrajectoryData}
              domain={totalNetWorthTrajectoryDomain}
            />

            <div className="grid gap-3 lg:grid-cols-2">
              <TotalNetWorthBreakdownCard
                loading={totalOverviewLoading}
                series={totalNetWorthBreakdownSeries}
                domain={totalNetWorthBreakdownDomain}
                onOpenTimeseriesDialog={openTotalTimeseriesDialog}
                onOpenDrilldownDialog={openTotalDrilldownDialog}
              />

              <TotalSavingsRateCard
                loading={totalOverviewLoading}
                series={totalSavingsRateSeries}
                seriesAll={totalSavingsRateSeriesAll}
                domain={totalSavingsRateDomain}
                onOpenTimeseriesDialog={openTotalTimeseriesDialog}
              />
            </div>

            <TotalCompositionOverTimeCard
              loading={totalOverviewLoading}
              expenseComposition={totalExpenseComposition}
              incomeComposition={totalIncomeComposition}
              onOpenHeatmapDialog={openTotalHeatmapDialog}
            />

            <TotalNetWorthGrowthCard
              loading={totalOverviewLoading}
              totalWindowPreset={totalWindowPreset}
              hasOverview={Boolean(totalOverview)}
              hasNetWorthHistory={totalNetWorthSeries.length > 0}
              netWorthStats={totalNetWorthStats}
              netWorthAttribution={totalNetWorthAttribution}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
            />

            <TotalYearByYearPerformanceCard
              loading={totalOverviewLoading}
              hasOverview={Boolean(totalOverview)}
              bestYear={
                totalOverview?.best_year
                  ? Number(totalOverview.best_year)
                  : null
              }
              worstYear={
                totalOverview?.worst_year
                  ? Number(totalOverview.worst_year)
                  : null
              }
              lifetimeSavingsRate={totalKpis?.lifetimeSavingsRate ?? null}
              chartData={totalYearly}
              tableData={totalYearlyTable}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
            />
          </div>

          <MoneyFlowSankeyCard
            title="Lifetime money flow"
            description="Income categories flowing into expenses and savings."
            incomeCategories={totalIncomeCategoriesLifetime}
            expenseCategories={totalExpenseCategoriesLifetime}
            loading={totalOverviewLoading}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <TotalSeasonalityCard
              flow="income"
              totalOverviewLoaded={Boolean(totalOverview)}
              heatmaps={totalSeasonalityHeatmaps}
              onOpenHeatmapDialog={openTotalHeatmapDialog}
            />

            <TotalSeasonalityCard
              flow="expense"
              totalOverviewLoaded={Boolean(totalOverview)}
              heatmaps={totalSeasonalityHeatmaps}
              onOpenHeatmapDialog={openTotalHeatmapDialog}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <TotalCategoryByYearCard
              flow="expense"
              totalOverviewLoaded={Boolean(totalOverview)}
              heatmap={totalExpenseCategoryYearHeatmap}
              yearlyTotals={totalYearly}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
              onOpenHeatmapDialog={openTotalHeatmapDialog}
            />

            <TotalCategoryByYearCard
              flow="income"
              totalOverviewLoaded={Boolean(totalOverview)}
              heatmap={totalIncomeCategoryYearHeatmap}
              yearlyTotals={totalYearly}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
              onOpenHeatmapDialog={openTotalHeatmapDialog}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <TotalInvestmentsSnapshotCard
              hasOverview={Boolean(totalOverview)}
              investments={totalInvestments}
              investmentsYearlyTable={totalInvestmentsYearlyTable}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
            />

            <TotalDebtOverviewCard
              hasOverview={Boolean(totalOverview)}
              debt={{
                totalCurrent: Number(totalOverview?.debt.total_current ?? 0),
                changeSincePrevYearEnd: totalOverview?.debt
                  .change_since_prev_year_end
                  ? Number(totalOverview.debt.change_since_prev_year_end)
                  : null,
                debtToIncomeLatestYear: totalOverview?.debt
                  .debt_to_income_latest_year
                  ? Number(totalOverview.debt.debt_to_income_latest_year)
                  : null,
              }}
              series={totalDebtSeries}
              accounts={totalDebtAccounts.map((row) => ({
                id: row.id,
                name: row.name,
                current: row.current,
                delta: row.delta,
              }))}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
            />
          </div>

          <TotalAccountsOverviewCard
            hasOverview={Boolean(totalOverview)}
            rows={totalAccountsOverview}
            onOpenDrilldownDialog={openTotalDrilldownDialog}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <TotalSourcesCard
              flow="income"
              hasOverview={Boolean(totalOverview)}
              sources={totalIncomeSourcesLifetime}
              changes={totalIncomeSourceChanges}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
            />

            <TotalSourcesCard
              flow="expense"
              hasOverview={Boolean(totalOverview)}
              sources={totalExpenseSourcesLifetime}
              changes={totalExpenseSourceChanges}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <TotalLifetimeCategoriesCard
              flow="expense"
              hasOverview={Boolean(totalOverview)}
              rows={totalExpenseCategoriesLifetime}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
            />

            <TotalCategoryMixCard
              title="Expense mix (last 6 years)"
              description="Share of expenses by category (top + other)."
              hasOverview={Boolean(totalOverview)}
              data={totalExpenseMix.data}
              keys={totalExpenseMix.keys}
              colors={totalExpenseMix.colors}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <TotalLifetimeCategoriesCard
              flow="income"
              hasOverview={Boolean(totalOverview)}
              rows={totalIncomeCategoriesLifetime}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
            />

            <TotalCategoryMixCard
              title="Income mix (last 6 years)"
              description="Share of income by category (top + other)."
              hasOverview={Boolean(totalOverview)}
              data={totalIncomeMix.data}
              keys={totalIncomeMix.keys}
              colors={totalIncomeMix.colors}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <TotalCategoryChangesCard
              flow="expense"
              hasOverview={Boolean(totalOverview)}
              rows={totalExpenseCategoryChanges}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
            />

            <TotalCategoryChangesCard
              flow="income"
              hasOverview={Boolean(totalOverview)}
              rows={totalIncomeCategoryChanges}
              onOpenDrilldownDialog={openTotalDrilldownDialog}
            />
          </div>
        </>
      )}

      <TotalDrilldownDialog
        open={totalDrilldownOpen}
        onOpenChange={(open) => {
          setTotalDrilldownOpen(open);
          if (!open) {
            setTotalDrilldown(null);
            setTotalDrilldownSeries([]);
            setTotalDrilldownError(null);
            setTotalYearDrilldown(null);
            setTotalYearDrilldownError(null);
          }
        }}
        totalDrilldown={totalDrilldown}
        totalWindowRange={totalWindowRange}
        totalDrilldownLoading={totalDrilldownLoading}
        totalDrilldownError={totalDrilldownError}
        totalDrilldownSeries={totalDrilldownSeries}
        totalDrilldownAnomalies={totalDrilldownAnomalies}
        totalYearDrilldown={totalYearDrilldown}
        totalYearDrilldownLoading={totalYearDrilldownLoading}
        totalYearDrilldownError={totalYearDrilldownError}
        totalKpis={totalKpis}
        totalInvestmentsYearlyTable={totalInvestmentsYearlyTable}
        totalDebtAccounts={totalDebtAccounts}
        totalDebtSeries={totalDebtSeries}
        totalNetWorthStats={totalNetWorthStats}
        totalNetWorthAttribution={totalNetWorthAttribution}
        totalOverview={totalOverview}
      />

      <TotalHeatmapDialog
        open={totalHeatmapDialogOpen}
        onOpenChange={(open) => {
          setTotalHeatmapDialogOpen(open);
          if (!open) setTotalHeatmapDialog(null);
        }}
        state={totalHeatmapDialog}
        onOpenCategoryDrilldown={(args) => {
          openTotalDrilldownDialog({
            kind: "category",
            flow: args.flow,
            categoryId: args.categoryId,
            name: args.name,
            color: args.color,
          });
        }}
      />

      <TotalTimeseriesDialog
        open={totalTimeseriesDialogOpen}
        onOpenChange={(open) => {
          setTotalTimeseriesDialogOpen(open);
          if (!open) setTotalTimeseriesDialog(null);
        }}
        state={totalTimeseriesDialog}
        savingsRateDomain={totalSavingsRateDomain}
        onOpenNetWorthDetails={() => {
          openTotalDrilldownDialog({ kind: "netWorth" });
        }}
      />
    </MotionPage>
  );
};

export default Reports;
