import React, { useEffect, useState } from "react";

import {
  fetchYearlyCategoryDetail,
  fetchYearlyOverview,
} from "@/services/reports";
import type {
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
} from "@/types/api";
import { CategoryConcentrationCard } from "../components/category-concentration-card";
import { ReportsOverviewCard } from "../components/reports-overview-card";
import { YearlyAccountFlowsCard } from "../components/yearly-account-flows-card";
import { YearlyCategoryBreakdownCard } from "../components/yearly-category-breakdown-card";
import { YearlyCategoryDetailDialog } from "../components/yearly-category-detail-dialog";
import { YearlyCategoryHeatmapCard } from "../components/yearly-category-heatmap-card";
import { YearlyDebtCard } from "../components/yearly-debt-card";
import { YearlyDetailDialog } from "../components/yearly-detail-dialog";
import { YearlyDriversGrid } from "../components/yearly-drivers-grid";
import { YearlyExtraDialog } from "../components/yearly-extra-dialog";
import { YearlyIncomeExpenseCard } from "../components/yearly-income-expense-card";
import { YearlyInvestmentsSummaryCard } from "../components/yearly-investments-summary-card";
import { YearlyNetWorthGrowthCard } from "../components/yearly-net-worth-growth-card";
import { YearlySavingsRateCard } from "../components/yearly-savings-rate-card";
import { YearlySourcesGrid } from "../components/yearly-sources-grid";
import { YearlySummaryCard } from "../components/yearly-summary-card";
import { YearlyTransactionsAndChangesRow } from "../components/yearly-transactions-and-changes-row";
import { useYearlyAnalysis } from "../hooks/use-yearly-analysis";
import { MoneyFlowSankeyCard } from "../reports-sankey";
import type {
  DetailDialogState,
  YearlyExtraDialogState,
} from "../reports-types";
import { monthLabel } from "../reports-utils";

type YearlyReportsPageProps = {
  token: string | null;
  year: number;
};

export const YearlyReportsPage: React.FC<YearlyReportsPageProps> = ({
  token,
  year,
}) => {
  const [overview, setOverview] = useState<YearlyOverviewResponse | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [prevOverview, setPrevOverview] =
    useState<YearlyOverviewResponse | null>(null);
  const [prevOverviewLoading, setPrevOverviewLoading] = useState(false);

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
    expenseCategoryConcentration,
    incomeCategoryConcentration,
  } = useYearlyAnalysis({
    overview,
    prevOverview,
    year,
  });

  useEffect(() => {
    const loadOverview = async () => {
      if (!token) return;
      setOverviewLoading(true);
      try {
        const { data } = await fetchYearlyOverview({ year, token });
        setOverview(data);
      } catch (error) {
        console.error(error);
        setOverview(null);
      } finally {
        setOverviewLoading(false);
      }
    };

    void loadOverview();
  }, [token, year]);

  useEffect(() => {
    const loadPrevOverview = async () => {
      if (!token) return;
      if (year <= 1900) {
        setPrevOverview(null);
        return;
      }
      setPrevOverviewLoading(true);
      try {
        const { data } = await fetchYearlyOverview({ year: year - 1, token });
        setPrevOverview(data);
      } catch (error) {
        console.error(error);
        setPrevOverview(null);
      } finally {
        setPrevOverviewLoading(false);
      }
    };

    void loadPrevOverview();
  }, [token, year]);

  useEffect(() => {
    const loadCategoryDetail = async () => {
      if (!token) return;
      if (!selectedCategoryId) return;
      setCategoryDetailLoading(true);
      setCategoryDetail(null);
      try {
        const { data } = await fetchYearlyCategoryDetail({
          year,
          categoryId: selectedCategoryId,
          flow: selectedCategoryFlow,
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

  const openDetailDialog = (state: DetailDialogState) => {
    setDetailDialog(state);
    setDetailDialogOpen(true);
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
    <>
      <ReportsOverviewCard
        routeMode="yearly"
        year={year}
        overview={overview}
        totalKpis={null}
      />

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

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <YearlyCategoryBreakdownCard
            flow="expense"
            loading={overviewLoading}
            rows={categoryChartData}
            onSelectCategory={(categoryId) => {
              setSelectedCategoryFlow("expense");
              setSelectedCategoryId(categoryId);
            }}
          />
        </div>

        <CategoryConcentrationCard
          flow="expense"
          title="Category concentration"
          description="Top categories and overall balance."
          loading={overviewLoading}
          concentration={expenseCategoryConcentration}
        />

        <div className="lg:col-span-3">
          <YearlyCategoryHeatmapCard
            title="Spending heatmap"
            description="Seasonality by category and month."
            year={year}
            hasOverview={Boolean(overview)}
            heatmap={heatmap}
            color="expense"
          />
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <YearlyCategoryBreakdownCard
            flow="income"
            loading={overviewLoading}
            rows={incomeCategoryChartData}
            onSelectCategory={(categoryId) => {
              setSelectedCategoryFlow("income");
              setSelectedCategoryId(categoryId);
            }}
          />
        </div>

        <CategoryConcentrationCard
          flow="income"
          title="Category concentration"
          description="Top categories and overall balance."
          loading={overviewLoading}
          concentration={incomeCategoryConcentration}
        />

        <div className="lg:col-span-3">
          <YearlyCategoryHeatmapCard
            title="Income heatmap"
            description="Seasonality by category and month."
            year={year}
            hasOverview={Boolean(overview)}
            heatmap={incomeHeatmap}
            color="income"
          />
        </div>
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
  );
};
