import { useMemo } from "react";

import type { YearlyOverviewResponse } from "@/types/api";

import type {
  CashflowVolatilityMetric,
  CashflowVolatilitySummary,
} from "../reports-types";
import { computeCategoryConcentration, monthLabel } from "../reports-utils";

const volatilityStats = (values: number[]): CashflowVolatilityMetric => {
  if (!values.length) {
    return { mean: 0, stdDev: 0, cv: null };
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const meanAbs = Math.abs(mean);
  const cv = meanAbs > 0 ? stdDev / meanAbs : null;
  return { mean, stdDev, cv };
};

export const useYearlyAnalysis = ({
  overview,
  prevOverview,
  year,
}: {
  overview: YearlyOverviewResponse | null;
  prevOverview: YearlyOverviewResponse | null;
  year: number;
}) => {
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

  const expenseCategoryConcentration = useMemo(
    () => computeCategoryConcentration(categoryChartData),
    [categoryChartData],
  );

  const incomeCategoryConcentration = useMemo(
    () => computeCategoryConcentration(incomeCategoryChartData),
    [incomeCategoryChartData],
  );

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

  const yearlyCashflowVolatility =
    useMemo<CashflowVolatilitySummary | null>(() => {
      if (!overview?.monthly?.length) return null;
      const series = overview.monthly.map((row) => ({
        date: row.date,
        label: monthLabel(
          new Date(Date.UTC(year, row.month - 1, 1)).toISOString(),
        ),
        income: Number(row.income),
        expense: Number(row.expense),
        net: Number(row.net),
      }));

      const incomeValues = series.map((row) => row.income);
      const expenseValues = series.map((row) => row.expense);
      const netValues = series.map((row) => row.net);

      const income = volatilityStats(incomeValues);
      const expense = volatilityStats(expenseValues);
      const net = volatilityStats(netValues);

      const cvValues = [income.cv, expense.cv, net.cv].filter(
        (value): value is number =>
          typeof value === "number" && !Number.isNaN(value),
      );
      const avgCv =
        cvValues.length > 0
          ? cvValues.reduce((sum, value) => sum + value, 0) / cvValues.length
          : null;
      const stabilityScore =
        avgCv === null ? null : Math.max(0, 100 - Math.min(100, avgCv * 100));

      const spikeThreshold = 1.5;
      const spikes = series
        .map((row) => {
          const incomeZ =
            income.stdDev > 0 ? (row.income - income.mean) / income.stdDev : 0;
          const expenseZ =
            expense.stdDev > 0
              ? (row.expense - expense.mean) / expense.stdDev
              : 0;
          const netZ = net.stdDev > 0 ? (row.net - net.mean) / net.stdDev : 0;
          const absScores = [
            {
              kind: "income" as const,
              value: row.income,
              score: Math.abs(incomeZ),
            },
            {
              kind: "expense" as const,
              value: row.expense,
              score: Math.abs(expenseZ),
            },
            { kind: "net" as const, value: row.net, score: Math.abs(netZ) },
          ];
          const best = absScores.reduce((top, current) =>
            current.score > top.score ? current : top,
          );
          if (best.score < spikeThreshold) return null;
          return {
            date: row.date,
            label: row.label,
            kind: best.kind,
            value: best.value,
            zScore: best.score,
          };
        })
        .filter((row): row is NonNullable<typeof row> => Boolean(row))
        .sort((a, b) => b.zScore - a.zScore)
        .slice(0, 6);

      return {
        income,
        expense,
        net,
        stabilityScore,
        spikes,
      };
    }, [overview?.monthly, year]);

  return {
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
  };
};
