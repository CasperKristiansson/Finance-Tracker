import React, { useEffect, useState } from "react";

import {
  fetchCustomReport,
  fetchTotalOverview,
  fetchYearlyOverview,
} from "@/services/reports";
import type {
  TotalOverviewResponse,
  YearlyOverviewResponse,
} from "@/types/api";

import { ReportsOverviewCard } from "../components/reports-overview-card";
import { TotalAccountsOverviewCard } from "../components/total-accounts-overview-card";
import { TotalCategoryByYearCard } from "../components/total-category-by-year-card";
import { TotalCategoryChangesCard } from "../components/total-category-changes-card";
import { TotalCategoryMixCard } from "../components/total-category-mix-card";
import { TotalDebtOverviewCard } from "../components/total-debt-overview-card";
import { TotalDrilldownDialog } from "../components/total-drilldown-dialog";
import { TotalHeatmapDialog } from "../components/total-heatmap-dialog";
import { TotalInvestmentsSnapshotCard } from "../components/total-investments-snapshot-card";
import { TotalLifetimeCategoriesCard } from "../components/total-lifetime-categories-card";
import { TotalNetWorthGrowthCard } from "../components/total-net-worth-growth-card";
import { TotalNetWorthTrajectoryCard } from "../components/total-net-worth-trajectory-card";
import { TotalSeasonalityCard } from "../components/total-seasonality-card";
import { TotalSourcesCard } from "../components/total-sources-card";
import { TotalYearByYearPerformanceCard } from "../components/total-year-by-year-performance-card";
import { useTotalAnalysis } from "../hooks/use-total-analysis";
import { MoneyFlowSankeyCard } from "../reports-sankey";
import type {
  ReportMode,
  TotalDrilldownState,
  TotalHeatmapDialogState,
} from "../reports-types";

type MonthReportResult = {
  period: string;
  income: number;
  expense: number;
  net: number;
};

type TotalReportsPageProps = {
  token: string | null;
  year: number;
  totalWindowPreset: "all" | "10" | "5" | "3";
};

