import React, { useEffect, useState } from "react";

import {
  isSyntheticInvestmentId,
  isSyntheticInvestmentLabel,
} from "@/lib/investment-growth";
import {
  fetchYearlyCategoryDetail,
  fetchYearlyOverviewRange,
} from "@/services/reports";
import type {
  YearlyCategoryDetailResponse,
  YearlyOverviewResponse,
} from "@/types/api";
import { CashflowVolatilityCard } from "../components/cashflow-volatility-card";
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
  includeInvestmentGrowth: boolean;
};

export const YearlyReportsPage: React.FC<YearlyReportsPageProps> = ({
  token,
  year,
  includeInvestmentGrowth,
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
    expenseCategoryConcentration,
    incomeCategoryConcentration,
    yearlyExpenseCategoryDeltas,
    yearlyIncomeCategoryDeltas,
    yearlyExpenseSourceDeltas,
    yearlyIncomeSourceDeltas,
    yearlySavingsDecomposition,
    yearlyCashflowVolatility,
  } = useYearlyAnalysis({
    overview,
    prevOverview,
    year,
    includeInvestmentGrowth,
  });

  useEffect(() => {
    const loadOverviewPair = async () => {
      if (!token) return;
      setOverviewLoading(true);
      setPrevOverviewLoading(true);
      try {
        const { data } = await fetchYearlyOverviewRange({
          startYear: year - 1,
          endYear: year,
          token,
        });
        const byYear = new Map(
          (data.items ?? []).map((item) => [item.year, item]),
        );
        setOverview(byYear.get(year) ?? null);
        setPrevOverview(year > 1900 ? (byYear.get(year - 1) ?? null) : null);
      } catch (error) {
        console.error(error);
        setOverview(null);
        setPrevOverview(null);
      } finally {
        setOverviewLoading(false);
        setPrevOverviewLoading(false);
      }
    };

    void loadOverviewPair();
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

  const openInvestmentsDetail = () => {
    if (!overview?.investments_summary) return;
    const summary = overview.investments_summary;
    openDetailDialog({
      kind: "investments",
      title: `Investments (${year})`,
      asOf: summary.as_of,
      monthly: summary.monthly_values.map((value, idx) => ({
        month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
        value: Number(value),
      })),
      accounts: summary.accounts.map((row) => ({
        name: row.account_name,
        start: Number(row.start_value),
        end: Number(row.end_value),
        change: Number(row.change),
      })),
      summary: {
        start: Number(summary.start_value),
        end: Number(summary.end_value),
        change: Number(summary.change),
        changePct: summary.change_pct ? Number(summary.change_pct) : null,
        contributions: Number(summary.contributions),
        withdrawals: Number(summary.withdrawals),
        marketGrowth: Number(summary.market_growth ?? 0),
      },
    });
  };

  const selectCategoryOrInvestment = (
    flow: "income" | "expense",
    categoryId: string,
  ) => {
    if (isSyntheticInvestmentId(categoryId)) {
      openInvestmentsDetail();
      return;
    }
    setSelectedCategoryFlow(flow);
    setSelectedCategoryId(categoryId);
  };

  const openYearlySourceDetail = (
    flow: "income" | "expense",
    source: string,
  ) => {
    if (isSyntheticInvestmentLabel(source)) {
      openInvestmentsDetail();
      return;
    }

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
        includeInvestmentGrowth={includeInvestmentGrowth}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <YearlyIncomeExpenseCard
          year={year}
          overview={overview}
          overviewLoading={overviewLoading}
          includeInvestmentGrowth={includeInvestmentGrowth}
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

      <div className="grid gap-3 lg:grid-cols-2">
        <YearlyDebtCard
          year={year}
          loading={overviewLoading}
          debtSeries={overview?.debt ?? null}
          debtOverview={overview?.debt_overview ?? null}
          onOpenDetailDialog={openDetailDialog}
        />
        <YearlySummaryCard year={year} overview={overview} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CashflowVolatilityCard
          title="Cashflow stability"
          description={`Monthly volatility for income, expense, and net in ${year}.`}
          loading={overviewLoading}
          volatility={yearlyCashflowVolatility}
        />

        <YearlySavingsRateCard savings={overview?.savings ?? null} />
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
        onSelectCategory={selectCategoryOrInvestment}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <YearlyCategoryBreakdownCard
          flow="expense"
          loading={overviewLoading}
          rows={categoryChartData}
          onSelectCategory={(categoryId) =>
            selectCategoryOrInvestment("expense", categoryId)
          }
        />

        <YearlyCategoryHeatmapCard
          title="Spending heatmap"
          description="Seasonality by category and month."
          year={year}
          hasOverview={Boolean(overview)}
          heatmap={heatmap}
          color="expense"
          onSelectSyntheticCategory={(categoryId) =>
            selectCategoryOrInvestment("expense", categoryId)
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <YearlyCategoryBreakdownCard
          flow="income"
          loading={overviewLoading}
          rows={incomeCategoryChartData}
          onSelectCategory={(categoryId) =>
            selectCategoryOrInvestment("income", categoryId)
          }
        />

        <YearlyCategoryHeatmapCard
          title="Income heatmap"
          description="Seasonality by category and month."
          year={year}
          hasOverview={Boolean(overview)}
          heatmap={incomeHeatmap}
          color="income"
          onSelectSyntheticCategory={(categoryId) =>
            selectCategoryOrInvestment("income", categoryId)
          }
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <CategoryConcentrationCard
          flow="expense"
          loading={overviewLoading}
          hasOverview={Boolean(overview)}
          concentration={expenseCategoryConcentration}
        />

        <CategoryConcentrationCard
          flow="income"
          loading={overviewLoading}
          hasOverview={Boolean(overview)}
          concentration={incomeCategoryConcentration}
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
          selectCategoryOrInvestment("expense", categoryId);
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
        onSelectCategory={selectCategoryOrInvestment}
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
