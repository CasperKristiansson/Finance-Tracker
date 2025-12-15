import { Sparkles } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAppSelector } from "@/app/hooks";
import { MotionPage } from "@/components/motion-presets";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
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
import { ChartCard } from "./components/chart-card";
import { TotalHeatmapDialog } from "./components/total-heatmap-dialog";
import { TotalTimeseriesDialog } from "./components/total-timeseries-dialog";
import { MoneyFlowSankeyCard } from "./reports-sankey";
import type {
  DetailDialogState,
  ReportMode,
  TotalDrilldownState,
  TotalHeatmapDialogState,
  TotalTimeseriesDialogState,
  YearlyExtraDialogState,
} from "./reports-types";
import {
  compactCurrency,
  currency,
  downloadCsv,
  heatColor,
  isRecord,
  median,
  medianAbsoluteDeviation,
  monthLabel,
  monthName,
  percent,
} from "./reports-utils";

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
  const [totalSeasonalityHover, setTotalSeasonalityHover] = useState<{
    flow: "income" | "expense";
    year: number;
    monthIndex: number;
    value: number;
  } | null>(null);
  const [totalCategoryYearHover, setTotalCategoryYearHover] = useState<{
    flow: "income" | "expense";
    year: number;
    categoryName: string;
    value: number;
  } | null>(null);
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
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs tracking-wide text-slate-500 uppercase">
            Reports
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            Income, expense, and net
          </h1>
          <p className="text-sm text-slate-500">
            Yearly overview, trends, and high-signal breakdowns. Tax
            transactions are excluded — see{" "}
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
          <div className="w-[110px]">
            {routeMode === "yearly" ? (
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={year}
                onChange={(e) =>
                  navigate(`${PageRoutes.reportsYearly}/${e.target.value}`)
                }
              >
                {yearOptions.map((optionYear) => (
                  <option key={optionYear} value={optionYear}>
                    {optionYear}
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
                value={totalWindowPreset}
                onChange={(e) =>
                  setTotalWindowPreset(
                    e.target.value as "all" | "10" | "5" | "3",
                  )
                }
              >
                <option value="all">All time</option>
                <option value="10">Last 10y</option>
                <option value="5">Last 5y</option>
                <option value="3">Last 3y</option>
              </select>
            )}
          </div>
          <Button
            variant={routeMode === "yearly" ? "default" : "outline"}
            size="sm"
            onClick={() =>
              navigate(`${PageRoutes.reportsYearly}/${year}`, { replace: true })
            }
          >
            Yearly
          </Button>
          <Button
            variant={routeMode === "total" ? "default" : "outline"}
            size="sm"
            onClick={() => navigate(PageRoutes.reportsTotal, { replace: true })}
          >
            Total
          </Button>
        </div>
      </div>

      <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-sm text-slate-700">Overview</CardTitle>
            <p className="text-sm text-slate-500">
              Key totals for {routeMode === "yearly" ? year : "all time"}.
            </p>
          </div>
        </CardHeader>
        {routeMode === "yearly" && overview ? (
          <CardContent className="grid gap-3 md:grid-cols-4">
            {[
              {
                label: "Income",
                value: Number(overview.stats.total_income),
                color: "text-emerald-700",
              },
              {
                label: "Expense",
                value: Number(overview.stats.total_expense),
                color: "text-rose-700",
              },
              {
                label: "Net saved",
                value: Number(overview.stats.net_savings),
                color: "text-slate-900",
              },
              {
                label: "Savings rate",
                value: overview.stats.savings_rate_pct
                  ? Number(overview.stats.savings_rate_pct)
                  : null,
                color: "text-slate-900",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-4"
              >
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  {item.label}
                </p>
                <div className={`text-2xl font-semibold ${item.color}`}>
                  {item.value === null
                    ? "—"
                    : item.label === "Savings rate"
                      ? `${Math.round(item.value)}%`
                      : currency(item.value)}
                </div>
              </div>
            ))}
          </CardContent>
        ) : routeMode === "total" && totalKpis ? (
          <CardContent className="grid gap-3 md:grid-cols-6">
            {[
              {
                label: "Net worth",
                value: totalKpis.netWorth,
                format: "currency" as const,
                color: "text-slate-900",
              },
              {
                label: "Lifetime saved",
                value: totalKpis.lifetimeSaved,
                format: "currency" as const,
                color:
                  totalKpis.lifetimeSaved >= 0
                    ? "text-emerald-700"
                    : "text-rose-700",
              },
              {
                label: "Savings rate (lifetime)",
                value: totalKpis.lifetimeSavingsRate,
                format: "percent" as const,
                color: "text-slate-900",
              },
              {
                label: "Cash balance",
                value: totalKpis.cashBalance,
                format: "currency" as const,
                color: "text-slate-900",
              },
              {
                label: "Debt",
                value: totalKpis.debtTotal,
                format: "currency" as const,
                color: "text-orange-700",
              },
              {
                label: "Investments",
                value: totalKpis.investmentsValue,
                format: "currency" as const,
                color: "text-indigo-700",
              },
            ].map((item) => (
              <div
                key={item.label}
                className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-4"
              >
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  {item.label}
                </p>
                <div className={`text-2xl font-semibold ${item.color}`}>
                  {item.value === null
                    ? "—"
                    : item.format === "percent"
                      ? percent(item.value)
                      : currency(item.value)}
                </div>
              </div>
            ))}
          </CardContent>
        ) : null}
      </Card>

      {routeMode === "yearly" ? (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title={`Income vs expense (${year})`}
              description="Income and expense by month, with net line for turning points."
              loading={overviewLoading}
            >
              {!overview && !overviewLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-600">
                  <Sparkles className="h-6 w-6 text-slate-500" />
                  <p className="text-center">
                    No data for {year} yet. Import files or add transactions.
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={yearSeasonalityChart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 12 }}
                      tickFormatter={(v) => compactCurrency(Number(v))}
                    />
                    <Tooltip
                      shared
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;

                        const record = payload[0]?.payload;
                        if (!isRecord(record)) return null;

                        const monthLabel =
                          typeof record.month === "string" ? record.month : "";
                        const monthIndex =
                          typeof record.monthIndex === "number"
                            ? record.monthIndex
                            : null;

                        const incomeItem = payload.find(
                          (p) => p.dataKey === "income",
                        );
                        const expenseItem = payload.find(
                          (p) => p.dataKey === "expense",
                        );

                        const incomeTotal =
                          incomeItem?.value !== undefined &&
                          incomeItem.value !== null
                            ? Math.abs(Number(incomeItem.value))
                            : null;
                        const expenseTotal =
                          expenseItem?.value !== undefined &&
                          expenseItem.value !== null
                            ? Math.abs(Number(expenseItem.value))
                            : null;

                        const net =
                          typeof record.net === "number" ? record.net : null;

                        const buildBreakdown = (
                          breakdown:
                            | YearlyOverviewResponse["category_breakdown"]
                            | YearlyOverviewResponse["income_category_breakdown"]
                            | undefined,
                          fallbackColor: string,
                        ) => {
                          const sorted =
                            breakdown && monthIndex !== null
                              ? breakdown
                                  .map((row) => ({
                                    name: row.name,
                                    total: Math.abs(
                                      Number(row.monthly[monthIndex] ?? 0),
                                    ),
                                    color: row.color_hex ?? undefined,
                                  }))
                                  .filter(
                                    (row) =>
                                      Number.isFinite(row.total) &&
                                      row.total > 0,
                                  )
                                  .sort((a, b) => b.total - a.total)
                              : [];
                          const top = sorted.slice(0, 4);
                          const otherTotal = sorted
                            .slice(4)
                            .reduce((sum, row) => sum + row.total, 0);

                          return { top, otherTotal, fallbackColor };
                        };

                        const incomeBreakdown = buildBreakdown(
                          overview?.income_category_breakdown,
                          "#10b981",
                        );
                        const expenseBreakdown = buildBreakdown(
                          overview?.category_breakdown,
                          "#ef4444",
                        );

                        return (
                          <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                            <p className="font-semibold text-slate-800">
                              {monthLabel}
                            </p>

                            <div className="mt-1 grid gap-1">
                              <p className="text-slate-600">
                                Income:{" "}
                                <span className="font-medium text-slate-800 tabular-nums">
                                  {incomeTotal !== null
                                    ? currency(incomeTotal)
                                    : "—"}
                                </span>
                              </p>
                              <p className="text-slate-600">
                                Expense:{" "}
                                <span className="font-medium text-slate-800 tabular-nums">
                                  {expenseTotal !== null
                                    ? currency(expenseTotal)
                                    : "—"}
                                </span>
                              </p>
                              <p className="pt-1 font-semibold text-slate-900 tabular-nums">
                                Net: {net !== null ? currency(net) : "—"}
                              </p>
                            </div>

                            {overviewLoading ? (
                              <p className="mt-2 text-slate-500">
                                Loading breakdown…
                              </p>
                            ) : monthIndex !== null ? (
                              <div className="mt-2 space-y-2">
                                {incomeBreakdown.top.length ? (
                                  <div>
                                    <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                                      Income categories
                                    </p>
                                    <div className="mt-1 space-y-1">
                                      {incomeBreakdown.top.map((row) => (
                                        <div
                                          key={`${row.name}-${row.total}`}
                                          className="flex items-center justify-between gap-4"
                                        >
                                          <span className="flex min-w-0 items-center gap-2 text-slate-700">
                                            <span
                                              className="h-2 w-2 shrink-0 rounded-full"
                                              style={{
                                                backgroundColor:
                                                  row.color ??
                                                  incomeBreakdown.fallbackColor,
                                              }}
                                            />
                                            <span className="truncate">
                                              {row.name}
                                            </span>
                                          </span>
                                          <span className="font-medium text-slate-800 tabular-nums">
                                            {currency(row.total)}
                                          </span>
                                        </div>
                                      ))}
                                      {incomeBreakdown.otherTotal ? (
                                        <div className="flex items-center justify-between gap-4 pt-1 text-slate-600">
                                          <span>Other</span>
                                          <span className="font-medium tabular-nums">
                                            {currency(
                                              incomeBreakdown.otherTotal,
                                            )}
                                          </span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}

                                {expenseBreakdown.top.length ? (
                                  <div>
                                    <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                                      Expense categories
                                    </p>
                                    <div className="mt-1 space-y-1">
                                      {expenseBreakdown.top.map((row) => (
                                        <div
                                          key={`${row.name}-${row.total}`}
                                          className="flex items-center justify-between gap-4"
                                        >
                                          <span className="flex min-w-0 items-center gap-2 text-slate-700">
                                            <span
                                              className="h-2 w-2 shrink-0 rounded-full"
                                              style={{
                                                backgroundColor:
                                                  row.color ??
                                                  expenseBreakdown.fallbackColor,
                                              }}
                                            />
                                            <span className="truncate">
                                              {row.name}
                                            </span>
                                          </span>
                                          <span className="font-medium text-slate-800 tabular-nums">
                                            {currency(row.total)}
                                          </span>
                                        </div>
                                      ))}
                                      {expenseBreakdown.otherTotal ? (
                                        <div className="flex items-center justify-between gap-4 pt-1 text-slate-600">
                                          <span>Other</span>
                                          <span className="font-medium tabular-nums">
                                            {currency(
                                              expenseBreakdown.otherTotal,
                                            )}
                                          </span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine y={0} stroke="#cbd5e1" />
                    <Bar
                      dataKey="income"
                      name="Income"
                      fill="#10b981"
                      radius={[8, 8, 0, 0]}
                      barSize={24}
                    />
                    <Bar
                      dataKey="expense"
                      name="Expense"
                      fill="#ef4444"
                      radius={[8, 8, 0, 0]}
                      barSize={24}
                    />
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Net"
                      stroke="#0f172a"
                      strokeWidth={2}
                      dot={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <ChartCard
              title="Net worth growth"
              description="Includes investment snapshots when available."
              loading={overviewLoading}
            >
              <ChartContainer
                className="h-full w-full"
                config={{
                  net: {
                    label: "Net worth",
                    color: "#4f46e5",
                  },
                }}
              >
                <AreaChart
                  data={netWorthChart}
                  margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="netFillReports"
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
                    domain={netWorthDomain}
                    allowDataOverflow
                    tickMargin={12}
                    width={90}
                    tickFormatter={(v) => compactCurrency(Number(v))}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  {netWorthQuarterMarkers.map((marker) => (
                    <ReferenceLine
                      key={marker.label}
                      x={marker.date}
                      stroke="#cbd5e1"
                      strokeDasharray="4 4"
                      label={{
                        value: marker.label,
                        position: "insideTopLeft",
                        fill: "#475569",
                        fontSize: 10,
                      }}
                    />
                  ))}
                  <Area
                    type="monotoneX"
                    connectNulls
                    dataKey="net"
                    stroke="#4f46e5"
                    fill="url(#netFillReports)"
                    strokeWidth={2}
                    name="Net worth"
                  />
                </AreaChart>
              </ChartContainer>
            </ChartCard>
          </div>

          <MoneyFlowSankeyCard
            title={`Where the money went (${year})`}
            description="Income categories flowing into expenses and savings."
            incomeCategories={incomeCategoryChartData}
            expenseCategories={categoryChartData}
            loading={overviewLoading}
          />

          <div className="grid gap-3 lg:grid-cols-3">
            <ChartCard
              title="Debt"
              description="Trend and breakdown by account."
              loading={overviewLoading}
            >
              <Tabs defaultValue="trend" className="flex h-full flex-col">
                <TabsList className="self-start">
                  <TabsTrigger value="trend">Trend</TabsTrigger>
                  <TabsTrigger value="accounts">Accounts</TabsTrigger>
                </TabsList>
                <TabsContent value="trend" className="mt-2 min-h-0 flex-1">
                  <div className="h-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={debtChart}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis hide />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="debt"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                <TabsContent
                  value="accounts"
                  className="mt-2 min-h-0 flex-1 overflow-auto"
                >
                  {debtOverviewRows.length ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">End</TableHead>
                          <TableHead className="hidden text-right md:table-cell">
                            Δ
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {debtOverviewRows.map((row) => (
                          <TableRow
                            key={row.id}
                            className="cursor-pointer"
                            onClick={() => {
                              openDetailDialog({
                                kind: "debt",
                                title: `${row.name} (${year})`,
                                monthly: row.monthly,
                                startDebt: row.startDebt,
                                endDebt: row.endDebt,
                                delta: row.delta,
                              });
                            }}
                          >
                            <TableCell className="max-w-[180px] truncate font-medium">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {currency(row.endDebt)}
                            </TableCell>
                            <TableCell className="hidden text-right text-xs md:table-cell">
                              <span
                                className={
                                  row.delta <= 0
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }
                              >
                                {row.delta >= 0 ? "+" : "−"}
                                {currency(Math.abs(row.delta))}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                      No debt accounts found for this selection.
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </ChartCard>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Saving rate
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Income, expense, and what you kept.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!savings ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Savings rate
                        </p>
                        <p className="text-3xl font-semibold text-slate-900">
                          {savings.rate === null
                            ? "—"
                            : `${Math.round(savings.rate)}%`}
                        </p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <p>{currency(savings.saved)} saved</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Income</span>
                          <span className="font-semibold text-emerald-700">
                            {currency(savings.income)}
                          </span>
                        </div>
                        <Progress value={100} className="h-2" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Expense</span>
                          <span className="font-semibold text-rose-700">
                            {currency(savings.expense)}
                          </span>
                        </div>
                        <Progress
                          value={
                            savings.income > 0
                              ? Math.min(
                                  100,
                                  (savings.expense / savings.income) * 100,
                                )
                              : 0
                          }
                          className="h-2"
                        />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-600">Saved</span>
                          <span className="font-semibold text-slate-900">
                            {currency(savings.saved)}
                          </span>
                        </div>
                        <Progress
                          value={
                            savings.income > 0
                              ? Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (savings.saved / savings.income) * 100,
                                  ),
                                )
                              : 0
                          }
                          className="h-2"
                        />
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Summary
                </CardTitle>
                <p className="text-xs text-slate-500">
                  High-signal totals and highlights.
                </p>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!overview ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total income</span>
                      <span className="font-semibold text-emerald-700">
                        {currency(Number(overview.stats.total_income))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Total expenses</span>
                      <span className="font-semibold text-rose-700">
                        {currency(Number(overview.stats.total_expense))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Net savings</span>
                      <span className="font-semibold text-slate-900">
                        {currency(Number(overview.stats.net_savings))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Savings rate</span>
                      <span className="font-semibold text-slate-900">
                        {overview.stats.savings_rate_pct
                          ? `${Math.round(Number(overview.stats.savings_rate_pct))}%`
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600">Avg monthly spend</span>
                      <span className="font-semibold text-slate-900">
                        {currency(Number(overview.stats.avg_monthly_spend))}
                      </span>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                      <p className="font-semibold">Biggest months</p>
                      <p>
                        Income:{" "}
                        {monthName(
                          year,
                          overview.stats.biggest_income_month.month,
                        )}{" "}
                        (
                        {currency(
                          Number(overview.stats.biggest_income_month.amount),
                        )}
                        )
                      </p>
                      <p>
                        Expense:{" "}
                        {monthName(
                          year,
                          overview.stats.biggest_expense_month.month,
                        )}{" "}
                        (
                        {currency(
                          Number(overview.stats.biggest_expense_month.amount),
                        )}
                        )
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Category drivers
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Biggest YoY shifts (expense + income).
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setYearlyExtraDialog({ kind: "categoryDrivers" })
                  }
                  disabled={!overview || !prevOverview}
                >
                  Details
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!overview ? (
                  <Skeleton className="h-44 w-full" />
                ) : prevOverviewLoading ? (
                  <Skeleton className="h-44 w-full" />
                ) : !prevOverview ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    Need prior-year data to compute YoY drivers.
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-slate-600">
                      Comparing {year} vs {year - 1}
                    </div>
                    <div className="grid gap-2">
                      {yearlyExpenseCategoryDeltas
                        .filter((row) => row.delta > 0)
                        .slice(0, 3)
                        .map((row) => (
                          <button
                            key={`exp-up-${row.key}`}
                            type="button"
                            className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-left text-xs"
                            onClick={() => {
                              if (!row.id) return;
                              setSelectedCategoryFlow("expense");
                              setSelectedCategoryId(row.id);
                            }}
                            disabled={!row.id}
                          >
                            <span className="max-w-[140px] truncate font-medium text-slate-900">
                              {row.name}
                            </span>
                            <span className="font-semibold text-rose-700">
                              +{currency(row.delta)}
                            </span>
                          </button>
                        ))}
                      {yearlyExpenseCategoryDeltas
                        .filter((row) => row.delta < 0)
                        .slice(0, 2)
                        .map((row) => (
                          <button
                            key={`exp-down-${row.key}`}
                            type="button"
                            className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-left text-xs"
                            onClick={() => {
                              if (!row.id) return;
                              setSelectedCategoryFlow("expense");
                              setSelectedCategoryId(row.id);
                            }}
                            disabled={!row.id}
                          >
                            <span className="max-w-[140px] truncate font-medium text-slate-900">
                              {row.name}
                            </span>
                            <span className="font-semibold text-emerald-700">
                              −{currency(Math.abs(row.delta))}
                            </span>
                          </button>
                        ))}
                    </div>
                    <div className="text-xs text-slate-500">
                      Tip: click an item to open its monthly breakdown.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Merchant deltas
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Biggest YoY shifts by description.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setYearlyExtraDialog({
                      kind: "merchantDrivers",
                      flow: "expense",
                    })
                  }
                  disabled={!overview || !prevOverview}
                >
                  Details
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!overview ? (
                  <Skeleton className="h-44 w-full" />
                ) : prevOverviewLoading ? (
                  <Skeleton className="h-44 w-full" />
                ) : !prevOverview ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    Need prior-year data to compute merchant deltas.
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-slate-600">
                      Comparing {year} vs {year - 1}
                    </div>
                    <div className="grid gap-2">
                      {yearlyExpenseSourceDeltas.slice(0, 5).map((row) => (
                        <button
                          key={row.source}
                          type="button"
                          className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-left text-xs"
                          onClick={() =>
                            openYearlySourceDetail("expense", row.source)
                          }
                        >
                          <span className="max-w-[150px] truncate font-medium text-slate-900">
                            {row.source}
                          </span>
                          <span
                            className={
                              row.delta <= 0
                                ? "font-semibold text-emerald-700"
                                : "font-semibold text-rose-700"
                            }
                          >
                            {row.delta >= 0 ? "+" : "−"}
                            {currency(Math.abs(row.delta))}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-slate-500">
                      Click a merchant to compare monthly patterns.
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    One-off transactions
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Largest single expenses this year.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setYearlyExtraDialog({ kind: "oneOffs" })}
                  disabled={!overview || !overview.largest_transactions.length}
                >
                  Details
                </Button>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!overview ? (
                  <Skeleton className="h-44 w-full" />
                ) : overview.largest_transactions.length ? (
                  overview.largest_transactions.slice(0, 5).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-left text-xs"
                      onClick={() => setYearlyExtraDialog({ kind: "oneOffs" })}
                    >
                      <span className="max-w-[150px] truncate font-medium text-slate-900">
                        {row.merchant}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {currency(Number(row.amount))}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    No large transactions yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Savings decomposition
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Net = income − expense, vs last year.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setYearlyExtraDialog({ kind: "savingsDecomposition" })
                  }
                  disabled={!yearlySavingsDecomposition}
                >
                  Details
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {!overview ? (
                  <Skeleton className="h-44 w-full" />
                ) : prevOverviewLoading ? (
                  <Skeleton className="h-44 w-full" />
                ) : !yearlySavingsDecomposition ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    Need prior-year data to decompose savings.
                  </div>
                ) : (
                  <>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Net change ({year} vs {year - 1})
                      </p>
                      <p
                        className={
                          yearlySavingsDecomposition.netDelta >= 0
                            ? "text-2xl font-semibold text-emerald-700"
                            : "text-2xl font-semibold text-rose-700"
                        }
                      >
                        {yearlySavingsDecomposition.netDelta >= 0 ? "+" : "−"}
                        {currency(
                          Math.abs(yearlySavingsDecomposition.netDelta),
                        )}
                      </p>
                      <p className="text-xs text-slate-600">
                        {currency(yearlySavingsDecomposition.netPrev)} →{" "}
                        {currency(yearlySavingsDecomposition.netNow)}
                      </p>
                    </div>
                    <div className="grid gap-2">
                      {yearlySavingsDecomposition.contributions
                        .slice(0, 4)
                        .map((row) => (
                          <button
                            key={`${row.kind}-${row.name}`}
                            type="button"
                            className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-left text-xs"
                            onClick={() => {
                              if (!row.id) return;
                              setSelectedCategoryFlow(
                                row.kind === "income" ? "income" : "expense",
                              );
                              setSelectedCategoryId(row.id);
                            }}
                            disabled={!row.id}
                          >
                            <span className="max-w-[150px] truncate font-medium text-slate-900">
                              {row.name}
                            </span>
                            <span
                              className={
                                row.contribution >= 0
                                  ? "font-semibold text-emerald-700"
                                  : "font-semibold text-rose-700"
                              }
                            >
                              {row.contribution >= 0 ? "+" : "−"}
                              {currency(Math.abs(row.contribution))}
                            </span>
                          </button>
                        ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title="Category breakdown (expenses)"
              description="Top categories + Other. Click to drill down."
              loading={overviewLoading}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={categoryChartData.map((row) => ({
                    ...row,
                    total: row.total,
                  }))}
                  layout="vertical"
                  margin={{ left: 16, right: 12, top: 8, bottom: 8 }}
                  onClick={(
                    state: {
                      activePayload?: Array<{ payload?: { id?: unknown } }>;
                    } | null,
                  ) => {
                    const id = state?.activePayload?.[0]?.payload?.id;
                    if (typeof id === "string" && id.length) {
                      setSelectedCategoryFlow("expense");
                      setSelectedCategoryId(id);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={120}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0]?.payload;
                      if (!isRecord(item)) return null;
                      const name =
                        typeof item.name === "string" ? item.name : "Category";
                      const total = Number(item.total ?? 0);
                      return (
                        <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-semibold text-slate-800">{name}</p>
                          <p className="text-slate-600">{currency(total)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 6, 6]}>
                    {categoryChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Spending heatmap
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Seasonality by category and month.
                </p>
              </CardHeader>
              <CardContent className="overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <div className="min-w-[560px]">
                    <div className="grid grid-cols-[160px_repeat(12,minmax(28px,1fr))] gap-1 text-[11px] text-slate-600">
                      <div />
                      {Array.from({ length: 12 }, (_, idx) => (
                        <div key={idx} className="text-center">
                          {monthLabel(
                            new Date(Date.UTC(year, idx, 1)).toISOString(),
                          )}
                        </div>
                      ))}
                      {heatmap.rows.map((row) => (
                        <React.Fragment key={row.name}>
                          <div className="truncate pr-2 text-slate-700">
                            {row.name}
                          </div>
                          {row.monthly.map((value, idx) => {
                            const intensity =
                              heatmap.max > 0 ? value / heatmap.max : 0;
                            const bg = `rgba(239, 68, 68, ${Math.min(0.08 + intensity * 0.6, 0.7)})`;
                            return (
                              <div
                                key={idx}
                                title={`${row.name} — ${monthName(year, idx + 1)}: ${currency(value)}`}
                                className="h-7 rounded-sm border border-slate-100"
                                style={{
                                  backgroundColor: value > 0 ? bg : undefined,
                                }}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard
              title="Category breakdown (income)"
              description="Top categories + Other. Click to drill down."
              loading={overviewLoading}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={incomeCategoryChartData.map((row) => ({
                    ...row,
                    total: row.total,
                  }))}
                  layout="vertical"
                  margin={{ left: 16, right: 12, top: 8, bottom: 8 }}
                  onClick={(
                    state: {
                      activePayload?: Array<{ payload?: { id?: unknown } }>;
                    } | null,
                  ) => {
                    const id = state?.activePayload?.[0]?.payload?.id;
                    if (typeof id === "string" && id.length) {
                      setSelectedCategoryFlow("income");
                      setSelectedCategoryId(id);
                    }
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={120}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0]?.payload;
                      if (!isRecord(item)) return null;
                      const name =
                        typeof item.name === "string" ? item.name : "Category";
                      const total = Number(item.total ?? 0);
                      return (
                        <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-semibold text-slate-800">{name}</p>
                          <p className="text-slate-600">{currency(total)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" radius={[6, 6, 6, 6]}>
                    {incomeCategoryChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Income heatmap
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Seasonality by category and month.
                </p>
              </CardHeader>
              <CardContent className="overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <div className="min-w-[560px]">
                    <div className="grid grid-cols-[160px_repeat(12,minmax(28px,1fr))] gap-1 text-[11px] text-slate-600">
                      <div />
                      {Array.from({ length: 12 }, (_, idx) => (
                        <div key={idx} className="text-center">
                          {monthLabel(
                            new Date(Date.UTC(year, idx, 1)).toISOString(),
                          )}
                        </div>
                      ))}
                      {incomeHeatmap.rows.map((row) => (
                        <React.Fragment key={row.name}>
                          <div className="truncate pr-2 text-slate-700">
                            {row.name}
                          </div>
                          {row.monthly.map((value, idx) => {
                            const intensity =
                              incomeHeatmap.max > 0
                                ? value / incomeHeatmap.max
                                : 0;
                            const bg = `rgba(16, 185, 129, ${Math.min(0.08 + intensity * 0.6, 0.7)})`;
                            return (
                              <div
                                key={idx}
                                title={`${row.name} — ${monthName(year, idx + 1)}: ${currency(value)}`}
                                className="h-7 rounded-sm border border-slate-100"
                                style={{
                                  backgroundColor: value > 0 ? bg : undefined,
                                }}
                              />
                            );
                          })}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-1">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Investments summary
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    Snapshot-based (not a spending category).
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!overview || !investmentsSummary}
                  onClick={() => {
                    if (!investmentsSummary) return;
                    openDetailDialog({
                      kind: "investments",
                      title: `Investments (${year})`,
                      asOf: investmentsSummary.asOf,
                      monthly: investmentsSummary.monthly,
                      accounts: investmentsSummary.accounts.map((row) => ({
                        name: row.name,
                        start: row.start,
                        end: row.end,
                        change: row.change,
                      })),
                      summary: {
                        start: investmentsSummary.start,
                        end: investmentsSummary.end,
                        change: investmentsSummary.change,
                        changePct: investmentsSummary.changePct,
                        contributions: investmentsSummary.contributions,
                        withdrawals: investmentsSummary.withdrawals,
                      },
                    });
                  }}
                >
                  Details
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {!overview || !investmentsSummary ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          As of
                        </p>
                        <p className="font-semibold text-slate-900">
                          {new Date(investmentsSummary.asOf).toLocaleDateString(
                            "sv-SE",
                          )}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Value
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(investmentsSummary.end)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {investmentsSummary.change >= 0 ? "+" : "−"}
                          {currency(Math.abs(investmentsSummary.change))}{" "}
                          {investmentsSummary.changePct !== null
                            ? `(${percent(investmentsSummary.changePct)})`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Contributions
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(investmentsSummary.contributions)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Withdrawals
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(investmentsSummary.withdrawals)}
                        </p>
                      </div>
                    </div>

                    <div className="h-44 rounded-md border border-slate-100 bg-white p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={investmentsSummary.monthly}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            formatter={(value) => currency(Number(value))}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#4f46e5"
                            fill="rgba(79,70,229,0.15)"
                            strokeWidth={2}
                            name="Portfolio"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="rounded-md border border-slate-100">
                      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                        Accounts
                      </div>
                      <div className="max-h-44 overflow-auto">
                        {investmentsSummary.accounts.length ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Account</TableHead>
                                <TableHead className="text-right">
                                  End
                                </TableHead>
                                <TableHead className="text-right">
                                  Change
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {investmentsSummary.accounts.map((row) => (
                                <TableRow
                                  key={row.name}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    openDetailDialog({
                                      kind: "investments",
                                      title: `${row.name} (${year})`,
                                      asOf: investmentsSummary.asOf,
                                      monthly: investmentsSummary.monthly,
                                      accounts: [
                                        {
                                          name: row.name,
                                          start: row.start,
                                          end: row.end,
                                          change: row.change,
                                        },
                                      ],
                                      summary: {
                                        start: row.start,
                                        end: row.end,
                                        change: row.change,
                                        changePct:
                                          row.start > 0
                                            ? (row.change / row.start) * 100
                                            : null,
                                        contributions: 0,
                                        withdrawals: 0,
                                      },
                                    });
                                  }}
                                >
                                  <TableCell className="font-medium">
                                    {row.name}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {currency(row.end)}
                                  </TableCell>
                                  <TableCell className="text-right text-xs">
                                    <span
                                      className={
                                        row.change >= 0
                                          ? "text-emerald-700"
                                          : "text-rose-700"
                                      }
                                    >
                                      {row.change >= 0 ? "+" : "−"}
                                      {currency(Math.abs(row.change))}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="p-3 text-sm text-slate-500">
                            No investment accounts captured yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Income sources
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Grouped by description. Click for seasonality.
                </p>
              </CardHeader>
              <CardContent className="max-h-[26rem] overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : incomeSourceRows.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          Tx
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomeSourceRows.slice(0, 14).map((row) => (
                        <TableRow
                          key={row.source}
                          className="cursor-pointer"
                          onClick={() => {
                            openYearlySourceDetail("income", row.source);
                          }}
                        >
                          <TableCell className="max-w-[220px] truncate font-medium">
                            {row.source}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(row.total)}
                          </TableCell>
                          <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                            {row.txCount}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No income sources yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Expense sources
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Grouped by description or merchant. Click for seasonality.
                </p>
              </CardHeader>
              <CardContent className="flex max-h-[26rem] flex-col">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <Tabs
                    defaultValue="sources"
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <TabsList className="self-start">
                      <TabsTrigger value="sources">Sources</TabsTrigger>
                      <TabsTrigger value="merchants">Merchants</TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="sources"
                      className="mt-2 min-h-0 flex-1 overflow-auto"
                    >
                      {expenseSourceRows.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Source</TableHead>
                              <TableHead className="text-right">
                                Total
                              </TableHead>
                              <TableHead className="hidden text-right md:table-cell">
                                Tx
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {expenseSourceRows.slice(0, 14).map((row) => (
                              <TableRow
                                key={row.source}
                                className="cursor-pointer"
                                onClick={() => {
                                  openYearlySourceDetail("expense", row.source);
                                }}
                              >
                                <TableCell className="max-w-[220px] truncate font-medium">
                                  {row.source}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {currency(row.total)}
                                </TableCell>
                                <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                                  {row.txCount}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                          No expense sources yet.
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent
                      value="merchants"
                      className="mt-2 min-h-0 flex-1 overflow-auto"
                    >
                      {overview.top_merchants.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Merchant</TableHead>
                              <TableHead className="text-right">
                                Amount
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {overview.top_merchants.slice(0, 14).map((row) => (
                              <TableRow
                                key={row.merchant}
                                className="cursor-pointer"
                                onClick={() =>
                                  openYearlySourceDetail(
                                    "expense",
                                    row.merchant,
                                  )
                                }
                              >
                                <TableCell className="max-w-[220px] truncate font-medium">
                                  {row.merchant}
                                </TableCell>
                                <TableCell className="text-right">
                                  {currency(Number(row.amount))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                          No merchant spend yet.
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Account flows
              </CardTitle>
              <p className="text-xs text-slate-500">
                Net operating (income − expense) vs net transfers. Click a row
                for monthly detail.
              </p>
            </CardHeader>
            <CardContent className="max-h-[32rem] overflow-auto">
              {!overview ? (
                <Skeleton className="h-56 w-full" />
              ) : accountFlowRows.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        Net operating
                      </TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        Net transfers
                      </TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountFlowRows.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() => {
                          openDetailDialog({
                            kind: "account",
                            title: `${row.name} (${year})`,
                            accountType: row.accountType,
                            startBalance: row.startBalance,
                            endBalance: row.endBalance,
                            change: row.change,
                            monthly: row.monthly,
                          });
                        }}
                      >
                        <TableCell className="max-w-[220px] truncate font-medium">
                          {row.name}
                          <span className="ml-2 text-xs text-slate-500">
                            ({row.accountType})
                          </span>
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          {currency(row.netOperating)}
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          {currency(row.netTransfers)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          <span
                            className={
                              row.change >= 0
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }
                          >
                            {row.change >= 0 ? "+" : "−"}
                            {currency(Math.abs(row.change))}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  No account flows available.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Largest transactions
                </CardTitle>
                <p className="text-xs text-slate-500">
                  High-impact items with category and note.
                </p>
              </CardHeader>
              <CardContent className="max-h-[22rem] overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Merchant</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.largest_transactions.slice(0, 8).map((row) => (
                        <TableRow
                          key={row.id}
                          className="cursor-pointer"
                          onClick={() =>
                            setYearlyExtraDialog({ kind: "oneOffs" })
                          }
                        >
                          <TableCell className="max-w-[160px] truncate font-medium">
                            {row.merchant}
                          </TableCell>
                          <TableCell className="max-w-[120px] truncate text-xs text-slate-600">
                            {row.category_name}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(Number(row.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Category changes
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Ranked by increased spend vs last year.
                </p>
              </CardHeader>
              <CardContent className="max-h-[22rem] overflow-auto">
                {!overview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Δ</TableHead>
                        <TableHead className="text-right">This year</TableHead>
                        <TableHead className="text-right">YoY</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overview.category_changes.map((row) => (
                        <TableRow
                          key={row.name}
                          className={
                            row.category_id ? "cursor-pointer" : undefined
                          }
                          onClick={() => {
                            if (!row.category_id) return;
                            setSelectedCategoryFlow("expense");
                            setSelectedCategoryId(row.category_id);
                          }}
                        >
                          <TableCell className="font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(Number(row.delta))}
                          </TableCell>
                          <TableCell className="text-right">
                            {currency(Number(row.amount))}
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-600">
                            {row.delta_pct
                              ? `${Math.round(Number(row.delta_pct))}%`
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          <Dialog
            open={Boolean(yearlyExtraDialog)}
            onOpenChange={(open) => {
              if (!open) setYearlyExtraDialog(null);
            }}
          >
            <DialogContent className="max-w-5xl">
              <DialogHeader>
                <DialogTitle>
                  {yearlyExtraDialog?.kind === "categoryDrivers"
                    ? `Category drivers (${year} vs ${year - 1})`
                    : yearlyExtraDialog?.kind === "merchantDrivers"
                      ? `Merchant deltas (${year} vs ${year - 1})`
                      : yearlyExtraDialog?.kind === "oneOffs"
                        ? `Largest transactions (${year})`
                        : yearlyExtraDialog?.kind === "savingsDecomposition"
                          ? `Savings decomposition (${year} vs ${year - 1})`
                          : "Details"}
                </DialogTitle>
              </DialogHeader>
              {!yearlyExtraDialog ? null : yearlyExtraDialog.kind ===
                "categoryDrivers" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-md border border-slate-100 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                      <span>Expenses</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!yearlyExpenseCategoryDeltas.length) return;
                          downloadCsv(
                            `reports-yearly-${year}-expense-category-deltas.csv`,
                            yearlyExpenseCategoryDeltas.map((row) => ({
                              category: row.name,
                              delta: row.delta,
                              this_year: row.current,
                              last_year: row.prev,
                              delta_pct: row.deltaPct ?? "",
                            })),
                          );
                        }}
                        disabled={!yearlyExpenseCategoryDeltas.length}
                      >
                        Export
                      </Button>
                    </div>
                    <div className="max-h-[26rem] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Δ</TableHead>
                            <TableHead className="text-right">This</TableHead>
                            <TableHead className="text-right">YoY</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {yearlyExpenseCategoryDeltas.map((row) => (
                            <TableRow
                              key={`exp-${row.key}`}
                              className={row.id ? "cursor-pointer" : undefined}
                              onClick={() => {
                                if (!row.id) return;
                                setYearlyExtraDialog(null);
                                setSelectedCategoryFlow("expense");
                                setSelectedCategoryId(row.id);
                              }}
                            >
                              <TableCell className="max-w-[220px] truncate font-medium">
                                {row.name}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                <span
                                  className={
                                    row.delta <= 0
                                      ? "text-emerald-700"
                                      : "text-rose-700"
                                  }
                                >
                                  {row.delta >= 0 ? "+" : "−"}
                                  {currency(Math.abs(row.delta))}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {currency(row.current)}
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-600">
                                {row.deltaPct !== null
                                  ? `${Math.round(row.deltaPct)}%`
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                      <span>Income</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!yearlyIncomeCategoryDeltas.length) return;
                          downloadCsv(
                            `reports-yearly-${year}-income-category-deltas.csv`,
                            yearlyIncomeCategoryDeltas.map((row) => ({
                              category: row.name,
                              delta: row.delta,
                              this_year: row.current,
                              last_year: row.prev,
                              delta_pct: row.deltaPct ?? "",
                            })),
                          );
                        }}
                        disabled={!yearlyIncomeCategoryDeltas.length}
                      >
                        Export
                      </Button>
                    </div>
                    <div className="max-h-[26rem] overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Δ</TableHead>
                            <TableHead className="text-right">This</TableHead>
                            <TableHead className="text-right">YoY</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {yearlyIncomeCategoryDeltas.map((row) => (
                            <TableRow
                              key={`inc-${row.key}`}
                              className={row.id ? "cursor-pointer" : undefined}
                              onClick={() => {
                                if (!row.id) return;
                                setYearlyExtraDialog(null);
                                setSelectedCategoryFlow("income");
                                setSelectedCategoryId(row.id);
                              }}
                            >
                              <TableCell className="max-w-[220px] truncate font-medium">
                                {row.name}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                <span
                                  className={
                                    row.delta >= 0
                                      ? "text-emerald-700"
                                      : "text-rose-700"
                                  }
                                >
                                  {row.delta >= 0 ? "+" : "−"}
                                  {currency(Math.abs(row.delta))}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {currency(row.current)}
                              </TableCell>
                              <TableCell className="text-right text-xs text-slate-600">
                                {row.deltaPct !== null
                                  ? `${Math.round(row.deltaPct)}%`
                                  : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : yearlyExtraDialog.kind === "merchantDrivers" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-600">
                      Click a row for monthly comparison. Uses transaction
                      descriptions, so rename noise as needed.
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          yearlyExtraDialog.flow === "expense"
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          setYearlyExtraDialog({
                            kind: "merchantDrivers",
                            flow: "expense",
                          })
                        }
                      >
                        Expense
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={
                          yearlyExtraDialog.flow === "income"
                            ? "default"
                            : "outline"
                        }
                        onClick={() =>
                          setYearlyExtraDialog({
                            kind: "merchantDrivers",
                            flow: "income",
                          })
                        }
                      >
                        Income
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const rows =
                            yearlyExtraDialog.flow === "income"
                              ? yearlyIncomeSourceDeltas
                              : yearlyExpenseSourceDeltas;
                          if (!rows.length) return;
                          downloadCsv(
                            `reports-yearly-${year}-${yearlyExtraDialog.flow}-merchant-deltas.csv`,
                            rows.map((row) => ({
                              source: row.source,
                              delta: row.delta,
                              this_year: row.current,
                              last_year: row.prev,
                              delta_pct: row.deltaPct ?? "",
                              tx_count: row.txCount,
                            })),
                          );
                        }}
                        disabled={
                          (yearlyExtraDialog.flow === "income"
                            ? yearlyIncomeSourceDeltas
                            : yearlyExpenseSourceDeltas
                          ).length === 0
                        }
                      >
                        Export
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-100 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Source</TableHead>
                          <TableHead className="text-right">Δ</TableHead>
                          <TableHead className="text-right">This</TableHead>
                          <TableHead className="text-right">Last</TableHead>
                          <TableHead className="hidden text-right md:table-cell">
                            YoY
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(yearlyExtraDialog.flow === "income"
                          ? yearlyIncomeSourceDeltas
                          : yearlyExpenseSourceDeltas
                        ).map((row) => (
                          <TableRow
                            key={row.source}
                            className="cursor-pointer"
                            onClick={() => {
                              setYearlyExtraDialog(null);
                              openYearlySourceDetail(
                                yearlyExtraDialog.flow,
                                row.source,
                              );
                            }}
                          >
                            <TableCell className="max-w-[260px] truncate font-medium">
                              {row.source}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              <span
                                className={
                                  yearlyExtraDialog.flow === "expense"
                                    ? row.delta <= 0
                                      ? "text-emerald-700"
                                      : "text-rose-700"
                                    : row.delta >= 0
                                      ? "text-emerald-700"
                                      : "text-rose-700"
                                }
                              >
                                {row.delta >= 0 ? "+" : "−"}
                                {currency(Math.abs(row.delta))}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              {currency(row.current)}
                            </TableCell>
                            <TableCell className="text-right">
                              {currency(row.prev)}
                            </TableCell>
                            <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                              {row.deltaPct !== null
                                ? `${Math.round(row.deltaPct)}%`
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : yearlyExtraDialog.kind === "oneOffs" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs text-slate-600">
                      Largest expenses captured as individual transactions.
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (!overview?.largest_transactions.length) return;
                        downloadCsv(
                          `reports-yearly-${year}-largest-transactions.csv`,
                          overview.largest_transactions.map((row) => ({
                            id: row.id,
                            occurred_at: row.occurred_at,
                            merchant: row.merchant,
                            amount: Number(row.amount),
                            category: row.category_name,
                            notes: row.notes ?? "",
                          })),
                        );
                      }}
                      disabled={!overview?.largest_transactions.length}
                    >
                      Export
                    </Button>
                  </div>
                  {!overview ? (
                    <Skeleton className="h-56 w-full" />
                  ) : (
                    <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-100 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Merchant</TableHead>
                            <TableHead className="hidden md:table-cell">
                              Category
                            </TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {overview.largest_transactions.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="text-xs text-slate-600">
                                {new Date(row.occurred_at).toLocaleDateString(
                                  "sv-SE",
                                  {
                                    year: "numeric",
                                    month: "short",
                                    day: "2-digit",
                                  },
                                )}
                              </TableCell>
                              <TableCell className="max-w-[260px] truncate font-medium">
                                {row.merchant}
                              </TableCell>
                              <TableCell className="hidden max-w-[220px] truncate text-xs text-slate-600 md:table-cell">
                                {row.category_name}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {currency(Number(row.amount))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              ) : yearlyExtraDialog.kind === "savingsDecomposition" ? (
                <div className="space-y-4">
                  {!yearlySavingsDecomposition ? (
                    <Skeleton className="h-56 w-full" />
                  ) : (
                    <>
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                          <p className="text-xs tracking-wide text-slate-500 uppercase">
                            Net delta
                          </p>
                          <p
                            className={
                              yearlySavingsDecomposition.netDelta >= 0
                                ? "text-xl font-semibold text-emerald-700"
                                : "text-xl font-semibold text-rose-700"
                            }
                          >
                            {yearlySavingsDecomposition.netDelta >= 0
                              ? "+"
                              : "−"}
                            {currency(
                              Math.abs(yearlySavingsDecomposition.netDelta),
                            )}
                          </p>
                          <p className="text-xs text-slate-600">
                            {currency(yearlySavingsDecomposition.netPrev)} →{" "}
                            {currency(yearlySavingsDecomposition.netNow)}
                          </p>
                        </div>
                        <div className="rounded-md border border-slate-100 bg-white p-3">
                          <p className="text-xs tracking-wide text-slate-500 uppercase">
                            Income delta
                          </p>
                          <p
                            className={
                              yearlySavingsDecomposition.incomeDelta >= 0
                                ? "text-xl font-semibold text-emerald-700"
                                : "text-xl font-semibold text-rose-700"
                            }
                          >
                            {yearlySavingsDecomposition.incomeDelta >= 0
                              ? "+"
                              : "−"}
                            {currency(
                              Math.abs(yearlySavingsDecomposition.incomeDelta),
                            )}
                          </p>
                        </div>
                        <div className="rounded-md border border-slate-100 bg-white p-3">
                          <p className="text-xs tracking-wide text-slate-500 uppercase">
                            Expense delta
                          </p>
                          <p
                            className={
                              yearlySavingsDecomposition.expenseDelta <= 0
                                ? "text-xl font-semibold text-emerald-700"
                                : "text-xl font-semibold text-rose-700"
                            }
                          >
                            {yearlySavingsDecomposition.expenseDelta >= 0
                              ? "+"
                              : "−"}
                            {currency(
                              Math.abs(yearlySavingsDecomposition.expenseDelta),
                            )}
                          </p>
                          <p className="text-xs text-slate-600">
                            (positive means you spent more)
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-slate-600">
                          Contributions rank by impact on net delta (income up
                          helps, spend up hurts).
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            downloadCsv(
                              `reports-yearly-${year}-savings-decomposition.csv`,
                              yearlySavingsDecomposition.contributions.map(
                                (row) => ({
                                  kind: row.kind,
                                  name: row.name,
                                  contribution: row.contribution,
                                }),
                              ),
                            );
                          }}
                          disabled={
                            !yearlySavingsDecomposition.contributions.length
                          }
                        >
                          Export
                        </Button>
                      </div>

                      <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-100 bg-white">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Driver</TableHead>
                              <TableHead className="hidden md:table-cell">
                                Type
                              </TableHead>
                              <TableHead className="text-right">
                                Contribution
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {yearlySavingsDecomposition.contributions.map(
                              (row) => (
                                <TableRow
                                  key={`${row.kind}-${row.name}`}
                                  className={
                                    row.id ? "cursor-pointer" : undefined
                                  }
                                  onClick={() => {
                                    if (!row.id) return;
                                    setYearlyExtraDialog(null);
                                    setSelectedCategoryFlow(
                                      row.kind === "income"
                                        ? "income"
                                        : "expense",
                                    );
                                    setSelectedCategoryId(row.id);
                                  }}
                                >
                                  <TableCell className="max-w-[260px] truncate font-medium">
                                    {row.name}
                                  </TableCell>
                                  <TableCell className="hidden text-xs text-slate-600 md:table-cell">
                                    {row.kind === "income"
                                      ? "Income category"
                                      : "Expense category"}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    <span
                                      className={
                                        row.contribution >= 0
                                          ? "text-emerald-700"
                                          : "text-rose-700"
                                      }
                                    >
                                      {row.contribution >= 0 ? "+" : "−"}
                                      {currency(Math.abs(row.contribution))}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ),
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog
            open={detailDialogOpen}
            onOpenChange={(open) => {
              setDetailDialogOpen(open);
              if (!open) setDetailDialog(null);
            }}
          >
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{detailDialog?.title ?? "Details"}</DialogTitle>
              </DialogHeader>
              {!detailDialog ? null : detailDialog.kind === "investments" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          As of
                        </p>
                        <p className="font-semibold text-slate-900">
                          {new Date(detailDialog.asOf).toLocaleDateString(
                            "sv-SE",
                          )}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Value
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(detailDialog.summary.end)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {detailDialog.summary.change >= 0 ? "+" : "−"}
                          {currency(Math.abs(detailDialog.summary.change))}{" "}
                          {detailDialog.summary.changePct !== null
                            ? `(${percent(detailDialog.summary.changePct)})`
                            : ""}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Contributions
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(detailDialog.summary.contributions)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Withdrawals
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(detailDialog.summary.withdrawals)}
                        </p>
                      </div>
                    </div>
                    <div className="h-60 rounded-md border border-slate-100 bg-white p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={detailDialog.monthly}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            formatter={(value) => currency(Number(value))}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#4f46e5"
                            fill="rgba(79,70,229,0.15)"
                            strokeWidth={2}
                            name="Portfolio"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                      <p className="font-semibold">What this means</p>
                      <p className="text-xs text-slate-600">
                        Investments are tracked via snapshots, so they should
                        not appear as an expense category.
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100">
                      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                        Accounts
                      </div>
                      <div className="max-h-[22rem] overflow-auto">
                        {detailDialog.accounts.length ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Account</TableHead>
                                <TableHead className="text-right">
                                  Start
                                </TableHead>
                                <TableHead className="text-right">
                                  End
                                </TableHead>
                                <TableHead className="text-right">
                                  Change
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {detailDialog.accounts.map((row) => (
                                <TableRow key={row.name}>
                                  <TableCell className="max-w-[200px] truncate font-medium">
                                    {row.name}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {currency(row.start)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {currency(row.end)}
                                  </TableCell>
                                  <TableCell className="text-right text-xs">
                                    <span
                                      className={
                                        row.change >= 0
                                          ? "text-emerald-700"
                                          : "text-rose-700"
                                      }
                                    >
                                      {row.change >= 0 ? "+" : "−"}
                                      {currency(Math.abs(row.change))}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="p-3 text-sm text-slate-500">
                            No investment accounts available.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : detailDialog.kind === "debt" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Start
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(detailDialog.startDebt)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          End
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(detailDialog.endDebt)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3 sm:col-span-2">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Change
                        </p>
                        <p className="font-semibold text-slate-900">
                          {detailDialog.delta >= 0 ? "+" : "−"}
                          {currency(Math.abs(detailDialog.delta))}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                      A negative change means you paid down debt during the
                      year.
                    </div>
                  </div>
                  <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={detailDialog.monthly}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#f97316"
                          strokeWidth={2}
                          dot={false}
                          name="Debt"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : detailDialog.kind === "account" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      { label: "Start", value: detailDialog.startBalance },
                      { label: "End", value: detailDialog.endBalance },
                      { label: "Change", value: detailDialog.change },
                      {
                        label: "Type",
                        value: detailDialog.accountType,
                        text: true,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-md border border-slate-100 bg-slate-50 p-3"
                      >
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          {item.label}
                        </p>
                        <p className="font-semibold text-slate-900">
                          {"text" in item && item.text
                            ? String(item.value)
                            : currency(Number(item.value))}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={detailDialog.monthly.map((m) => ({
                            ...m,
                            expenseNeg: -m.expense,
                            transfersOutNeg: -m.transfersOut,
                          }))}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            formatter={(value) => currency(Number(value))}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Bar
                            dataKey="income"
                            name="Income"
                            fill="#10b981"
                            radius={[4, 4, 4, 4]}
                          />
                          <Bar
                            dataKey="expenseNeg"
                            name="Expense"
                            fill="#ef4444"
                            radius={[4, 4, 4, 4]}
                          />
                          <Bar
                            dataKey="transfersIn"
                            name="Transfers in"
                            fill="#0ea5e9"
                            radius={[4, 4, 4, 4]}
                          />
                          <Bar
                            dataKey="transfersOutNeg"
                            name="Transfers out"
                            fill="#a855f7"
                            radius={[4, 4, 4, 4]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={detailDialog.monthly}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="month"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            formatter={(value) => currency(Number(value))}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="change"
                            name="Monthly change"
                            stroke="#334155"
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              ) : detailDialog.kind === "source" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        {detailDialog.subtitle}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {currency(detailDialog.total)}
                      </p>
                      <p className="text-xs text-slate-600">
                        {detailDialog.txCount} transactions
                      </p>
                      {typeof detailDialog.compareTotal === "number" ? (
                        <p className="pt-1 text-xs text-slate-600">
                          {detailDialog.compareLabel ?? "Last year"}:{" "}
                          {currency(detailDialog.compareTotal)}{" "}
                          <span
                            className={
                              detailDialog.total - detailDialog.compareTotal >=
                              0
                                ? "font-semibold text-emerald-700"
                                : "font-semibold text-rose-700"
                            }
                          >
                            (
                            {detailDialog.total - detailDialog.compareTotal >= 0
                              ? "+"
                              : "−"}
                            {currency(
                              Math.abs(
                                detailDialog.total - detailDialog.compareTotal,
                              ),
                            )}
                            )
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                      This is grouped by transaction description (good for
                      spotting recurring sources and merchants).
                    </div>
                  </div>
                  <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={detailDialog.monthly.map((row, idx) => ({
                          month: row.month,
                          current: row.total,
                          compare:
                            detailDialog.compareMonthly?.[idx]?.total ?? null,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar
                          dataKey="current"
                          name={detailDialog.subtitle}
                          fill="#334155"
                          radius={[6, 6, 4, 4]}
                        />
                        {detailDialog.compareMonthly?.length ? (
                          <Bar
                            dataKey="compare"
                            name={detailDialog.compareLabel ?? "Last year"}
                            fill="#94a3b8"
                            radius={[6, 6, 4, 4]}
                          />
                        ) : null}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog
            open={Boolean(selectedCategoryId)}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedCategoryId(null);
                setSelectedCategoryFlow("expense");
                setCategoryDetail(null);
              }
            }}
          >
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>
                  {categoryDetail?.category_name || "Category"}
                </DialogTitle>
              </DialogHeader>
              {categoryDetailLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : categoryDetail ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={categoryDetail.monthly.map((m, idx) => ({
                          month: monthLabel(m.date),
                          amount: Number(m.amount),
                          prevAmount:
                            categoryDetailPrevMonthly?.[idx] ?? undefined,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis hide />
                        <Tooltip
                          formatter={(value, name) => [
                            currency(Number(value)),
                            String(name),
                          ]}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar
                          dataKey="amount"
                          name={String(year)}
                          fill={
                            selectedCategoryFlow === "income"
                              ? "#10b981"
                              : "#ef4444"
                          }
                          radius={[6, 6, 6, 6]}
                        />
                        {categoryDetailPrevMonthly ? (
                          <Bar
                            dataKey="prevAmount"
                            name={String(year - 1)}
                            fill="#94a3b8"
                            radius={[6, 6, 6, 6]}
                          />
                        ) : null}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="max-h-64 overflow-auto">
                    <p className="mb-2 text-xs font-semibold text-slate-700 uppercase">
                      Top merchants
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Merchant</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Tx</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categoryDetail.top_merchants.map((row) => (
                          <TableRow key={row.merchant}>
                            <TableCell className="max-w-[180px] truncate font-medium">
                              {row.merchant}
                            </TableCell>
                            <TableCell className="text-right">
                              {currency(Number(row.amount))}
                            </TableCell>
                            <TableCell className="text-right text-xs text-slate-600">
                              {row.transaction_count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No details available.</p>
              )}
            </DialogContent>
          </Dialog>
        </>
      ) : (
        <>
          <div className="grid gap-3">
            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Net Worth
                  </CardTitle>
                  <p className="text-xs text-slate-500">Trajectory over time</p>
                </div>
              </CardHeader>
              <CardContent className="h-80 md:h-96">
                {totalOverviewLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : !totalNetWorthTrajectoryData.length ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-600">
                    <p>No net worth history yet.</p>
                  </div>
                ) : (
                  <ChartContainer
                    className="h-full w-full"
                    config={{
                      net: {
                        label: "Net worth",
                        color: "#4f46e5",
                      },
                    }}
                  >
                    <AreaChart
                      data={totalNetWorthTrajectoryData}
                      margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="netFillTotalTrajectory"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#4f46e5"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#4f46e5"
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
                        domain={totalNetWorthTrajectoryDomain}
                        allowDataOverflow
                        tickMargin={12}
                        width={90}
                        tickFormatter={(v) => compactCurrency(Number(v))}
                      />
                      <Tooltip content={<ChartTooltipContent />} />
                      {Array.from(
                        new Set(totalNetWorthTrajectoryData.map((d) => d.year)),
                      ).map((year) => {
                        const firstPoint = totalNetWorthTrajectoryData.find(
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
                        dataKey="net"
                        stroke="#4f46e5"
                        fill="url(#netFillTotalTrajectory)"
                        strokeWidth={2}
                        name="Net worth"
                      />
                    </AreaChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-3 lg:grid-cols-2">
              <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Net worth breakdown
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      Cash + investments − debt (monthly).
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      openTotalDrilldownDialog({ kind: "netWorth" })
                    }
                  >
                    Details
                  </Button>
                </CardHeader>
                <CardContent className="h-80">
                  {totalOverviewLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : !totalNetWorthBreakdownSeries.length ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-600">
                      No net worth components yet.
                    </div>
                  ) : (
                    <ChartContainer
                      className="h-full w-full"
                      config={{
                        cash: { label: "Cash", color: "#0f172a" },
                        investments: { label: "Investments", color: "#4f46e5" },
                        debtNeg: { label: "Debt", color: "#f97316" },
                      }}
                    >
                      <AreaChart
                        data={totalNetWorthBreakdownSeries}
                        margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
                        onClick={(
                          state:
                            | {
                                activePayload?: Array<{ payload?: unknown }>;
                              }
                            | null
                            | undefined,
                        ) => {
                          const payload =
                            state?.activePayload?.[0]?.payload ?? null;
                          if (!isRecord(payload)) return;
                          const date =
                            typeof payload.date === "string"
                              ? payload.date
                              : null;
                          if (!date) return;
                          const idx = totalNetWorthBreakdownSeries.findIndex(
                            (row) => row.date === date,
                          );
                          if (idx < 0) return;
                          const row = totalNetWorthBreakdownSeries[idx];
                          const prev =
                            idx > 0
                              ? totalNetWorthBreakdownSeries[idx - 1]
                              : null;
                          const deltaMoM = prev
                            ? row.netWorth - prev.netWorth
                            : null;
                          const target = new Date(date);
                          target.setUTCFullYear(target.getUTCFullYear() - 1);
                          const targetIso = target.toISOString().slice(0, 10);
                          let yearAgo:
                            | (typeof totalNetWorthBreakdownSeries)[number]
                            | null = null;
                          for (let i = idx; i >= 0; i -= 1) {
                            const candidate = totalNetWorthBreakdownSeries[i];
                            if (candidate.date <= targetIso) {
                              yearAgo = candidate;
                              break;
                            }
                          }
                          const deltaYoY = yearAgo
                            ? row.netWorth - yearAgo.netWorth
                            : null;
                          const assets = row.cash + row.investments;
                          openTotalTimeseriesDialog({
                            kind: "netWorthBreakdown",
                            date,
                            cash: row.cash,
                            investments: row.investments,
                            debt: row.debt,
                            netWorth: row.netWorth,
                            deltaMoM,
                            deltaYoY,
                            shareCashPct:
                              assets > 0 ? (row.cash / assets) * 100 : null,
                            shareInvestmentsPct:
                              assets > 0
                                ? (row.investments / assets) * 100
                                : null,
                            shareDebtPct:
                              assets > 0 ? (row.debt / assets) * 100 : null,
                          });
                        }}
                      >
                        <defs>
                          <linearGradient
                            id="cashFillTotalBreakdown"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#0f172a"
                              stopOpacity={0.2}
                            />
                            <stop
                              offset="95%"
                              stopColor="#0f172a"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="invFillTotalBreakdown"
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
                          <linearGradient
                            id="debtFillTotalBreakdown"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#f97316"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="95%"
                              stopColor="#f97316"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          domain={totalNetWorthBreakdownDomain}
                          allowDataOverflow
                          tickMargin={12}
                          width={90}
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <ReferenceLine y={0} stroke="#cbd5e1" />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload[0]?.payload;
                            if (!isRecord(row)) return null;
                            const date = String(row.date ?? "");
                            const label = date
                              ? new Date(date).toLocaleDateString("sv-SE", {
                                  year: "numeric",
                                  month: "long",
                                })
                              : "Month";
                            const cash = Number(row.cash ?? 0);
                            const inv = Number(row.investments ?? 0);
                            const debt = Number(row.debt ?? 0);
                            const net = Number(row.netWorth ?? 0);
                            return (
                              <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                                <p className="font-semibold text-slate-800">
                                  {label}
                                </p>
                                <div className="mt-1 space-y-0.5 text-slate-700">
                                  <p>Net worth: {currency(net)}</p>
                                  <p>Cash: {currency(cash)}</p>
                                  <p>Investments: {currency(inv)}</p>
                                  <p>Debt: {currency(debt)}</p>
                                </div>
                                <p className="mt-2 text-[11px] text-slate-500">
                                  Click for details
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Area
                          type="monotoneX"
                          dataKey="cash"
                          stackId="assets"
                          stroke="#0f172a"
                          fill="url(#cashFillTotalBreakdown)"
                          strokeWidth={2}
                          name="Cash"
                        />
                        <Area
                          type="monotoneX"
                          dataKey="investments"
                          stackId="assets"
                          stroke="#4f46e5"
                          fill="url(#invFillTotalBreakdown)"
                          strokeWidth={2}
                          name="Investments"
                        />
                        <Area
                          type="monotoneX"
                          dataKey="debtNeg"
                          stackId="assets"
                          stroke="#f97316"
                          fill="url(#debtFillTotalBreakdown)"
                          strokeWidth={2}
                          name="Debt"
                        />
                      </AreaChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-base font-semibold text-slate-900">
                      Savings rate
                    </CardTitle>
                    <p className="text-xs text-slate-500">
                      Monthly vs rolling 12m (income − expense / income).
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="h-80">
                  {totalOverviewLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : !totalSavingsRateSeries.length ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-600">
                      No savings history yet.
                    </div>
                  ) : (
                    <div className="h-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={totalSavingsRateSeries}
                          onClick={(
                            state:
                              | {
                                  activePayload?: Array<{ payload?: unknown }>;
                                }
                              | null
                              | undefined,
                          ) => {
                            const payload =
                              state?.activePayload?.[0]?.payload ?? null;
                            if (!isRecord(payload)) return;
                            const date =
                              typeof payload.date === "string"
                                ? payload.date
                                : null;
                            if (!date) return;
                            const income = Number(payload.income ?? 0);
                            const expense = Number(payload.expense ?? 0);
                            const net = Number(payload.net ?? income - expense);
                            const ratePct =
                              typeof payload.ratePct === "number"
                                ? Number(payload.ratePct)
                                : null;
                            const rolling12mPct =
                              typeof payload.rolling12mPct === "number"
                                ? Number(payload.rolling12mPct)
                                : null;
                            const idx =
                              typeof payload.index === "number"
                                ? Number(payload.index)
                                : null;
                            if (idx === null) return;
                            const window = totalSavingsRateSeriesAll
                              .slice(Math.max(0, idx - 11), idx + 1)
                              .map((row) => ({
                                date: row.date,
                                label: row.label,
                                income: row.income,
                                expense: row.expense,
                                net: row.net,
                                ratePct: row.ratePct,
                              }));
                            openTotalTimeseriesDialog({
                              kind: "savingsRate",
                              date,
                              income,
                              expense,
                              net,
                              ratePct,
                              rolling12mPct,
                              window,
                            });
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
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
                            domain={totalSavingsRateDomain}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => `${Number(v)}%`}
                          />
                          <ReferenceLine y={0} stroke="#cbd5e1" />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const row = payload[0]?.payload;
                              if (!isRecord(row)) return null;
                              const date = String(row.date ?? "");
                              const label = date
                                ? new Date(date).toLocaleDateString("sv-SE", {
                                    year: "numeric",
                                    month: "long",
                                  })
                                : "Month";
                              const income = Number(row.income ?? 0);
                              const expense = Number(row.expense ?? 0);
                              const net = Number(row.net ?? income - expense);
                              const rate =
                                typeof row.ratePct === "number"
                                  ? Number(row.ratePct)
                                  : null;
                              const rolling =
                                typeof row.rolling12mPct === "number"
                                  ? Number(row.rolling12mPct)
                                  : null;
                              return (
                                <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                                  <p className="font-semibold text-slate-800">
                                    {label}
                                  </p>
                                  <div className="mt-1 space-y-0.5 text-slate-700">
                                    <p>
                                      Savings rate:{" "}
                                      {rate === null
                                        ? "—"
                                        : `${rate.toFixed(1)}%`}
                                    </p>
                                    <p>
                                      Rolling 12m:{" "}
                                      {rolling === null
                                        ? "—"
                                        : `${rolling.toFixed(1)}%`}
                                    </p>
                                    <p>Income: {currency(income)}</p>
                                    <p>Expense: {currency(expense)}</p>
                                    <p>Net: {currency(net)}</p>
                                  </div>
                                  <p className="mt-2 text-[11px] text-slate-500">
                                    Click for details
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="rolling12mPct"
                            stroke="#4f46e5"
                            strokeWidth={2}
                            dot={false}
                            name="Rolling 12m"
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="ratePct"
                            stroke="#0f172a"
                            strokeWidth={2}
                            dot={false}
                            name="Monthly"
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Composition over time
                  </CardTitle>
                  <p className="text-xs text-slate-500">
                    100% stacked by year for the biggest categories.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="h-80">
                {totalOverviewLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : !totalExpenseComposition && !totalIncomeComposition ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-600">
                    No composition data yet.
                  </div>
                ) : (
                  <Tabs defaultValue="expense" className="flex h-full flex-col">
                    <TabsList className="self-start">
                      <TabsTrigger value="expense">Expenses</TabsTrigger>
                      <TabsTrigger value="income">Income</TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="expense"
                      className="mt-2 min-h-0 flex-1"
                    >
                      {!totalExpenseComposition ? (
                        <div className="flex h-full items-center justify-center text-sm text-slate-600">
                          No expense mix yet.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={totalExpenseComposition.data}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="year"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#475569", fontSize: 12 }}
                            />
                            <YAxis
                              domain={[0, 100]}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#475569", fontSize: 12 }}
                              tickFormatter={(v) => `${Number(v)}%`}
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const year = Number(label);
                                const total =
                                  totalExpenseComposition.totalsByYear[year] ??
                                  0;
                                return (
                                  <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                                    <p className="font-semibold text-slate-800">
                                      {year}
                                    </p>
                                    <p className="text-slate-600">
                                      Total: {currency(total)}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                      {payload
                                        .slice()
                                        .reverse()
                                        .map((p) => {
                                          const name = String(p.name ?? "");
                                          const pct = Number(p.value ?? 0);
                                          const amount =
                                            totalExpenseComposition
                                              .amountByYear[year]?.[name] ?? 0;
                                          return (
                                            <div
                                              key={name}
                                              className="flex items-center justify-between gap-3"
                                            >
                                              <span className="text-slate-700">
                                                {name}
                                              </span>
                                              <span className="text-slate-600">
                                                {pct.toFixed(0)}% •{" "}
                                                {currency(amount)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                    </div>
                                    <p className="mt-2 text-[11px] text-slate-500">
                                      Click a segment for details
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            {totalExpenseComposition.keys.map((key) => (
                              <Bar
                                key={key}
                                dataKey={key}
                                stackId="composition"
                                fill={totalExpenseComposition.colors[key]}
                                isAnimationActive={false}
                                onClick={(data: unknown) => {
                                  const payload = isRecord(data)
                                    ? (data.payload as unknown)
                                    : null;
                                  if (!isRecord(payload)) return;
                                  const year = Number(payload.year);
                                  if (!Number.isFinite(year)) return;
                                  const value =
                                    totalExpenseComposition.amountByYear[
                                      year
                                    ]?.[key] ?? 0;
                                  const totals =
                                    totalExpenseComposition.years.map(
                                      (yr) =>
                                        totalExpenseComposition.amountByYear[
                                          yr
                                        ]?.[key] ?? 0,
                                    );
                                  const max = Math.max(0, ...totals);
                                  const idx =
                                    totalExpenseComposition.years.indexOf(year);
                                  const prevValue =
                                    idx > 0 ? (totals[idx - 1] ?? 0) : null;
                                  const yoyDelta =
                                    prevValue === null
                                      ? null
                                      : value - prevValue;
                                  const yoyDeltaPct =
                                    prevValue === null || prevValue === 0
                                      ? null
                                      : ((value - prevValue) / prevValue) * 100;
                                  const yearTotal =
                                    totalExpenseComposition.totalsByYear[
                                      year
                                    ] ?? null;
                                  openTotalHeatmapDialog({
                                    kind: "categoryByYear",
                                    flow: "expense",
                                    year,
                                    categoryId:
                                      totalExpenseComposition.ids[key] ?? null,
                                    categoryName: key,
                                    color:
                                      totalExpenseComposition.colors[key] ??
                                      "#ef4444",
                                    value,
                                    years: totalExpenseComposition.years,
                                    totals,
                                    max,
                                    yearTotal,
                                    sharePct:
                                      typeof yearTotal === "number" &&
                                      yearTotal > 0
                                        ? (value / yearTotal) * 100
                                        : null,
                                    yoyDelta,
                                    yoyDeltaPct,
                                  });
                                }}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </TabsContent>
                    <TabsContent value="income" className="mt-2 min-h-0 flex-1">
                      {!totalIncomeComposition ? (
                        <div className="flex h-full items-center justify-center text-sm text-slate-600">
                          No income mix yet.
                        </div>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={totalIncomeComposition.data}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="year"
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#475569", fontSize: 12 }}
                            />
                            <YAxis
                              domain={[0, 100]}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fill: "#475569", fontSize: 12 }}
                              tickFormatter={(v) => `${Number(v)}%`}
                            />
                            <Tooltip
                              content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null;
                                const year = Number(label);
                                const total =
                                  totalIncomeComposition.totalsByYear[year] ??
                                  0;
                                return (
                                  <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                                    <p className="font-semibold text-slate-800">
                                      {year}
                                    </p>
                                    <p className="text-slate-600">
                                      Total: {currency(total)}
                                    </p>
                                    <div className="mt-2 space-y-1">
                                      {payload
                                        .slice()
                                        .reverse()
                                        .map((p) => {
                                          const name = String(p.name ?? "");
                                          const pct = Number(p.value ?? 0);
                                          const amount =
                                            totalIncomeComposition.amountByYear[
                                              year
                                            ]?.[name] ?? 0;
                                          return (
                                            <div
                                              key={name}
                                              className="flex items-center justify-between gap-3"
                                            >
                                              <span className="text-slate-700">
                                                {name}
                                              </span>
                                              <span className="text-slate-600">
                                                {pct.toFixed(0)}% •{" "}
                                                {currency(amount)}
                                              </span>
                                            </div>
                                          );
                                        })}
                                    </div>
                                    <p className="mt-2 text-[11px] text-slate-500">
                                      Click a segment for details
                                    </p>
                                  </div>
                                );
                              }}
                            />
                            {totalIncomeComposition.keys.map((key) => (
                              <Bar
                                key={key}
                                dataKey={key}
                                stackId="composition"
                                fill={totalIncomeComposition.colors[key]}
                                isAnimationActive={false}
                                onClick={(data: unknown) => {
                                  const payload = isRecord(data)
                                    ? (data.payload as unknown)
                                    : null;
                                  if (!isRecord(payload)) return;
                                  const year = Number(payload.year);
                                  if (!Number.isFinite(year)) return;
                                  const value =
                                    totalIncomeComposition.amountByYear[year]?.[
                                      key
                                    ] ?? 0;
                                  const totals =
                                    totalIncomeComposition.years.map(
                                      (yr) =>
                                        totalIncomeComposition.amountByYear[
                                          yr
                                        ]?.[key] ?? 0,
                                    );
                                  const max = Math.max(0, ...totals);
                                  const idx =
                                    totalIncomeComposition.years.indexOf(year);
                                  const prevValue =
                                    idx > 0 ? (totals[idx - 1] ?? 0) : null;
                                  const yoyDelta =
                                    prevValue === null
                                      ? null
                                      : value - prevValue;
                                  const yoyDeltaPct =
                                    prevValue === null || prevValue === 0
                                      ? null
                                      : ((value - prevValue) / prevValue) * 100;
                                  const yearTotal =
                                    totalIncomeComposition.totalsByYear[year] ??
                                    null;
                                  openTotalHeatmapDialog({
                                    kind: "categoryByYear",
                                    flow: "income",
                                    year,
                                    categoryId:
                                      totalIncomeComposition.ids[key] ?? null,
                                    categoryName: key,
                                    color:
                                      totalIncomeComposition.colors[key] ??
                                      "#10b981",
                                    value,
                                    years: totalIncomeComposition.years,
                                    totals,
                                    max,
                                    yearTotal,
                                    sharePct:
                                      typeof yearTotal === "number" &&
                                      yearTotal > 0
                                        ? (value / yearTotal) * 100
                                        : null,
                                    yoyDelta,
                                    yoyDeltaPct,
                                  });
                                }}
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </TabsContent>
                  </Tabs>
                )}
              </CardContent>
            </Card>

            <ChartCard
              title="Net worth growth"
              description={
                totalWindowPreset === "all"
                  ? "Monthly net worth snapshot (ledger + investments)."
                  : `Monthly net worth snapshot (last ${totalWindowPreset} years).`
              }
              loading={totalOverviewLoading}
              contentClassName="h-[26rem]"
            >
              {!totalOverview && !totalOverviewLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-600">
                  <Sparkles className="h-6 w-6 text-slate-500" />
                  <p className="text-center">
                    No data yet. Import files or add transactions.
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
              ) : !totalNetWorthSeries.length ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-600">
                  <p>No net worth history yet.</p>
                </div>
              ) : (
                <div className="flex h-full flex-col gap-3">
                  {totalNetWorthStats ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        className="rounded-md border border-slate-100 bg-slate-50 p-3 text-left"
                        onClick={() =>
                          openTotalDrilldownDialog({ kind: "netWorth" })
                        }
                      >
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Current (as of{" "}
                          {new Date(totalNetWorthStats.asOf).toLocaleDateString(
                            "sv-SE",
                          )}
                          )
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(totalNetWorthStats.current)}
                        </p>
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-100 bg-slate-50 p-3 text-left"
                        onClick={() =>
                          openTotalDrilldownDialog({ kind: "netWorth" })
                        }
                      >
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Change (12m)
                        </p>
                        <p className="font-semibold text-slate-900">
                          {totalNetWorthStats.delta12m === null ? (
                            "—"
                          ) : (
                            <>
                              <span
                                className={
                                  totalNetWorthStats.delta12m >= 0
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }
                              >
                                {totalNetWorthStats.delta12m >= 0 ? "+" : "−"}
                                {currency(
                                  Math.abs(totalNetWorthStats.delta12m),
                                )}
                              </span>
                              {totalNetWorthStats.delta12mPct ===
                              null ? null : (
                                <span className="ml-2 text-xs text-slate-600">
                                  ({percent(totalNetWorthStats.delta12mPct)})
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-100 bg-slate-50 p-3 text-left"
                        onClick={() =>
                          openTotalDrilldownDialog({ kind: "netWorth" })
                        }
                      >
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Change (since start)
                        </p>
                        <p className="font-semibold text-slate-900">
                          <span
                            className={
                              totalNetWorthStats.deltaSinceStart >= 0
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }
                          >
                            {totalNetWorthStats.deltaSinceStart >= 0
                              ? "+"
                              : "−"}
                            {currency(
                              Math.abs(totalNetWorthStats.deltaSinceStart),
                            )}
                          </span>
                          {totalNetWorthStats.deltaSinceStartPct ===
                          null ? null : (
                            <span className="ml-2 text-xs text-slate-600">
                              ({percent(totalNetWorthStats.deltaSinceStartPct)})
                            </span>
                          )}
                        </p>
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-slate-100 bg-slate-50 p-3 text-left"
                        onClick={() =>
                          openTotalDrilldownDialog({ kind: "netWorth" })
                        }
                      >
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Range
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(totalNetWorthStats.allTimeLow)} →{" "}
                          {currency(totalNetWorthStats.allTimeHigh)}
                        </p>
                        <p className="text-xs text-slate-600">
                          High:{" "}
                          {new Date(
                            totalNetWorthStats.allTimeHighDate,
                          ).toLocaleDateString("sv-SE")}
                        </p>
                      </button>
                    </div>
                  ) : null}

                  {totalNetWorthAttribution ? (
                    <button
                      type="button"
                      className="rounded-md border border-slate-100 bg-white p-3 text-left"
                      onClick={() =>
                        openTotalDrilldownDialog({ kind: "netWorth" })
                      }
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                            Change Attribution
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(
                              totalNetWorthAttribution.windowStart,
                            ).getFullYear()}
                            –
                            {new Date(
                              totalNetWorthAttribution.windowEnd,
                            ).getFullYear()}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {totalNetWorthAttribution.netWorthDelta >= 0
                            ? "+"
                            : "−"}
                          {currency(
                            Math.abs(totalNetWorthAttribution.netWorthDelta),
                          )}
                        </p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(
                          [
                            {
                              label: "Savings (income − expense)",
                              value: totalNetWorthAttribution.savings,
                              color: "bg-emerald-500",
                            },
                            totalNetWorthAttribution.investmentsContribution ===
                            null
                              ? null
                              : {
                                  label: "Investments change",
                                  value:
                                    totalNetWorthAttribution.investmentsContribution,
                                  color: "bg-indigo-500",
                                },
                            {
                              label: "Debt change",
                              value: totalNetWorthAttribution.debtContribution,
                              color: "bg-orange-500",
                            },
                            {
                              label: "Remainder",
                              value: totalNetWorthAttribution.remainder,
                              color: "bg-slate-400",
                            },
                          ] as Array<null | {
                            label: string;
                            value: number;
                            color: string;
                          }>
                        )
                          .filter(Boolean)
                          .map((row) => {
                            if (!row) return null;
                            const total = Math.max(
                              1,
                              Math.abs(totalNetWorthAttribution.netWorthDelta),
                            );
                            const pct = (Math.abs(row.value) / total) * 100;
                            return (
                              <div key={row.label} className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                  <span>{row.label}</span>
                                  <span
                                    className={
                                      row.value >= 0
                                        ? "font-medium text-emerald-700"
                                        : "font-medium text-rose-700"
                                    }
                                  >
                                    {row.value >= 0 ? "+" : "−"}
                                    {currency(Math.abs(row.value))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={Math.min(100, pct)}
                                    className="h-2"
                                  />
                                  <span className="w-10 text-right text-[11px] text-slate-500">
                                    {percent(pct)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </button>
                  ) : null}
                </div>
              )}
            </ChartCard>

            <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Year-by-year performance
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Income vs expense per year. Click a year for details.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <>
                    <div className="h-56 rounded-md border border-slate-100 bg-white p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={totalYearly}
                          onClick={(
                            state:
                              | {
                                  activePayload?: Array<{
                                    payload?: { year?: unknown };
                                  }>;
                                }
                              | null
                              | undefined,
                          ) => {
                            const clickedYear =
                              state?.activePayload?.[0]?.payload?.year;
                            if (typeof clickedYear === "number") {
                              openTotalDrilldownDialog({
                                kind: "year",
                                year: clickedYear,
                              });
                            }
                          }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="year"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const yearLabel = payload[0]?.payload?.year;
                              const income = Number(
                                payload[0]?.payload?.income ?? 0,
                              );
                              const expense = Number(
                                payload[0]?.payload?.expense ?? 0,
                              );
                              const net = Number(payload[0]?.payload?.net ?? 0);
                              return (
                                <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                                  <p className="font-semibold text-slate-800">
                                    {yearLabel}
                                  </p>
                                  <p className="text-slate-600">
                                    Income: {currency(income)}
                                  </p>
                                  <p className="text-slate-600">
                                    Expense: {currency(expense)}
                                  </p>
                                  <p className="text-slate-600">
                                    Net: {currency(net)}
                                  </p>
                                </div>
                              );
                            }}
                          />
                          <Bar
                            dataKey="income"
                            name="Income"
                            fill="#10b981"
                            radius={[6, 6, 4, 4]}
                            barSize={12}
                          />
                          <Bar
                            dataKey="expense"
                            name="Expense"
                            fill="#ef4444"
                            radius={[6, 6, 4, 4]}
                            barSize={12}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="max-h-56 overflow-auto rounded-md border border-slate-100 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Year</TableHead>
                            <TableHead className="text-right">Income</TableHead>
                            <TableHead className="text-right">
                              Expense
                            </TableHead>
                            <TableHead className="text-right">Net</TableHead>
                            <TableHead className="hidden text-right md:table-cell">
                              Savings rate
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {totalYearlyTable.map((row) => (
                            <TableRow
                              key={row.year}
                              className="cursor-pointer"
                              onClick={() =>
                                openTotalDrilldownDialog({
                                  kind: "year",
                                  year: row.year,
                                })
                              }
                            >
                              <TableCell className="font-medium">
                                {row.year}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-emerald-700">
                                {currency(row.income)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-rose-700">
                                {currency(row.expense)}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                <span
                                  className={
                                    row.net >= 0
                                      ? "text-emerald-700"
                                      : "text-rose-700"
                                  }
                                >
                                  {row.net >= 0 ? "+" : "−"}
                                  {currency(Math.abs(row.net))}
                                </span>
                              </TableCell>
                              <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                                {row.savingsRate === null
                                  ? "—"
                                  : percent(row.savingsRate)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                      {totalOverview.best_year ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3 py-1"
                          onClick={() =>
                            openTotalDrilldownDialog({
                              kind: "year",
                              year: totalOverview.best_year ?? 0,
                            })
                          }
                        >
                          Best: {totalOverview.best_year}
                        </button>
                      ) : null}
                      {totalOverview.worst_year ? (
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 bg-white px-3 py-1"
                          onClick={() =>
                            openTotalDrilldownDialog({
                              kind: "year",
                              year: totalOverview.worst_year ?? 0,
                            })
                          }
                        >
                          Worst: {totalOverview.worst_year}
                        </button>
                      ) : null}
                      {totalKpis?.lifetimeSavingsRate != null ? (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                          Lifetime savings rate:{" "}
                          {percent(totalKpis?.lifetimeSavingsRate ?? 0)}
                        </span>
                      ) : null}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <MoneyFlowSankeyCard
            title="Lifetime money flow"
            description="Income categories flowing into expenses and savings."
            incomeCategories={totalIncomeCategoriesLifetime}
            expenseCategories={totalExpenseCategoriesLifetime}
            loading={totalOverviewLoading}
          />

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Income seasonality (year × month)
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Total income per month (all categories combined).
                </p>
              </CardHeader>
              <CardContent className="overflow-auto">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : !totalSeasonalityHeatmaps ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No seasonality data yet.
                  </div>
                ) : (
                  <div
                    className="min-w-[560px] space-y-3"
                    onMouseLeave={() => setTotalSeasonalityHover(null)}
                  >
                    <div className="grid grid-cols-[72px_repeat(12,minmax(28px,1fr))] gap-1 text-[11px] text-slate-600">
                      <div />
                      {totalSeasonalityHeatmaps.months.map((label) => (
                        <div key={label} className="text-center">
                          {label}
                        </div>
                      ))}
                      {totalSeasonalityHeatmaps.years.map((yr, yrIdx) => (
                        <React.Fragment key={yr}>
                          <div className="pr-2 font-medium text-slate-700">
                            {yr}
                          </div>
                          {totalSeasonalityHeatmaps.income[yrIdx].map(
                            (value, idx) => (
                              <button
                                type="button"
                                key={`${yr}-${idx}`}
                                title={`${yr} ${totalSeasonalityHeatmaps.months[idx]}: ${currency(value)}`}
                                aria-label={`${yr} ${totalSeasonalityHeatmaps.months[idx]} income ${currency(value)}`}
                                className="h-7 rounded-sm border border-slate-100 transition hover:ring-1 hover:ring-slate-300 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                                style={{
                                  backgroundColor: heatColor(
                                    "16,185,129",
                                    value,
                                    totalSeasonalityHeatmaps.maxIncome,
                                  ),
                                }}
                                onMouseEnter={() =>
                                  setTotalSeasonalityHover({
                                    flow: "income",
                                    year: yr,
                                    monthIndex: idx,
                                    value,
                                  })
                                }
                                onFocus={() =>
                                  setTotalSeasonalityHover({
                                    flow: "income",
                                    year: yr,
                                    monthIndex: idx,
                                    value,
                                  })
                                }
                                onClick={() => {
                                  const yearValues =
                                    totalSeasonalityHeatmaps.income[yrIdx];
                                  const yearTotal = yearValues.reduce(
                                    (sum, v) => sum + v,
                                    0,
                                  );
                                  const monthAcrossYears =
                                    totalSeasonalityHeatmaps.years.map(
                                      (year, yearIdx) => ({
                                        year,
                                        value:
                                          totalSeasonalityHeatmaps.income[
                                            yearIdx
                                          ][idx] ?? 0,
                                      }),
                                    );
                                  const prevValue =
                                    yrIdx > 0
                                      ? (totalSeasonalityHeatmaps.income[
                                          yrIdx - 1
                                        ][idx] ?? 0)
                                      : null;
                                  const yoyDelta =
                                    prevValue === null
                                      ? null
                                      : value - prevValue;
                                  const yoyDeltaPct =
                                    prevValue === null || prevValue === 0
                                      ? null
                                      : ((value - prevValue) / prevValue) * 100;
                                  const monthRank =
                                    1 +
                                    yearValues.filter((v) => v > value).length;
                                  const monthSharePct =
                                    yearTotal > 0
                                      ? (value / yearTotal) * 100
                                      : null;
                                  openTotalHeatmapDialog({
                                    kind: "seasonality",
                                    flow: "income",
                                    year: yr,
                                    monthIndex: idx,
                                    monthLabel:
                                      totalSeasonalityHeatmaps.months[idx],
                                    value,
                                    yearValues,
                                    years: totalSeasonalityHeatmaps.years,
                                    monthAcrossYears,
                                    yearTotal,
                                    monthRank,
                                    monthSharePct,
                                    yoyDelta,
                                    yoyDeltaPct,
                                  });
                                }}
                              />
                            ),
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>
                        {totalSeasonalityHover?.flow === "income"
                          ? `${totalSeasonalityHover.year} ${totalSeasonalityHeatmaps.months[totalSeasonalityHover.monthIndex]}: ${currency(totalSeasonalityHover.value)}`
                          : "Hover a cell to see the value."}
                      </span>
                      <span className="text-slate-500">
                        Click a cell for details
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Expense seasonality (year × month)
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Total expense per month (all categories combined).
                </p>
              </CardHeader>
              <CardContent className="overflow-auto">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : !totalSeasonalityHeatmaps ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No seasonality data yet.
                  </div>
                ) : (
                  <div
                    className="min-w-[560px] space-y-3"
                    onMouseLeave={() => setTotalSeasonalityHover(null)}
                  >
                    <div className="grid grid-cols-[72px_repeat(12,minmax(28px,1fr))] gap-1 text-[11px] text-slate-600">
                      <div />
                      {totalSeasonalityHeatmaps.months.map((label) => (
                        <div key={label} className="text-center">
                          {label}
                        </div>
                      ))}
                      {totalSeasonalityHeatmaps.years.map((yr, yrIdx) => (
                        <React.Fragment key={yr}>
                          <div className="pr-2 font-medium text-slate-700">
                            {yr}
                          </div>
                          {totalSeasonalityHeatmaps.expense[yrIdx].map(
                            (value, idx) => (
                              <button
                                type="button"
                                key={`${yr}-${idx}`}
                                title={`${yr} ${totalSeasonalityHeatmaps.months[idx]}: ${currency(value)}`}
                                aria-label={`${yr} ${totalSeasonalityHeatmaps.months[idx]} expense ${currency(value)}`}
                                className="h-7 rounded-sm border border-slate-100 transition hover:ring-1 hover:ring-slate-300 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                                style={{
                                  backgroundColor: heatColor(
                                    "239,68,68",
                                    value,
                                    totalSeasonalityHeatmaps.maxExpense,
                                  ),
                                }}
                                onMouseEnter={() =>
                                  setTotalSeasonalityHover({
                                    flow: "expense",
                                    year: yr,
                                    monthIndex: idx,
                                    value,
                                  })
                                }
                                onFocus={() =>
                                  setTotalSeasonalityHover({
                                    flow: "expense",
                                    year: yr,
                                    monthIndex: idx,
                                    value,
                                  })
                                }
                                onClick={() => {
                                  const yearValues =
                                    totalSeasonalityHeatmaps.expense[yrIdx];
                                  const yearTotal = yearValues.reduce(
                                    (sum, v) => sum + v,
                                    0,
                                  );
                                  const monthAcrossYears =
                                    totalSeasonalityHeatmaps.years.map(
                                      (year, yearIdx) => ({
                                        year,
                                        value:
                                          totalSeasonalityHeatmaps.expense[
                                            yearIdx
                                          ][idx] ?? 0,
                                      }),
                                    );
                                  const prevValue =
                                    yrIdx > 0
                                      ? (totalSeasonalityHeatmaps.expense[
                                          yrIdx - 1
                                        ][idx] ?? 0)
                                      : null;
                                  const yoyDelta =
                                    prevValue === null
                                      ? null
                                      : value - prevValue;
                                  const yoyDeltaPct =
                                    prevValue === null || prevValue === 0
                                      ? null
                                      : ((value - prevValue) / prevValue) * 100;
                                  const monthRank =
                                    1 +
                                    yearValues.filter((v) => v > value).length;
                                  const monthSharePct =
                                    yearTotal > 0
                                      ? (value / yearTotal) * 100
                                      : null;
                                  openTotalHeatmapDialog({
                                    kind: "seasonality",
                                    flow: "expense",
                                    year: yr,
                                    monthIndex: idx,
                                    monthLabel:
                                      totalSeasonalityHeatmaps.months[idx],
                                    value,
                                    yearValues,
                                    years: totalSeasonalityHeatmaps.years,
                                    monthAcrossYears,
                                    yearTotal,
                                    monthRank,
                                    monthSharePct,
                                    yoyDelta,
                                    yoyDeltaPct,
                                  });
                                }}
                              />
                            ),
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>
                        {totalSeasonalityHover?.flow === "expense"
                          ? `${totalSeasonalityHover.year} ${totalSeasonalityHeatmaps.months[totalSeasonalityHover.monthIndex]}: ${currency(totalSeasonalityHover.value)}`
                          : "Hover a cell to see the value."}
                      </span>
                      <span className="text-slate-500">
                        Click a cell for details
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Expense categories by year
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Top categories (lifetime) across all years.
                </p>
              </CardHeader>
              <CardContent className="overflow-auto">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : !totalExpenseCategoryYearHeatmap ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No category history yet.
                  </div>
                ) : (
                  <div
                    className="grid gap-px text-[10px] text-slate-600"
                    style={{
                      gridTemplateColumns: `160px repeat(${totalExpenseCategoryYearHeatmap.years.length}, minmax(0, 1fr))`,
                    }}
                    onMouseLeave={() => setTotalCategoryYearHover(null)}
                  >
                    <div />
                    {totalExpenseCategoryYearHeatmap.years.map((yr) => (
                      <div
                        key={yr}
                        className="flex h-6 items-center justify-center overflow-hidden"
                        title={String(yr)}
                      >
                        <span className="text-[10px] leading-none text-slate-600">
                          {String(yr).slice(-2)}
                        </span>
                      </div>
                    ))}
                    {totalExpenseCategoryYearHeatmap.rows.map((row) => (
                      <React.Fragment key={row.name}>
                        <div
                          className={
                            row.categoryId
                              ? "cursor-pointer truncate pr-2 font-medium text-slate-700"
                              : "truncate pr-2 font-medium text-slate-700"
                          }
                          onClick={() => {
                            if (!row.categoryId) return;
                            openTotalDrilldownDialog({
                              kind: "category",
                              flow: "expense",
                              categoryId: row.categoryId,
                              name: row.name,
                              color: row.color ?? "#ef4444",
                            });
                          }}
                        >
                          {row.name}
                        </div>
                        {totalExpenseCategoryYearHeatmap.years.map(
                          (yr, idx) => {
                            const value = row.totals[idx] ?? 0;
                            const yearTotal = totalYearly.find(
                              (entry) => entry.year === yr,
                            )?.expense;
                            return (
                              <button
                                type="button"
                                key={`${row.name}-${yr}`}
                                title={`${row.name} • ${yr}: ${currency(value)}`}
                                aria-label={`${row.name} ${yr} expense ${currency(value)}`}
                                className="h-5 rounded-sm border border-slate-100 transition hover:ring-1 hover:ring-slate-300 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                                style={{
                                  backgroundColor: heatColor(
                                    "239,68,68",
                                    value,
                                    totalExpenseCategoryYearHeatmap.max,
                                  ),
                                }}
                                onMouseEnter={() =>
                                  setTotalCategoryYearHover({
                                    flow: "expense",
                                    year: yr,
                                    categoryName: row.name,
                                    value,
                                  })
                                }
                                onFocus={() =>
                                  setTotalCategoryYearHover({
                                    flow: "expense",
                                    year: yr,
                                    categoryName: row.name,
                                    value,
                                  })
                                }
                                onClick={() => {
                                  const prevValue =
                                    idx > 0 ? (row.totals[idx - 1] ?? 0) : null;
                                  const yoyDelta =
                                    prevValue === null
                                      ? null
                                      : value - prevValue;
                                  const yoyDeltaPct =
                                    prevValue === null || prevValue === 0
                                      ? null
                                      : ((value - prevValue) / prevValue) * 100;
                                  openTotalHeatmapDialog({
                                    kind: "categoryByYear",
                                    flow: "expense",
                                    year: yr,
                                    categoryId: row.categoryId,
                                    categoryName: row.name,
                                    color: row.color ?? "#ef4444",
                                    value,
                                    years:
                                      totalExpenseCategoryYearHeatmap.years,
                                    totals: row.totals,
                                    max: totalExpenseCategoryYearHeatmap.max,
                                    yearTotal:
                                      typeof yearTotal === "number"
                                        ? yearTotal
                                        : null,
                                    sharePct:
                                      typeof yearTotal === "number" &&
                                      yearTotal > 0
                                        ? (value / yearTotal) * 100
                                        : null,
                                    yoyDelta,
                                    yoyDeltaPct,
                                  });
                                }}
                              />
                            );
                          },
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {totalExpenseCategoryYearHeatmap ? (
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      {totalCategoryYearHover?.flow === "expense"
                        ? `${totalCategoryYearHover.categoryName} • ${totalCategoryYearHover.year}: ${currency(totalCategoryYearHover.value)}`
                        : "Hover a cell to see the value."}
                    </span>
                    <span className="text-slate-500">
                      Click a cell for details
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Income categories by year
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Top categories (lifetime) across all years.
                </p>
              </CardHeader>
              <CardContent className="overflow-auto">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : !totalIncomeCategoryYearHeatmap ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No category history yet.
                  </div>
                ) : (
                  <div
                    className="grid gap-px text-[10px] text-slate-600"
                    style={{
                      gridTemplateColumns: `160px repeat(${totalIncomeCategoryYearHeatmap.years.length}, minmax(0, 1fr))`,
                    }}
                    onMouseLeave={() => setTotalCategoryYearHover(null)}
                  >
                    <div />
                    {totalIncomeCategoryYearHeatmap.years.map((yr) => (
                      <div
                        key={yr}
                        className="flex h-6 items-center justify-center overflow-hidden"
                        title={String(yr)}
                      >
                        <span className="text-[10px] leading-none text-slate-600">
                          {String(yr).slice(-2)}
                        </span>
                      </div>
                    ))}
                    {totalIncomeCategoryYearHeatmap.rows.map((row) => (
                      <React.Fragment key={row.name}>
                        <div
                          className={
                            row.categoryId
                              ? "cursor-pointer truncate pr-2 font-medium text-slate-700"
                              : "truncate pr-2 font-medium text-slate-700"
                          }
                          onClick={() => {
                            if (!row.categoryId) return;
                            openTotalDrilldownDialog({
                              kind: "category",
                              flow: "income",
                              categoryId: row.categoryId,
                              name: row.name,
                              color: row.color ?? "#10b981",
                            });
                          }}
                        >
                          {row.name}
                        </div>
                        {totalIncomeCategoryYearHeatmap.years.map((yr, idx) => {
                          const value = row.totals[idx] ?? 0;
                          const yearTotal = totalYearly.find(
                            (entry) => entry.year === yr,
                          )?.income;
                          return (
                            <button
                              type="button"
                              key={`${row.name}-${yr}`}
                              title={`${row.name} • ${yr}: ${currency(value)}`}
                              aria-label={`${row.name} ${yr} income ${currency(value)}`}
                              className="h-5 rounded-sm border border-slate-100 transition hover:ring-1 hover:ring-slate-300 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                              style={{
                                backgroundColor: heatColor(
                                  "16,185,129",
                                  value,
                                  totalIncomeCategoryYearHeatmap.max,
                                ),
                              }}
                              onMouseEnter={() =>
                                setTotalCategoryYearHover({
                                  flow: "income",
                                  year: yr,
                                  categoryName: row.name,
                                  value,
                                })
                              }
                              onFocus={() =>
                                setTotalCategoryYearHover({
                                  flow: "income",
                                  year: yr,
                                  categoryName: row.name,
                                  value,
                                })
                              }
                              onClick={() => {
                                const prevValue =
                                  idx > 0 ? (row.totals[idx - 1] ?? 0) : null;
                                const yoyDelta =
                                  prevValue === null ? null : value - prevValue;
                                const yoyDeltaPct =
                                  prevValue === null || prevValue === 0
                                    ? null
                                    : ((value - prevValue) / prevValue) * 100;
                                openTotalHeatmapDialog({
                                  kind: "categoryByYear",
                                  flow: "income",
                                  year: yr,
                                  categoryId: row.categoryId,
                                  categoryName: row.name,
                                  color: row.color ?? "#10b981",
                                  value,
                                  years: totalIncomeCategoryYearHeatmap.years,
                                  totals: row.totals,
                                  max: totalIncomeCategoryYearHeatmap.max,
                                  yearTotal:
                                    typeof yearTotal === "number"
                                      ? yearTotal
                                      : null,
                                  sharePct:
                                    typeof yearTotal === "number" &&
                                    yearTotal > 0
                                      ? (value / yearTotal) * 100
                                      : null,
                                  yoyDelta,
                                  yoyDeltaPct,
                                });
                              }}
                            />
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </div>
                )}
                {totalIncomeCategoryYearHeatmap ? (
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                    <span>
                      {totalCategoryYearHover?.flow === "income"
                        ? `${totalCategoryYearHover.categoryName} • ${totalCategoryYearHover.year}: ${currency(totalCategoryYearHover.value)}`
                        : "Hover a cell to see the value."}
                    </span>
                    <span className="text-slate-500">
                      Click a cell for details
                    </span>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Investments (snapshot-based)
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Value is tracked via snapshots.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : !totalInvestments ? (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No investment snapshots yet.
                  </div>
                ) : (
                  <>
                    <div
                      className="h-44 cursor-pointer rounded-md border border-slate-100 bg-white p-2"
                      onClick={() =>
                        openTotalDrilldownDialog({ kind: "investments" })
                      }
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={totalInvestments.series}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            formatter={(value) => currency(Number(value))}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#4f46e5"
                            fill="rgba(79,70,229,0.15)"
                            strokeWidth={2}
                            name="Portfolio"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="max-h-56 overflow-auto rounded-md border border-slate-100 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Year</TableHead>
                            <TableHead className="text-right">End</TableHead>
                            <TableHead className="hidden text-right md:table-cell">
                              Net contrib
                            </TableHead>
                            <TableHead className="hidden text-right md:table-cell">
                              Implied return
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {totalInvestmentsYearlyTable.map((row) => (
                            <TableRow key={row.year}>
                              <TableCell className="font-medium">
                                {row.year}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {currency(row.endValue)}
                              </TableCell>
                              <TableCell className="hidden text-right md:table-cell">
                                {currency(row.netContributions)}
                              </TableCell>
                              <TableCell className="hidden text-right md:table-cell">
                                {row.impliedReturn === null
                                  ? "—"
                                  : currency(row.impliedReturn)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="max-h-44 overflow-auto rounded-md border border-slate-100 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Value</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {totalInvestments.accounts.map((row) => (
                            <TableRow key={row.name}>
                              <TableCell className="max-w-[220px] truncate font-medium">
                                {row.name}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {currency(row.value)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Debt overview
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Total debt and debt accounts. Values are as-of now, with a
                  year-over-year anchor when available.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Total debt
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(Number(totalOverview.debt.total_current))}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Δ vs prev year end
                        </p>
                        <p className="font-semibold text-slate-900">
                          {totalOverview.debt.change_since_prev_year_end
                            ? `${
                                Number(
                                  totalOverview.debt.change_since_prev_year_end,
                                ) >= 0
                                  ? "+"
                                  : "−"
                              }${currency(
                                Math.abs(
                                  Number(
                                    totalOverview.debt
                                      .change_since_prev_year_end,
                                  ),
                                ),
                              )}`
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Debt / income
                        </p>
                        <p className="font-semibold text-slate-900">
                          {totalOverview.debt.debt_to_income_latest_year
                            ? `${(
                                Number(
                                  totalOverview.debt.debt_to_income_latest_year,
                                ) * 100
                              ).toLocaleString("sv-SE", {
                                maximumFractionDigits: 0,
                              })}%`
                            : "—"}
                        </p>
                      </div>
                    </div>
                    <div
                      className="h-44 cursor-pointer rounded-md border border-slate-100 bg-white p-2"
                      onClick={() => openTotalDrilldownDialog({ kind: "debt" })}
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={totalDebtSeries}>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                          />
                          <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fill: "#475569", fontSize: 12 }}
                            tickFormatter={(v) => compactCurrency(Number(v))}
                          />
                          <Tooltip
                            formatter={(value) => currency(Number(value))}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Line
                            type="monotone"
                            dataKey="debt"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={false}
                            name="Debt"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="max-h-56 overflow-auto rounded-md border border-slate-100 bg-white">
                      {totalDebtAccounts.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right">
                                Current
                              </TableHead>
                              <TableHead className="hidden text-right md:table-cell">
                                Δ
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {totalDebtAccounts.map((row) => (
                              <TableRow key={row.id}>
                                <TableCell className="max-w-[180px] truncate font-medium">
                                  {row.name}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {currency(row.current)}
                                </TableCell>
                                <TableCell className="hidden text-right text-xs md:table-cell">
                                  {row.delta === null ? (
                                    "—"
                                  ) : (
                                    <span
                                      className={
                                        row.delta <= 0
                                          ? "text-emerald-700"
                                          : "text-rose-700"
                                      }
                                    >
                                      {row.delta >= 0 ? "+" : "−"}
                                      {currency(Math.abs(row.delta))}
                                    </span>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="p-4 text-sm text-slate-600">
                          No debt accounts found.
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Accounts overview
              </CardTitle>
              <p className="text-xs text-slate-500">
                Current balance plus lifetime operating and transfers totals.
              </p>
            </CardHeader>
            <CardContent className="max-h-[32rem] overflow-auto">
              {!totalOverview ? (
                <Skeleton className="h-56 w-full" />
              ) : totalAccountsOverview.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Type
                      </TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        Net operating
                      </TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        Net transfers
                      </TableHead>
                      <TableHead className="hidden md:table-cell">
                        First tx
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {totalAccountsOverview.map((row) => (
                      <TableRow
                        key={row.id}
                        className="cursor-pointer"
                        onClick={() =>
                          openTotalDrilldownDialog({
                            kind: "account",
                            accountId: row.id,
                            name: row.name,
                            accountType: row.type,
                          })
                        }
                      >
                        <TableCell className="max-w-[220px] truncate font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="hidden text-xs text-slate-600 md:table-cell">
                          {row.type}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {currency(row.balance)}
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          {currency(row.netOperating)}
                        </TableCell>
                        <TableCell className="hidden text-right md:table-cell">
                          {currency(row.netTransfers)}
                        </TableCell>
                        <TableCell className="hidden text-xs text-slate-600 md:table-cell">
                          {row.firstDate
                            ? new Date(row.firstDate).getFullYear()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  No accounts available.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Income sources
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Lifetime totals with biggest year-over-year shifts.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : totalIncomeSourcesLifetime.length ? (
                  <>
                    <div className="max-h-52 overflow-auto rounded-md border border-slate-100 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">
                              Lifetime
                            </TableHead>
                            <TableHead className="hidden text-right md:table-cell">
                              Tx
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {totalIncomeSourcesLifetime
                            .slice(0, 12)
                            .map((row) => (
                              <TableRow
                                key={row.source}
                                className="cursor-pointer"
                                onClick={() =>
                                  openTotalDrilldownDialog({
                                    kind: "source",
                                    flow: "income",
                                    source: row.source,
                                  })
                                }
                              >
                                <TableCell className="max-w-[220px] truncate font-medium">
                                  {row.source}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {currency(row.total)}
                                </TableCell>
                                <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                                  {row.txCount}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-white">
                      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                        Biggest YoY changes
                      </div>
                      <div className="max-h-44 overflow-auto">
                        {totalIncomeSourceChanges.length ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Source</TableHead>
                                <TableHead className="text-right">Δ</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {totalIncomeSourceChanges
                                .slice(0, 10)
                                .map((row) => (
                                  <TableRow
                                    key={row.source}
                                    className="cursor-pointer"
                                    onClick={() =>
                                      openTotalDrilldownDialog({
                                        kind: "source",
                                        flow: "income",
                                        source: row.source,
                                      })
                                    }
                                  >
                                    <TableCell className="max-w-[220px] truncate font-medium">
                                      {row.source}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      <span
                                        className={
                                          row.delta >= 0
                                            ? "text-emerald-700"
                                            : "text-rose-700"
                                        }
                                      >
                                        {row.delta >= 0 ? "+" : "−"}
                                        {currency(Math.abs(row.delta))}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="p-4 text-sm text-slate-600">
                            Not enough history for YoY source changes yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No income sources yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Expense sources
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Lifetime totals with biggest year-over-year shifts.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : totalExpenseSourcesLifetime.length ? (
                  <>
                    <div className="max-h-52 overflow-auto rounded-md border border-slate-100 bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source</TableHead>
                            <TableHead className="text-right">
                              Lifetime
                            </TableHead>
                            <TableHead className="hidden text-right md:table-cell">
                              Tx
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {totalExpenseSourcesLifetime
                            .slice(0, 12)
                            .map((row) => (
                              <TableRow
                                key={row.source}
                                className="cursor-pointer"
                                onClick={() =>
                                  openTotalDrilldownDialog({
                                    kind: "source",
                                    flow: "expense",
                                    source: row.source,
                                  })
                                }
                              >
                                <TableCell className="max-w-[220px] truncate font-medium">
                                  {row.source}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {currency(row.total)}
                                </TableCell>
                                <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                                  {row.txCount}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-white">
                      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                        Biggest YoY changes
                      </div>
                      <div className="max-h-44 overflow-auto">
                        {totalExpenseSourceChanges.length ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Source</TableHead>
                                <TableHead className="text-right">Δ</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {totalExpenseSourceChanges
                                .slice(0, 10)
                                .map((row) => (
                                  <TableRow
                                    key={row.source}
                                    className="cursor-pointer"
                                    onClick={() =>
                                      openTotalDrilldownDialog({
                                        kind: "source",
                                        flow: "expense",
                                        source: row.source,
                                      })
                                    }
                                  >
                                    <TableCell className="max-w-[220px] truncate font-medium">
                                      {row.source}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      <span
                                        className={
                                          row.delta <= 0
                                            ? "text-emerald-700"
                                            : "text-rose-700"
                                        }
                                      >
                                        {row.delta >= 0 ? "+" : "−"}
                                        {currency(Math.abs(row.delta))}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="p-4 text-sm text-slate-600">
                            Not enough history for YoY source changes yet.
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No expense sources yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Expense categories (lifetime)
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Biggest lifetime expense categories. Click to drill down.
                </p>
              </CardHeader>
              <CardContent className="h-80">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : totalExpenseCategoriesLifetime.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={totalExpenseCategoriesLifetime}
                      layout="vertical"
                      margin={{ left: 16, right: 12, top: 8, bottom: 8 }}
                      onClick={(
                        state: {
                          activePayload?: Array<{ payload?: unknown }>;
                        } | null,
                      ) => {
                        const payload = state?.activePayload?.[0]?.payload;
                        if (!isRecord(payload)) return;
                        const id = payload.id;
                        if (typeof id !== "string" || !id.length) return;
                        const name =
                          typeof payload.name === "string"
                            ? payload.name
                            : "Category";
                        const color =
                          typeof payload.color === "string"
                            ? payload.color
                            : "#ef4444";
                        openTotalDrilldownDialog({
                          kind: "category",
                          flow: "expense",
                          categoryId: id,
                          name,
                          color,
                        });
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        width={140}
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0]?.payload;
                          if (!isRecord(item)) return null;
                          const name =
                            typeof item.name === "string"
                              ? item.name
                              : "Category";
                          const total = Number(item.total ?? 0);
                          return (
                            <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                              <p className="font-semibold text-slate-800">
                                {name}
                              </p>
                              <p className="text-slate-600">
                                {currency(total)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="total" radius={[6, 6, 6, 6]}>
                        {totalExpenseCategoriesLifetime.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No lifetime category data yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Expense mix (last 6 years)
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Share of expenses by category (top + other).
                </p>
              </CardHeader>
              <CardContent className="h-80">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : totalExpenseMix.data.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={totalExpenseMix.data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="year"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        domain={[0, 100]}
                        tickFormatter={(v) =>
                          `${Number(v).toLocaleString("sv-SE", {
                            maximumFractionDigits: 0,
                          })}%`
                        }
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                              <p className="font-semibold text-slate-800">
                                {label}
                              </p>
                              {payload
                                .filter((p) => Number(p.value ?? 0) > 0.1)
                                .map((p) => (
                                  <p
                                    key={String(p.dataKey)}
                                    className="text-slate-600"
                                  >
                                    {p.name}:{" "}
                                    {Number(p.value ?? 0).toLocaleString(
                                      "sv-SE",
                                      { maximumFractionDigits: 1 },
                                    )}
                                    %
                                  </p>
                                ))}
                            </div>
                          );
                        }}
                      />
                      {totalExpenseMix.keys.map((key) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          stackId="mix"
                          fill={totalExpenseMix.colors[key] ?? "#94a3b8"}
                          name={key}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No category mix data yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Income categories (lifetime)
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Biggest lifetime income categories. Click to drill down.
                </p>
              </CardHeader>
              <CardContent className="h-80">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : totalIncomeCategoriesLifetime.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={totalIncomeCategoriesLifetime}
                      layout="vertical"
                      margin={{ left: 16, right: 12, top: 8, bottom: 8 }}
                      onClick={(
                        state: {
                          activePayload?: Array<{ payload?: unknown }>;
                        } | null,
                      ) => {
                        const payload = state?.activePayload?.[0]?.payload;
                        if (!isRecord(payload)) return;
                        const id = payload.id;
                        if (typeof id !== "string" || !id.length) return;
                        const name =
                          typeof payload.name === "string"
                            ? payload.name
                            : "Category";
                        const color =
                          typeof payload.color === "string"
                            ? payload.color
                            : "#10b981";
                        openTotalDrilldownDialog({
                          kind: "category",
                          flow: "income",
                          categoryId: id,
                          name,
                          color,
                        });
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tickLine={false}
                        axisLine={false}
                        width={140}
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0]?.payload;
                          if (!isRecord(item)) return null;
                          const name =
                            typeof item.name === "string"
                              ? item.name
                              : "Category";
                          const total = Number(item.total ?? 0);
                          return (
                            <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                              <p className="font-semibold text-slate-800">
                                {name}
                              </p>
                              <p className="text-slate-600">
                                {currency(total)}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Bar dataKey="total" radius={[6, 6, 6, 6]}>
                        {totalIncomeCategoriesLifetime.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No lifetime category data yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Income mix (last 6 years)
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Share of income by category (top + other).
                </p>
              </CardHeader>
              <CardContent className="h-80">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : totalIncomeMix.data.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={totalIncomeMix.data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="year"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        domain={[0, 100]}
                        tickFormatter={(v) =>
                          `${Number(v).toLocaleString("sv-SE", {
                            maximumFractionDigits: 0,
                          })}%`
                        }
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          return (
                            <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                              <p className="font-semibold text-slate-800">
                                {label}
                              </p>
                              {payload
                                .filter((p) => Number(p.value ?? 0) > 0.1)
                                .map((p) => (
                                  <p
                                    key={String(p.dataKey)}
                                    className="text-slate-600"
                                  >
                                    {p.name}:{" "}
                                    {Number(p.value ?? 0).toLocaleString(
                                      "sv-SE",
                                      { maximumFractionDigits: 1 },
                                    )}
                                    %
                                  </p>
                                ))}
                            </div>
                          );
                        }}
                      />
                      {totalIncomeMix.keys.map((key) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          stackId="mix"
                          fill={totalIncomeMix.colors[key] ?? "#94a3b8"}
                          name={key}
                          isAnimationActive={false}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No category mix data yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Expense category changes (YoY)
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Biggest changes vs the previous year (latest complete year
                  when available).
                </p>
              </CardHeader>
              <CardContent className="max-h-[26rem] overflow-auto">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : totalExpenseCategoryChanges.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Δ</TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          YoY
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totalExpenseCategoryChanges.slice(0, 14).map((row) => (
                        <TableRow
                          key={row.name}
                          className={row.id ? "cursor-pointer" : undefined}
                          onClick={() => {
                            if (!row.id) return;
                            openTotalDrilldownDialog({
                              kind: "category",
                              flow: "expense",
                              categoryId: row.id,
                              name: row.name,
                              color: "#ef4444",
                            });
                          }}
                        >
                          <TableCell className="max-w-[220px] truncate font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span
                              className={
                                row.delta <= 0
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                              }
                            >
                              {row.delta >= 0 ? "+" : "−"}
                              {currency(Math.abs(row.delta))}
                            </span>
                          </TableCell>
                          <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                            {row.deltaPct !== null
                              ? percent(row.deltaPct)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No change data yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-slate-900">
                  Income category changes (YoY)
                </CardTitle>
                <p className="text-xs text-slate-500">
                  Biggest changes vs the previous year (latest complete year
                  when available).
                </p>
              </CardHeader>
              <CardContent className="max-h-[26rem] overflow-auto">
                {!totalOverview ? (
                  <Skeleton className="h-56 w-full" />
                ) : totalIncomeCategoryChanges.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Δ</TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          YoY
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totalIncomeCategoryChanges.slice(0, 14).map((row) => (
                        <TableRow
                          key={row.name}
                          className={row.id ? "cursor-pointer" : undefined}
                          onClick={() => {
                            if (!row.id) return;
                            openTotalDrilldownDialog({
                              kind: "category",
                              flow: "income",
                              categoryId: row.id,
                              name: row.name,
                              color: "#10b981",
                            });
                          }}
                        >
                          <TableCell className="max-w-[220px] truncate font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span
                              className={
                                row.delta >= 0
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                              }
                            >
                              {row.delta >= 0 ? "+" : "−"}
                              {currency(Math.abs(row.delta))}
                            </span>
                          </TableCell>
                          <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                            {row.deltaPct !== null
                              ? percent(row.deltaPct)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                    No change data yet.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <Dialog
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
      >
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              {totalDrilldown?.kind === "category"
                ? `${totalDrilldown.name} (${totalDrilldown.flow})`
                : totalDrilldown?.kind === "source"
                  ? `${totalDrilldown.source} (${totalDrilldown.flow})`
                  : totalDrilldown?.kind === "account"
                    ? `${totalDrilldown.name} (${totalDrilldown.accountType})`
                    : totalDrilldown?.kind === "year"
                      ? `Year ${totalDrilldown.year}`
                      : totalDrilldown?.kind === "investments"
                        ? "Investments"
                        : totalDrilldown?.kind === "debt"
                          ? "Debt overview"
                          : totalDrilldown?.kind === "netWorth"
                            ? "Net worth"
                            : "Details"}
            </DialogTitle>
          </DialogHeader>

          {!totalDrilldown ? null : totalDrilldown.kind === "category" ||
            totalDrilldown.kind === "source" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Window:{" "}
                  {totalWindowRange
                    ? `${totalWindowRange.start} → ${totalWindowRange.end}`
                    : "—"}
                </p>
              </div>
              {totalDrilldownError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {totalDrilldownError}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      Total (filtered)
                    </p>
                    <p className="font-semibold text-slate-900">
                      {totalDrilldownLoading
                        ? "—"
                        : currency(
                            totalDrilldownSeries.reduce((sum, row) => {
                              const value =
                                totalDrilldown.flow === "expense"
                                  ? row.expense
                                  : row.income;
                              return sum + value;
                            }, 0),
                          )}
                    </p>
                    <p className="text-xs text-slate-600">
                      Monthly buckets from /reports/custom (transfers excluded).
                    </p>
                  </div>
                  {totalDrilldownAnomalies.length ? (
                    <div className="rounded-md border border-slate-100 bg-white p-3">
                      <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                        Notable months
                      </p>
                      <div className="mt-2 space-y-2">
                        {totalDrilldownAnomalies.map((row) => (
                          <div
                            key={row.period}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-slate-600">
                              {new Date(row.period).toLocaleDateString(
                                "sv-SE",
                                {
                                  year: "numeric",
                                  month: "short",
                                },
                              )}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {currency(row.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Flagged as unusually high vs typical month.
                      </p>
                    </div>
                  ) : null}
                  <div className="max-h-72 overflow-auto rounded-md border border-slate-100 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Year</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(() => {
                          const bucket: Record<number, number> = {};
                          totalDrilldownSeries.forEach((row) => {
                            const yr = new Date(row.period).getUTCFullYear();
                            const value =
                              totalDrilldown.flow === "expense"
                                ? row.expense
                                : row.income;
                            bucket[yr] = (bucket[yr] ?? 0) + value;
                          });
                          return Object.entries(bucket)
                            .map(([yr, value]) => ({
                              year: Number(yr),
                              total: value,
                            }))
                            .sort((a, b) => b.year - a.year)
                            .slice(0, 20)
                            .map((row) => (
                              <TableRow key={row.year}>
                                <TableCell className="font-medium">
                                  {row.year}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {currency(row.total)}
                                </TableCell>
                              </TableRow>
                            ));
                        })()}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="h-80 rounded-md border border-slate-100 bg-white p-2">
                  {totalDrilldownLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : totalDrilldownSeries.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={totalDrilldownSeries.map((row) => ({
                          date: row.period,
                          label: new Date(row.period).toLocaleDateString(
                            "sv-SE",
                            { month: "short", year: "2-digit" },
                          ),
                          value:
                            totalDrilldown.flow === "expense"
                              ? row.expense
                              : row.income,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          labelFormatter={(_label, payload) =>
                            payload?.[0]?.payload?.date
                              ? new Date(
                                  String(payload[0].payload.date),
                                ).toLocaleDateString("sv-SE", {
                                  year: "numeric",
                                  month: "long",
                                })
                              : String(_label)
                          }
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke={
                            totalDrilldown.kind === "category"
                              ? totalDrilldown.color
                              : totalDrilldown.flow === "income"
                                ? "#10b981"
                                : "#ef4444"
                          }
                          fill={
                            totalDrilldown.flow === "income"
                              ? "rgba(16,185,129,0.14)"
                              : "rgba(239,68,68,0.12)"
                          }
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      No history available.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : totalDrilldown.kind === "account" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Window:{" "}
                  {totalWindowRange
                    ? `${totalWindowRange.start} → ${totalWindowRange.end}`
                    : "—"}
                </p>
              </div>
              {totalDrilldownError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {totalDrilldownError}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Income
                      </p>
                      <p className="font-semibold text-emerald-700">
                        {currency(
                          totalDrilldownSeries.reduce(
                            (sum, row) => sum + row.income,
                            0,
                          ),
                        )}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Expense
                      </p>
                      <p className="font-semibold text-rose-700">
                        {currency(
                          totalDrilldownSeries.reduce(
                            (sum, row) => sum + row.expense,
                            0,
                          ),
                        )}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-white p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Net
                      </p>
                      <p className="font-semibold text-slate-900">
                        {currency(
                          totalDrilldownSeries.reduce(
                            (sum, row) => sum + row.net,
                            0,
                          ),
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    This uses /reports/custom (income/expense only). Transfers
                    are excluded.
                  </div>
                  {totalDrilldownAnomalies.length ? (
                    <div className="rounded-md border border-slate-100 bg-white p-3">
                      <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                        Notable months (net)
                      </p>
                      <div className="mt-2 space-y-2">
                        {totalDrilldownAnomalies.map((row) => (
                          <div
                            key={row.period}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-slate-600">
                              {new Date(row.period).toLocaleDateString(
                                "sv-SE",
                                {
                                  year: "numeric",
                                  month: "short",
                                },
                              )}
                            </span>
                            <span
                              className={
                                row.value >= 0
                                  ? "font-semibold text-emerald-700"
                                  : "font-semibold text-rose-700"
                              }
                            >
                              {row.value >= 0 ? "+" : "−"}
                              {currency(Math.abs(row.value))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="h-80 rounded-md border border-slate-100 bg-white p-2">
                  {totalDrilldownLoading ? (
                    <Skeleton className="h-full w-full" />
                  ) : totalDrilldownSeries.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={totalDrilldownSeries.map((row) => ({
                          date: row.period,
                          label: new Date(row.period).toLocaleDateString(
                            "sv-SE",
                            { month: "short", year: "2-digit" },
                          ),
                          income: row.income,
                          expenseNeg: -row.expense,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) =>
                            currency(Math.abs(Number(value)))
                          }
                          labelFormatter={(_label, payload) =>
                            payload?.[0]?.payload?.date
                              ? new Date(
                                  String(payload[0].payload.date),
                                ).toLocaleDateString("sv-SE", {
                                  year: "numeric",
                                  month: "long",
                                })
                              : String(_label)
                          }
                          contentStyle={{ fontSize: 12 }}
                        />
                        <ReferenceLine y={0} stroke="#cbd5e1" />
                        <Bar
                          dataKey="income"
                          name="Income"
                          fill="#10b981"
                          radius={[4, 4, 4, 4]}
                          isAnimationActive={false}
                        />
                        <Bar
                          dataKey="expenseNeg"
                          name="Expense"
                          fill="#ef4444"
                          radius={[4, 4, 4, 4]}
                          isAnimationActive={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      No history available.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : totalDrilldown.kind === "year" ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Snapshot of the yearly report. Use “Open yearly report” for
                  the full page.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `${PageRoutes.reportsYearly}/${totalDrilldown.year}`,
                    )
                  }
                >
                  Open yearly report
                </Button>
              </div>
              {totalYearDrilldownError ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {totalYearDrilldownError}
                </div>
              ) : null}
              {totalYearDrilldownLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : !totalYearDrilldown ? (
                <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                  No yearly details available.
                </div>
              ) : (
                (() => {
                  const monthly = totalYearDrilldown.monthly.map((row) => ({
                    date: row.date,
                    month: monthLabel(row.date),
                    income: Number(row.income),
                    expense: Number(row.expense),
                    net: Number(row.net),
                  }));
                  const topExpenseCategories = [
                    ...totalYearDrilldown.category_breakdown,
                  ]
                    .map((row) => ({
                      name: row.name,
                      total: Number(row.total),
                      txCount: row.transaction_count,
                    }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 10);
                  const topIncomeCategories = [
                    ...totalYearDrilldown.income_category_breakdown,
                  ]
                    .map((row) => ({
                      name: row.name,
                      total: Number(row.total),
                      txCount: row.transaction_count,
                    }))
                    .sort((a, b) => b.total - a.total)
                    .slice(0, 10);

                  return (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          {[
                            {
                              label: "Income",
                              value: Number(
                                totalYearDrilldown.stats.total_income,
                              ),
                              className: "text-emerald-700",
                            },
                            {
                              label: "Expense",
                              value: Number(
                                totalYearDrilldown.stats.total_expense,
                              ),
                              className: "text-rose-700",
                            },
                            {
                              label: "Net saved",
                              value: Number(
                                totalYearDrilldown.stats.net_savings,
                              ),
                              className: "text-slate-900",
                            },
                            {
                              label: "Savings rate",
                              value: totalYearDrilldown.stats.savings_rate_pct
                                ? Number(
                                    totalYearDrilldown.stats.savings_rate_pct,
                                  )
                                : null,
                              className: "text-slate-900",
                              format: "percent" as const,
                            },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="rounded-md border border-slate-100 bg-slate-50 p-3"
                            >
                              <p className="text-xs tracking-wide text-slate-500 uppercase">
                                {item.label}
                              </p>
                              <p className={`font-semibold ${item.className}`}>
                                {item.value === null
                                  ? "—"
                                  : item.format === "percent"
                                    ? percent(item.value)
                                    : currency(item.value)}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthly}>
                              <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="month"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "#475569", fontSize: 12 }}
                              />
                              <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fill: "#475569", fontSize: 12 }}
                                tickFormatter={(v) =>
                                  compactCurrency(Math.abs(Number(v)))
                                }
                              />
                              <Tooltip
                                formatter={(value) =>
                                  currency(Math.abs(Number(value)))
                                }
                                contentStyle={{ fontSize: 12 }}
                              />
                              <ReferenceLine y={0} stroke="#cbd5e1" />
                              <Bar
                                dataKey="income"
                                name="Income"
                                fill="#10b981"
                                radius={[6, 6, 0, 0]}
                                barSize={16}
                                isAnimationActive={false}
                              />
                              <Bar
                                dataKey="expense"
                                name="Expense"
                                fill="#ef4444"
                                radius={[6, 6, 0, 0]}
                                barSize={16}
                                isAnimationActive={false}
                              />
                              <Line
                                type="monotone"
                                dataKey="net"
                                name="Net"
                                stroke="#0f172a"
                                strokeWidth={2}
                                dot={false}
                                isAnimationActive={false}
                              />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="grid gap-3">
                        <div className="rounded-md border border-slate-100 bg-white">
                          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                            Top expense categories
                          </div>
                          <div className="max-h-72 overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Category</TableHead>
                                  <TableHead className="text-right">
                                    Total
                                  </TableHead>
                                  <TableHead className="hidden text-right md:table-cell">
                                    Tx
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {topExpenseCategories.map((row) => (
                                  <TableRow key={row.name}>
                                    <TableCell className="font-medium">
                                      {row.name}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {currency(row.total)}
                                    </TableCell>
                                    <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                                      {row.txCount}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>

                        <div className="rounded-md border border-slate-100 bg-white">
                          <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                            Top income categories
                          </div>
                          <div className="max-h-72 overflow-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Category</TableHead>
                                  <TableHead className="text-right">
                                    Total
                                  </TableHead>
                                  <TableHead className="hidden text-right md:table-cell">
                                    Tx
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {topIncomeCategories.map((row) => (
                                  <TableRow key={row.name}>
                                    <TableCell className="font-medium">
                                      {row.name}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold text-emerald-700">
                                      {currency(row.total)}
                                    </TableCell>
                                    <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                                      {row.txCount}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}
            </>
          ) : totalDrilldown.kind === "investments" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      Latest value
                    </p>
                    <p className="font-semibold text-slate-900">
                      {totalKpis?.investmentsValue === null
                        ? "—"
                        : currency(totalKpis?.investmentsValue ?? 0)}
                    </p>
                    <p className="text-xs text-slate-600">Snapshot-based.</p>
                  </div>
                  <div className="max-h-72 overflow-auto rounded-md border border-slate-100 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Year</TableHead>
                          <TableHead className="text-right">End</TableHead>
                          <TableHead className="hidden text-right md:table-cell">
                            Net contrib
                          </TableHead>
                          <TableHead className="hidden text-right md:table-cell">
                            Implied return
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {totalInvestmentsYearlyTable.map((row) => (
                          <TableRow key={row.year}>
                            <TableCell className="font-medium">
                              {row.year}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {currency(row.endValue)}
                            </TableCell>
                            <TableCell className="hidden text-right md:table-cell">
                              {currency(row.netContributions)}
                            </TableCell>
                            <TableCell className="hidden text-right md:table-cell">
                              {row.impliedReturn === null
                                ? "—"
                                : currency(row.impliedReturn)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="h-80 rounded-md border border-slate-100 bg-white p-2">
                  {!totalOverview?.investments?.series?.length ? (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      No investment snapshots yet.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={totalOverview.investments.series.map((row) => ({
                          date: row.date,
                          label: new Date(row.date).toLocaleDateString(
                            "sv-SE",
                            {
                              month: "short",
                              year: "2-digit",
                            },
                          ),
                          value: Number(row.value),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          labelFormatter={(_label, payload) =>
                            payload?.[0]?.payload?.date
                              ? new Date(
                                  String(payload[0].payload.date),
                                ).toLocaleDateString("sv-SE", {
                                  year: "numeric",
                                  month: "long",
                                })
                              : String(_label)
                          }
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#4f46e5"
                          fill="rgba(79,70,229,0.15)"
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </>
          ) : totalDrilldown.kind === "debt" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      Total debt
                    </p>
                    <p className="font-semibold text-slate-900">
                      {totalOverview
                        ? currency(Number(totalOverview.debt.total_current))
                        : "—"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Accounts shown as-of now.
                    </p>
                  </div>
                  <div className="max-h-72 overflow-auto rounded-md border border-slate-100 bg-white">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account</TableHead>
                          <TableHead className="text-right">Debt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {totalDebtAccounts.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="max-w-[220px] truncate font-medium">
                              {row.name}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {currency(row.current)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                <div className="h-80 rounded-md border border-slate-100 bg-white p-2">
                  {totalDebtSeries.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={totalOverview?.debt.series.map((row) => ({
                          date: row.date,
                          label: new Date(row.date).toLocaleDateString(
                            "sv-SE",
                            {
                              month: "short",
                              year: "2-digit",
                            },
                          ),
                          debt: Number(row.debt),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          labelFormatter={(_label, payload) =>
                            payload?.[0]?.payload?.date
                              ? new Date(
                                  String(payload[0].payload.date),
                                ).toLocaleDateString("sv-SE", {
                                  year: "numeric",
                                  month: "long",
                                })
                              : String(_label)
                          }
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="debt"
                          stroke="#ef4444"
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      No debt history yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      As of
                    </p>
                    <p className="font-semibold text-slate-900">
                      {totalOverview
                        ? new Date(totalOverview.as_of).toLocaleDateString(
                            "sv-SE",
                          )
                        : "—"}
                    </p>
                    <p className="text-xs text-slate-600">
                      Ledger + investment snapshots.
                    </p>
                  </div>
                  {totalNetWorthStats ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Current
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(totalNetWorthStats.current)}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Change (12m)
                        </p>
                        <p className="font-semibold text-slate-900">
                          {totalNetWorthStats.delta12m === null ? (
                            "—"
                          ) : (
                            <>
                              <span
                                className={
                                  totalNetWorthStats.delta12m >= 0
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                                }
                              >
                                {totalNetWorthStats.delta12m >= 0 ? "+" : "−"}
                                {currency(
                                  Math.abs(totalNetWorthStats.delta12m),
                                )}
                              </span>
                              {totalNetWorthStats.delta12mPct ===
                              null ? null : (
                                <span className="ml-2 text-xs text-slate-600">
                                  ({percent(totalNetWorthStats.delta12mPct)})
                                </span>
                              )}
                            </>
                          )}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Change (since start)
                        </p>
                        <p className="font-semibold text-slate-900">
                          <span
                            className={
                              totalNetWorthStats.deltaSinceStart >= 0
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }
                          >
                            {totalNetWorthStats.deltaSinceStart >= 0
                              ? "+"
                              : "−"}
                            {currency(
                              Math.abs(totalNetWorthStats.deltaSinceStart),
                            )}
                          </span>
                          {totalNetWorthStats.deltaSinceStartPct ===
                          null ? null : (
                            <span className="ml-2 text-xs text-slate-600">
                              ({percent(totalNetWorthStats.deltaSinceStartPct)})
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="rounded-md border border-slate-100 bg-white p-3">
                        <p className="text-xs tracking-wide text-slate-500 uppercase">
                          Range
                        </p>
                        <p className="font-semibold text-slate-900">
                          {currency(totalNetWorthStats.allTimeLow)} →{" "}
                          {currency(totalNetWorthStats.allTimeHigh)}
                        </p>
                        <p className="text-xs text-slate-600">
                          High:{" "}
                          {new Date(
                            totalNetWorthStats.allTimeHighDate,
                          ).toLocaleDateString("sv-SE")}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {totalNetWorthAttribution ? (
                    <div className="rounded-md border border-slate-100 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                            Change Attribution
                          </p>
                          <p className="text-xs text-slate-500">
                            {new Date(
                              totalNetWorthAttribution.windowStart,
                            ).getFullYear()}
                            –
                            {new Date(
                              totalNetWorthAttribution.windowEnd,
                            ).getFullYear()}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">
                          {totalNetWorthAttribution.netWorthDelta >= 0
                            ? "+"
                            : "−"}
                          {currency(
                            Math.abs(totalNetWorthAttribution.netWorthDelta),
                          )}
                        </p>
                      </div>
                      <div className="mt-3 space-y-2">
                        {(
                          [
                            {
                              label: "Savings (income − expense)",
                              value: totalNetWorthAttribution.savings,
                            },
                            totalNetWorthAttribution.investmentsContribution ===
                            null
                              ? null
                              : {
                                  label: "Investments change",
                                  value:
                                    totalNetWorthAttribution.investmentsContribution,
                                },
                            {
                              label: "Debt change",
                              value: totalNetWorthAttribution.debtContribution,
                            },
                            {
                              label: "Remainder",
                              value: totalNetWorthAttribution.remainder,
                            },
                          ] as Array<null | { label: string; value: number }>
                        )
                          .filter(
                            (row): row is { label: string; value: number } =>
                              Boolean(row),
                          )
                          .map((row) => {
                            const denominator = Math.max(
                              1,
                              Math.abs(totalNetWorthAttribution.netWorthDelta),
                            );
                            const pct =
                              (Math.abs(row.value) / denominator) * 100;
                            return (
                              <div key={row.label} className="space-y-1">
                                <div className="flex items-center justify-between text-xs text-slate-600">
                                  <span>{row.label}</span>
                                  <span
                                    className={
                                      row.value >= 0
                                        ? "font-medium text-emerald-700"
                                        : "font-medium text-rose-700"
                                    }
                                  >
                                    {row.value >= 0 ? "+" : "−"}
                                    {currency(Math.abs(row.value))}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Progress
                                    value={Math.min(100, pct)}
                                    className="h-2"
                                  />
                                  <span className="w-10 text-right text-[11px] text-slate-500">
                                    {percent(pct)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="h-80 rounded-md border border-slate-100 bg-white p-2">
                  {totalOverview?.net_worth_series.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={totalOverview.net_worth_series.map((row) => ({
                          date: row.date,
                          label: new Date(row.date).toLocaleDateString(
                            "sv-SE",
                            {
                              month: "short",
                              year: "2-digit",
                            },
                          ),
                          netWorth: Number(row.net_worth),
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          labelFormatter={(_label, payload) =>
                            payload?.[0]?.payload?.date
                              ? new Date(
                                  String(payload[0].payload.date),
                                ).toLocaleDateString("sv-SE", {
                                  year: "numeric",
                                  month: "long",
                                })
                              : String(_label)
                          }
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="netWorth"
                          stroke="#0f172a"
                          fill="rgba(15,23,42,0.12)"
                          strokeWidth={2}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      No net worth history yet.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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

      <Dialog
        open={totalTimeseriesDialogOpen}
        onOpenChange={(open) => {
          setTotalTimeseriesDialogOpen(open);
          if (!open) setTotalTimeseriesDialog(null);
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {totalTimeseriesDialog?.kind === "netWorthBreakdown"
                ? `Net worth breakdown • ${new Date(
                    totalTimeseriesDialog.date,
                  ).toLocaleDateString("sv-SE", {
                    year: "numeric",
                    month: "long",
                  })}`
                : totalTimeseriesDialog?.kind === "savingsRate"
                  ? `Savings rate • ${new Date(
                      totalTimeseriesDialog.date,
                    ).toLocaleDateString("sv-SE", {
                      year: "numeric",
                      month: "long",
                    })}`
                  : "Details"}
            </DialogTitle>
          </DialogHeader>

          {!totalTimeseriesDialog ? null : totalTimeseriesDialog.kind ===
            "netWorthBreakdown" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Net worth
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(totalTimeseriesDialog.netWorth)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Cash
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(totalTimeseriesDialog.cash)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {totalTimeseriesDialog.shareCashPct === null
                      ? "—"
                      : `${totalTimeseriesDialog.shareCashPct.toFixed(0)}% of assets`}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Investments
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(totalTimeseriesDialog.investments)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {totalTimeseriesDialog.shareInvestmentsPct === null
                      ? "—"
                      : `${totalTimeseriesDialog.shareInvestmentsPct.toFixed(0)}% of assets`}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Debt
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(totalTimeseriesDialog.debt)}
                  </p>
                  <p className="text-xs text-slate-600">
                    {totalTimeseriesDialog.shareDebtPct === null
                      ? "—"
                      : `${totalTimeseriesDialog.shareDebtPct.toFixed(0)}% of assets`}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 rounded-md border border-slate-100 bg-white p-3">
                  <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                    Composition
                  </p>
                  {(
                    [
                      {
                        label: "Cash",
                        value: totalTimeseriesDialog.shareCashPct,
                      },
                      {
                        label: "Investments",
                        value: totalTimeseriesDialog.shareInvestmentsPct,
                      },
                      {
                        label: "Debt",
                        value: totalTimeseriesDialog.shareDebtPct,
                      },
                    ] as const
                  ).map((row) => (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>{row.label}</span>
                        <span className="font-medium text-slate-800">
                          {row.value === null
                            ? "—"
                            : `${row.value.toFixed(0)}%`}
                        </span>
                      </div>
                      <Progress
                        value={row.value === null ? 0 : Math.max(0, row.value)}
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-3 rounded-md border border-slate-100 bg-white p-3">
                  <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                    Deltas
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        MoM
                      </p>
                      <p className="font-semibold text-slate-900">
                        {totalTimeseriesDialog.deltaMoM === null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              totalTimeseriesDialog.deltaMoM >= 0
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }
                          >
                            {totalTimeseriesDialog.deltaMoM >= 0 ? "+" : "−"}
                            {currency(Math.abs(totalTimeseriesDialog.deltaMoM))}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        YoY
                      </p>
                      <p className="font-semibold text-slate-900">
                        {totalTimeseriesDialog.deltaYoY === null ? (
                          "—"
                        ) : (
                          <span
                            className={
                              totalTimeseriesDialog.deltaYoY >= 0
                                ? "text-emerald-700"
                                : "text-rose-700"
                            }
                          >
                            {totalTimeseriesDialog.deltaYoY >= 0 ? "+" : "−"}
                            {currency(Math.abs(totalTimeseriesDialog.deltaYoY))}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setTotalTimeseriesDialogOpen(false);
                      setTotalTimeseriesDialog(null);
                      openTotalDrilldownDialog({ kind: "netWorth" });
                    }}
                  >
                    Open full net worth details
                  </Button>
                </div>
              </div>
            </div>
          ) : totalTimeseriesDialog.kind === "savingsRate" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Savings rate
                  </p>
                  <p className="font-semibold text-slate-900">
                    {totalTimeseriesDialog.ratePct === null
                      ? "—"
                      : `${totalTimeseriesDialog.ratePct.toFixed(1)}%`}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Rolling 12m
                  </p>
                  <p className="font-semibold text-slate-900">
                    {totalTimeseriesDialog.rolling12mPct === null
                      ? "—"
                      : `${totalTimeseriesDialog.rolling12mPct.toFixed(1)}%`}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Income
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(totalTimeseriesDialog.income)}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Expense / Net
                  </p>
                  <p className="font-semibold text-slate-900">
                    {currency(totalTimeseriesDialog.expense)}
                  </p>
                  <p className="text-xs text-slate-600">
                    Net: {currency(totalTimeseriesDialog.net)}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={totalTimeseriesDialog.window.map((row) => ({
                        label: row.label,
                        income: row.income,
                        expenseNeg: -row.expense,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                        tickFormatter={(v) => compactCurrency(Number(v))}
                      />
                      <Tooltip
                        formatter={(value) => currency(Math.abs(Number(value)))}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <ReferenceLine y={0} stroke="#cbd5e1" />
                      <Bar
                        dataKey="income"
                        name="Income"
                        fill="#10b981"
                        radius={[6, 6, 4, 4]}
                      />
                      <Bar
                        dataKey="expenseNeg"
                        name="Expense"
                        fill="#ef4444"
                        radius={[6, 6, 4, 4]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={totalTimeseriesDialog.window}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
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
                        domain={totalSavingsRateDomain}
                        tickFormatter={(v) => `${Number(v)}%`}
                      />
                      <ReferenceLine y={0} stroke="#cbd5e1" />
                      <Tooltip
                        formatter={(value) => `${Number(value).toFixed(1)}%`}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="ratePct"
                        stroke="#0f172a"
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Legacy total detail dialog (no longer used after /reports/total rework).
		      {routeMode === "total" ? (
		        <Dialog
          open={detailDialogOpen}
          onOpenChange={(open) => {
            setDetailDialogOpen(open);
            if (!open) setDetailDialog(null);
          }}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>{detailDialog?.title ?? "Details"}</DialogTitle>
            </DialogHeader>
            {!detailDialog ? null : detailDialog.kind === "investments" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        As of
                      </p>
                      <p className="font-semibold text-slate-900">
                        {new Date(detailDialog.asOf).toLocaleDateString(
                          "sv-SE",
                        )}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Value
                      </p>
                      <p className="font-semibold text-slate-900">
                        {currency(detailDialog.summary.end)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {detailDialog.summary.change >= 0 ? "+" : "−"}
                        {currency(Math.abs(detailDialog.summary.change))}{" "}
                        {detailDialog.summary.changePct !== null
                          ? `(${percent(detailDialog.summary.changePct)})`
                          : ""}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-white p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Contributions
                      </p>
                      <p className="font-semibold text-slate-900">
                        {currency(detailDialog.summary.contributions)}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-white p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Withdrawals
                      </p>
                      <p className="font-semibold text-slate-900">
                        {currency(detailDialog.summary.withdrawals)}
                      </p>
                    </div>
                  </div>
                  <div className="h-60 rounded-md border border-slate-100 bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={detailDialog.monthly}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#4f46e5"
                          fill="rgba(79,70,229,0.15)"
                          strokeWidth={2}
                          name="Portfolio"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold">What this means</p>
                    <p className="text-xs text-slate-600">
                      Investments are tracked via snapshots, so they should not
                      appear as an expense category.
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-100">
                    <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                      Accounts
                    </div>
                    <div className="max-h-[22rem] overflow-auto">
                      {detailDialog.accounts.length ? (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Account</TableHead>
                              <TableHead className="text-right">
                                Start
                              </TableHead>
                              <TableHead className="text-right">End</TableHead>
                              <TableHead className="text-right">
                                Change
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {detailDialog.accounts.map((row) => (
                              <TableRow key={row.name}>
                                <TableCell className="max-w-[200px] truncate font-medium">
                                  {row.name}
                                </TableCell>
                                <TableCell className="text-right">
                                  {currency(row.start)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {currency(row.end)}
                                </TableCell>
                                <TableCell className="text-right text-xs">
                                  <span
                                    className={
                                      row.change >= 0
                                        ? "text-emerald-700"
                                        : "text-rose-700"
                                    }
                                  >
                                    {row.change >= 0 ? "+" : "−"}
                                    {currency(Math.abs(row.change))}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      ) : (
                        <div className="p-3 text-sm text-slate-500">
                          No investment accounts available.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : detailDialog.kind === "debt" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Start
                      </p>
                      <p className="font-semibold text-slate-900">
                        {currency(detailDialog.startDebt)}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        End
                      </p>
                      <p className="font-semibold text-slate-900">
                        {currency(detailDialog.endDebt)}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-white p-3 sm:col-span-2">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Change
                      </p>
                      <p className="font-semibold text-slate-900">
                        {detailDialog.delta >= 0 ? "+" : "−"}
                        {currency(Math.abs(detailDialog.delta))}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    A negative change means you paid down debt during the
                    period.
                  </div>
                </div>
                <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={detailDialog.monthly}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        tickFormatter={(v) => compactCurrency(Number(v))}
                      />
                      <Tooltip
                        formatter={(value) => currency(Number(value))}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={false}
                        name="Debt"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : detailDialog.kind === "account" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-4">
                  {[
                    { label: "Start", value: detailDialog.startBalance },
                    { label: "End", value: detailDialog.endBalance },
                    { label: "Change", value: detailDialog.change },
                    {
                      label: "Type",
                      value: detailDialog.accountType,
                      text: true,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-md border border-slate-100 bg-slate-50 p-3"
                    >
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        {item.label}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {"text" in item && item.text
                          ? String(item.value)
                          : currency(Number(item.value))}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={detailDialog.monthly.map((m) => ({
                          ...m,
                          expenseNeg: -m.expense,
                          transfersOutNeg: -m.transfersOut,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar
                          dataKey="income"
                          name="Income"
                          fill="#10b981"
                          radius={[4, 4, 4, 4]}
                        />
                        <Bar
                          dataKey="expenseNeg"
                          name="Expense"
                          fill="#ef4444"
                          radius={[4, 4, 4, 4]}
                        />
                        <Bar
                          dataKey="transfersIn"
                          name="Transfers in"
                          fill="#0ea5e9"
                          radius={[4, 4, 4, 4]}
                        />
                        <Bar
                          dataKey="transfersOutNeg"
                          name="Transfers out"
                          fill="#a855f7"
                          radius={[4, 4, 4, 4]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={detailDialog.monthly}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="change"
                          name="Monthly change"
                          stroke="#334155"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : detailDialog.kind === "subscription" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      {detailDialog.subtitle}
                    </p>
                    <p className="text-xs text-slate-600">
                      Current month: {currency(detailDialog.currentMonth)} •
                      12m: {currency(detailDialog.trailing12m)}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    Based on subscription matching and historical charges.
                  </div>
                </div>
                <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={detailDialog.monthly}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        tickFormatter={(v) => compactCurrency(Number(v))}
                      />
                      <Tooltip
                        formatter={(value) => currency(Number(value))}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar
                        dataKey="total"
                        name="Total"
                        fill="#334155"
                        radius={[6, 6, 4, 4]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : detailDialog.kind === "category" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      {detailDialog.subtitle}
                    </p>
                    <p className="font-semibold text-slate-900">
                      {currency(detailDialog.total)}
                    </p>
                    {typeof detailDialog.prevTotal === "number" &&
                    typeof detailDialog.delta === "number" ? (
                      <p className="text-xs text-slate-600">
                        Prev: {currency(detailDialog.prevTotal)} • Δ:{" "}
                        {currency(detailDialog.delta)}{" "}
                        {detailDialog.deltaPct !== null &&
                        typeof detailDialog.deltaPct === "number"
                          ? `(${percent(detailDialog.deltaPct)})`
                          : ""}
                      </p>
                    ) : null}
                    {typeof detailDialog.txCount === "number" ? (
                      <p className="text-xs text-slate-600">
                        {detailDialog.txCount} transactions
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    Categories come from transaction categorization (transfers
                    excluded).
                  </div>
                </div>
                <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                  {detailDialog.monthly?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={detailDialog.monthly}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fill: "#475569", fontSize: 12 }}
                          tickFormatter={(v) => compactCurrency(Number(v))}
                        />
                        <Tooltip
                          formatter={(value) => currency(Number(value))}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar
                          dataKey="total"
                          name="Total"
                          fill="#ef4444"
                          radius={[6, 6, 4, 4]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-500">
                      No monthly breakdown available.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      {detailDialog.subtitle}
                    </p>
                    <p className="font-semibold text-slate-900">
                      {currency(detailDialog.total)}
                    </p>
                    <p className="text-xs text-slate-600">
                      {detailDialog.txCount} transactions
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                    This is grouped by transaction description (good for
                    spotting recurring sources and merchants).
                  </div>
                </div>
                <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={detailDialog.monthly}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: "#475569", fontSize: 12 }}
                        tickFormatter={(v) => compactCurrency(Number(v))}
                      />
                      <Tooltip
                        formatter={(value) => currency(Number(value))}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar
                        dataKey="total"
                        name="Total"
                        fill="#334155"
                        radius={[6, 6, 4, 4]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      ) : null} */}
    </MotionPage>
  );
};

export default Reports;
