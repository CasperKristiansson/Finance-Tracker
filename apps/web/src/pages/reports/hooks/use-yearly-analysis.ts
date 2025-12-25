import { useMemo } from "react";

import type { YearlyOverviewResponse } from "@/types/api";

import { buildCategoryConcentration, monthLabel } from "../reports-utils";

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
    () => buildCategoryConcentration(categoryChartData, 3),
    [categoryChartData],
  );

  const incomeCategoryConcentration = useMemo(
    () => buildCategoryConcentration(incomeCategoryChartData, 3),
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

  return {
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
  };
};