export const TotalReportsPage: React.FC<TotalReportsPageProps> = ({
  token,
  year,
  totalWindowPreset,
}) => {
  const routeMode: ReportMode = "total";
  const [totalOverview, setTotalOverview] =
    useState<TotalOverviewResponse | null>(null);
  const [totalOverviewLoading, setTotalOverviewLoading] = useState(false);

  const [totalDrilldown, setTotalDrilldown] =
    useState<TotalDrilldownState | null>(null);
  const [totalDrilldownOpen, setTotalDrilldownOpen] = useState(false);
  const [totalDrilldownLoading, setTotalDrilldownLoading] = useState(false);
  const [totalDrilldownError, setTotalDrilldownError] = useState<string | null>(
    null,
  );
  const [totalDrilldownSeries, setTotalDrilldownSeries] = useState<
    Array<MonthReportResult>
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

  useEffect(() => {
    const loadTotalOverview = async () => {
      if (!token) return;
      setTotalOverviewLoading(true);
      try {
        const { data } = await fetchTotalOverview({ token });
        setTotalOverview(data);
      } catch (error) {
        console.error(error);
        setTotalOverview(null);
      } finally {
        setTotalOverviewLoading(false);
      }
    };
    void loadTotalOverview();
  }, [token]);

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
    totalOverview,
    totalWindowPreset,
  });

  useEffect(() => {
    const loadDrilldown = async () => {
      if (!token) return;
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

        const { data } = await fetchCustomReport({
          token,
          query: {
            start_date: totalWindowRange.start,
            end_date: totalWindowRange.end,
            ...(accountIds ? { account_ids: accountIds } : {}),
            ...(categoryIds ? { category_ids: categoryIds } : {}),
            ...(source ? { source } : {}),
          },
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
  }, [token, totalDrilldown, totalDrilldownOpen, totalWindowRange]);

  useEffect(() => {
    const loadYearDrilldown = async () => {
      if (!token) return;
      if (!totalDrilldownOpen) return;
      if (!totalDrilldown || totalDrilldown.kind !== "year") return;

      setTotalYearDrilldownLoading(true);
      setTotalYearDrilldownError(null);
      setTotalYearDrilldown(null);

      try {
        const { data } = await fetchYearlyOverview({
          year: totalDrilldown.year,
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
  }, [token, totalDrilldown, totalDrilldownOpen]);

  const openTotalDrilldownDialog = (state: TotalDrilldownState) => {
    setTotalDrilldown(state);
    setTotalDrilldownOpen(true);
  };

  const openTotalHeatmapDialog = (state: TotalHeatmapDialogState) => {
    setTotalHeatmapDialog(state);
    setTotalHeatmapDialogOpen(true);
  };

  const totalOverviewLoaded = Boolean(totalOverview);
  const hasNetWorthHistory = totalNetWorthSeries.length > 0;

  return (
    <>
      <ReportsOverviewCard
        routeMode={routeMode}
        year={year}
        overview={null}
        totalKpis={totalKpis}
      />

      <div className="grid gap-3">
        <TotalNetWorthTrajectoryCard
          loading={totalOverviewLoading}
          data={totalNetWorthTrajectoryData}
          domain={totalNetWorthTrajectoryDomain}
        />

        <TotalNetWorthGrowthCard
          loading={totalOverviewLoading}
          totalWindowPreset={totalWindowPreset}
          hasOverview={totalOverviewLoaded}
          hasNetWorthHistory={hasNetWorthHistory}
          netWorthStats={totalNetWorthStats}
          netWorthAttribution={totalNetWorthAttribution}
          onOpenDrilldownDialog={openTotalDrilldownDialog}
        />

        <TotalYearByYearPerformanceCard
          loading={totalOverviewLoading}
          hasOverview={totalOverviewLoaded}
          bestYear={
            totalOverview?.best_year ? Number(totalOverview.best_year) : null
          }
          worstYear={
            totalOverview?.worst_year ? Number(totalOverview.worst_year) : null
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
          totalOverviewLoaded={totalOverviewLoaded}
          heatmaps={totalSeasonalityHeatmaps}
          onOpenHeatmapDialog={openTotalHeatmapDialog}
        />

        <TotalSeasonalityCard
          flow="expense"
          totalOverviewLoaded={totalOverviewLoaded}
          heatmaps={totalSeasonalityHeatmaps}
          onOpenHeatmapDialog={openTotalHeatmapDialog}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TotalCategoryByYearCard
          flow="expense"
          totalOverviewLoaded={totalOverviewLoaded}
          heatmap={totalExpenseCategoryYearHeatmap}
          yearlyTotals={totalYearly}
          onOpenDrilldownDialog={openTotalDrilldownDialog}
          onOpenHeatmapDialog={openTotalHeatmapDialog}
        />

        <TotalCategoryByYearCard
          flow="income"
          totalOverviewLoaded={totalOverviewLoaded}
          heatmap={totalIncomeCategoryYearHeatmap}
          yearlyTotals={totalYearly}
          onOpenDrilldownDialog={openTotalDrilldownDialog}
          onOpenHeatmapDialog={openTotalHeatmapDialog}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TotalInvestmentsSnapshotCard
          hasOverview={totalOverviewLoaded}
          investments={totalInvestments}
          investmentsYearlyTable={totalInvestmentsYearlyTable}
          onOpenDrilldownDialog={openTotalDrilldownDialog}
        />

        <TotalDebtOverviewCard
          hasOverview={totalOverviewLoaded}
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
        hasOverview={totalOverviewLoaded}
        rows={totalAccountsOverview}
        onOpenDrilldownDialog={openTotalDrilldownDialog}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <TotalSourcesCard
          flow="income"
          hasOverview={totalOverviewLoaded}
          sources={totalIncomeSourcesLifetime}
          changes={totalIncomeSourceChanges}
          onOpenDrilldownDialog={openTotalDrilldownDialog}
        />

        <TotalSourcesCard
          flow="expense"
          hasOverview={totalOverviewLoaded}
          sources={totalExpenseSourcesLifetime}
          changes={totalExpenseSourceChanges}
          onOpenDrilldownDialog={openTotalDrilldownDialog}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TotalLifetimeCategoriesCard
          flow="expense"
          hasOverview={totalOverviewLoaded}
          rows={totalExpenseCategoriesLifetime}
          onOpenDrilldownDialog={openTotalDrilldownDialog}
        />

        <TotalCategoryMixCard
          title="Expense mix (last 6 years)"
          description="Share of expenses by category (top + other)."
          hasOverview={totalOverviewLoaded}
          data={totalExpenseMix.data}
          keys={totalExpenseMix.keys}
          colors={totalExpenseMix.colors}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TotalLifetimeCategoriesCard
          flow="income"
          hasOverview={totalOverviewLoaded}
          rows={totalIncomeCategoriesLifetime}
          onOpenDrilldownDialog={openTotalDrilldownDialog}
        />

        <TotalCategoryMixCard
          title="Income mix (last 6 years)"
          description="Share of income by category (top + other)."
          hasOverview={totalOverviewLoaded}
          data={totalIncomeMix.data}
          keys={totalIncomeMix.keys}
          colors={totalIncomeMix.colors}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TotalCategoryChangesCard
          flow="expense"
          hasOverview={totalOverviewLoaded}
          rows={totalExpenseCategoryChanges}
          onOpenDrilldownDialog={openTotalDrilldownDialog}
        />

        <TotalCategoryChangesCard
          flow="income"
          hasOverview={totalOverviewLoaded}
          rows={totalIncomeCategoryChanges}
          onOpenDrilldownDialog={openTotalDrilldownDialog}
        />
      </div>

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
    </>
  );
};
