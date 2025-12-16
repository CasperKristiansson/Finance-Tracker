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
import { TotalDebtOverviewCard } from "./components/total-debt-overview-card";
import { TotalDrilldownDialog } from "./components/total-drilldown-dialog";
import { TotalHeatmapDialog } from "./components/total-heatmap-dialog";
import { TotalInvestmentsSnapshotCard } from "./components/total-investments-snapshot-card";
import { TotalLifetimeCategoriesCard } from "./components/total-lifetime-categories-card";
import { TotalNetWorthGrowthCard } from "./components/total-net-worth-growth-card";
import { TotalNetWorthTrajectoryCard } from "./components/total-net-worth-trajectory-card";
import { TotalSeasonalityCard } from "./components/total-seasonality-card";
import { TotalSourcesCard } from "./components/total-sources-card";
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
import { useTotalAnalysis } from "./hooks/use-total-analysis";
import { useYearlyAnalysis } from "./hooks/use-yearly-analysis";
import { MoneyFlowSankeyCard } from "./reports-sankey";
import type {
  DetailDialogState,
  ReportMode,
  TotalDrilldownState,
  TotalHeatmapDialogState,
  YearlyExtraDialogState,
} from "./reports-types";
import { monthLabel } from "./reports-utils";

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

  const {
    totalWindowRange,
    totalKpis,
    totalNetWorthSeries,
    totalNetWorthStats,
    totalNetWorthAttribution,
    totalNetWorthTrajectoryData,
    totalNetWorthTrajectoryDomain,
    totalYearly,
    totalYearlyTable,
    totalExpenseMix,
    totalIncomeMix,
    totalInvestments,
    totalInvestmentsYearlyTable,
    totalExpenseCategoriesLifetime,
    totalIncomeCategoriesLifetime,
    totalExpenseCategoryChanges,
    totalIncomeCategoryChanges,
    totalIncomeSourcesLifetime,
    totalExpenseSourcesLifetime,
    totalIncomeSourceChanges,
    totalExpenseSourceChanges,
    totalAccountsOverview,
    totalDebtSeries,
    totalDebtAccounts,
    totalSeasonalityHeatmaps,
    totalExpenseCategoryYearHeatmap,
    totalIncomeCategoryYearHeatmap,
  } = useTotalAnalysis({
    totalOverview: isTotalRoute ? totalOverview : null,
    totalWindowPreset,
  });

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

  const {
    categoryChartData,
    heatmap,
    incomeCategoryChartData,
    incomeHeatmap,
    incomeSourceRows,
    expenseSourceRows,
    prevIncomeSourceRows,
    prevExpenseSourceRows,
    yearlyExpenseCategoryDeltas,
    yearlyIncomeCategoryDeltas,
    yearlyExpenseSourceDeltas,
    yearlyIncomeSourceDeltas,
    yearlySavingsDecomposition,
  } = useYearlyAnalysis({
    overview: isYearlyRoute ? overview : null,
    prevOverview: isYearlyRoute ? prevOverview : null,
    year,
  });

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
            />

            <YearlyNetWorthGrowthCard
              year={year}
              loading={overviewLoading}
              series={overview?.net_worth ?? null}
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
              debtSeries={overview?.debt ?? null}
              debtOverview={overview?.debt_overview ?? null}
              onOpenDetailDialog={openDetailDialog}
            />

            <YearlySavingsRateCard savings={overview?.savings} />

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
              overview={overview}
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
            overview={overview}
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
            selectedCategoryId={selectedCategoryId}
            year={year}
            prevOverview={prevOverview}
            categoryDetailLoading={categoryDetailLoading}
            categoryDetail={categoryDetail}
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
    </MotionPage>
  );
};

export default Reports;
