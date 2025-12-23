import { useMemo } from "react";

import type { TotalOverviewResponse } from "@/types/api";

import { formatDate, monthLabel } from "../reports-utils";

type TotalWindowPreset = "all" | "10" | "5" | "3";
type TotalWindowRange = { start: string; end: string } | null;

type MixCategory = {
  category_id?: string | null;
  name: string;
  total: string;
  color_hex?: string | null;
};

type MixYearRow = { year: number; categories: MixCategory[] };

type Composition = {
  years: number[];
  keys: string[];
  colors: Record<string, string>;
  ids: Record<string, string | null>;
  totalsByYear: Record<number, number>;
  amountByYear: Record<number, Record<string, number>>;
  data: Array<Record<string, number | string>>;
};

const DEFAULT_CHART_COLOR = "#94a3b8";
const DEFAULT_CATEGORY_COLOR = "#94a3b8";

const MIX_FALLBACK_PALETTE_EXPENSE = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
] as const;

const MIX_FALLBACK_PALETTE_INCOME = [
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#ec4899",
] as const;

const shouldUseProvidedCategoryColor = (
  colorHex: string | null | undefined,
) => {
  if (!colorHex) return false;
  const normalized = colorHex.trim().toLowerCase();
  return normalized !== DEFAULT_CATEGORY_COLOR;
};

function categoryAbsTotal(category: MixCategory) {
  return Math.abs(Number(category.total));
}

const buildComposition = (
  rows: MixYearRow[],
  fallbackColor: string,
): Composition | null => {
  if (!rows.length) return null;
  const years = rows.map((row) => row.year);

  const totalByName = new Map<string, number>();
  rows.forEach((row) => {
    row.categories.forEach((cat) => {
      if (cat.name === "Other") return;
      const prev = totalByName.get(cat.name) ?? 0;
      totalByName.set(cat.name, prev + Math.abs(Number(cat.total)));
    });
  });

  const topNames = Array.from(totalByName.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([name]) => name);

  const keys = [...topNames, "Other"];

  const colors: Record<string, string> = { Other: DEFAULT_CHART_COLOR };
  const ids: Record<string, string | null> = { Other: null };

  keys.forEach((key) => {
    if (key === "Other") return;
    for (let idx = rows.length - 1; idx >= 0; idx -= 1) {
      const match = rows[idx]?.categories.find((cat) => cat.name === key);
      if (!match) continue;
      colors[key] = match.color_hex ?? fallbackColor;
      ids[key] = match.category_id ?? null;
      break;
    }
    if (!colors[key]) colors[key] = fallbackColor;
    if (!(key in ids)) ids[key] = null;
  });

  const totalsByYear: Record<number, number> = {};
  const amountByYear: Record<number, Record<string, number>> = {};

  rows.forEach((row) => {
    const yearTotal = row.categories.reduce(
      (sum, cat) => sum + Math.abs(Number(cat.total)),
      0,
    );
    totalsByYear[row.year] = yearTotal;

    const bucket: Record<string, number> = {};
    let knownSum = 0;
    keys.forEach((key) => {
      if (key === "Other") return;
      const match = row.categories.find((c) => c.name === key);
      const amount = match ? Math.abs(Number(match.total)) : 0;
      bucket[key] = amount;
      knownSum += amount;
    });

    const otherMatch = row.categories.find((c) => c.name === "Other");
    const otherAmount = otherMatch
      ? Math.abs(Number(otherMatch.total))
      : Math.max(0, yearTotal - knownSum);
    bucket.Other = otherAmount;

    amountByYear[row.year] = bucket;
  });

  const data = rows.map((row) => {
    const yearTotal = totalsByYear[row.year] ?? 0;
    const base: Record<string, number | string> = { year: row.year };
    keys.forEach((key) => {
      const amount = amountByYear[row.year]?.[key] ?? 0;
      base[key] = yearTotal > 0 ? (amount / yearTotal) * 100 : 0;
    });
    return base;
  });

  return { years, keys, colors, ids, totalsByYear, amountByYear, data };
};

export const useTotalAnalysis = ({
  totalOverview,
  totalWindowPreset,
}: {
  totalOverview: TotalOverviewResponse | null;
  totalWindowPreset: TotalWindowPreset;
}) => {
  const totalAllRange = useMemo<TotalWindowRange>(() => {
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

  const totalWindowRange = useMemo<TotalWindowRange>(() => {
    if (!totalAllRange) return null;
    if (totalWindowPreset === "all") return totalAllRange;
    const asOfYear = Number(totalAllRange.end.slice(0, 4));
    const minYear = Number(totalAllRange.start.slice(0, 4));
    const yearsBack = Number(totalWindowPreset);
    const startYear = Math.max(minYear, asOfYear - yearsBack + 1);
    return { start: `${startYear}-01-01`, end: totalAllRange.end };
  }, [totalAllRange, totalWindowPreset]);

  const totalKpis = useMemo(() => {
    if (!totalOverview) return null;
    const kpis = totalOverview.kpis;
    const netWorth = Number(kpis.net_worth);
    const cashBalance = Number(kpis.cash_balance);
    const debtTotal = Number(kpis.debt_total);
    const investmentsValue = kpis.investments_value
      ? Number(kpis.investments_value)
      : null;
    return {
      netWorth,
      cashBalance,
      debtTotal,
      investmentsValue,
      totalMoney: cashBalance + (investmentsValue ?? 0) - debtTotal,
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
      label: formatDate(row.date, {
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

  const totalExpenseComposition = useMemo(() => {
    if (!totalOverview) return null;
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    const rows = totalOverview.expense_category_mix_by_year
      .filter((row) => (windowStartYear ? row.year >= windowStartYear : true))
      .sort((a, b) => a.year - b.year);
    return buildComposition(rows as MixYearRow[], "#ef4444");
  }, [totalOverview, totalWindowRange]);

  const totalIncomeComposition = useMemo(() => {
    if (!totalOverview) return null;
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    const rows = totalOverview.income_category_mix_by_year
      .filter((row) => (windowStartYear ? row.year >= windowStartYear : true))
      .sort((a, b) => a.year - b.year);
    return buildComposition(rows as MixYearRow[], "#10b981");
  }, [totalOverview, totalWindowRange]);

  const totalYearly = useMemo(() => {
    if (!totalOverview) return [];
    const windowStartYear = totalWindowRange
      ? Number(totalWindowRange.start.slice(0, 4))
      : null;
    return totalOverview.yearly
      .filter((row) => (windowStartYear ? row.year >= windowStartYear : true))
      .sort((a, b) => a.year - b.year)
      .map((row) => ({
        year: row.year,
        income: Number(row.income),
        expense: Number(row.expense),
        net: Number(row.net),
        savingsRate: row.savings_rate_pct ? Number(row.savings_rate_pct) : null,
      }));
  }, [totalOverview, totalWindowRange]);

  const totalYearlyTable = useMemo(
    () => [...totalYearly].sort((a, b) => b.year - a.year),
    [totalYearly],
  );

  const totalExpenseMix = useMemo(() => {
    if (!totalOverview)
      return { data: [], keys: [], colors: {} as Record<string, string> };
    const startYear = new Date(totalOverview.as_of).getUTCFullYear() - 5;
    const rows = totalOverview.expense_category_mix_by_year
      .filter((row) => row.year >= startYear)
      .sort((a, b) => a.year - b.year);
    if (!rows.length)
      return { data: [], keys: [], colors: {} as Record<string, string> };
    const latest = rows[rows.length - 1];
    const sortedCats = [...latest.categories].sort(
      (a, b) => categoryAbsTotal(b) - categoryAbsTotal(a),
    );
    const top = sortedCats.filter((c) => c.name !== "Other").slice(0, 7);
    const keys = [...top.map((c) => c.name), "Other"];
    const colors: Record<string, string> = {};
    top.forEach((cat, idx) => {
      colors[cat.name] = shouldUseProvidedCategoryColor(cat.color_hex)
        ? (cat.color_hex as string).trim()
        : MIX_FALLBACK_PALETTE_EXPENSE[
            idx % MIX_FALLBACK_PALETTE_EXPENSE.length
          ];
    });
    colors.Other = DEFAULT_CHART_COLOR;
    const data = rows.map((row) => {
      const yearTotal = row.categories.reduce(
        (sum, category) => sum + categoryAbsTotal(category),
        0,
      );
      const base: Record<string, number | string> = { year: row.year };
      let shownAmount = 0;
      keys.forEach((key) => {
        if (key === "Other") return;
        const match = row.categories.find((c) => c.name === key);
        const amount = match ? categoryAbsTotal(match) : 0;
        shownAmount += amount;
        base[key] = yearTotal > 0 ? (amount / yearTotal) * 100 : 0;
      });

      const otherAmount = Math.max(0, yearTotal - shownAmount);
      base.Other = yearTotal > 0 ? (otherAmount / yearTotal) * 100 : 0;
      return base;
    });
    return { data, keys, colors };
  }, [totalOverview]);

  const totalIncomeMix = useMemo(() => {
    if (!totalOverview)
      return { data: [], keys: [], colors: {} as Record<string, string> };
    const startYear = new Date(totalOverview.as_of).getUTCFullYear() - 5;
    const rows = totalOverview.income_category_mix_by_year
      .filter((row) => row.year >= startYear)
      .sort((a, b) => a.year - b.year);
    if (!rows.length)
      return { data: [], keys: [], colors: {} as Record<string, string> };
    const latest = rows[rows.length - 1];
    const sortedCats = [...latest.categories].sort(
      (a, b) => categoryAbsTotal(b) - categoryAbsTotal(a),
    );
    const top = sortedCats.filter((c) => c.name !== "Other").slice(0, 7);
    const keys = [...top.map((c) => c.name), "Other"];
    const colors: Record<string, string> = {};
    top.forEach((cat, idx) => {
      colors[cat.name] = shouldUseProvidedCategoryColor(cat.color_hex)
        ? (cat.color_hex as string).trim()
        : MIX_FALLBACK_PALETTE_INCOME[idx % MIX_FALLBACK_PALETTE_INCOME.length];
    });
    colors.Other = DEFAULT_CHART_COLOR;
    const data = rows.map((row) => {
      const yearTotal = row.categories.reduce(
        (sum, category) => sum + categoryAbsTotal(category),
        0,
      );
      const base: Record<string, number | string> = { year: row.year };
      let shownAmount = 0;
      keys.forEach((key) => {
        if (key === "Other") return;
        const match = row.categories.find((c) => c.name === key);
        const amount = match ? categoryAbsTotal(match) : 0;
        shownAmount += amount;
        base[key] = yearTotal > 0 ? (amount / yearTotal) * 100 : 0;
      });

      const otherAmount = Math.max(0, yearTotal - shownAmount);
      base.Other = yearTotal > 0 ? (otherAmount / yearTotal) * 100 : 0;
      return base;
    });
    return { data, keys, colors };
  }, [totalOverview]);

  const totalInvestments = useMemo(() => {
    if (!totalOverview?.investments) return null;
    const series = totalOverview.investments.series.map((row) => ({
      date: row.date,
      value: Number(row.value),
    }));
    const yearly = totalOverview.investments.yearly
      .map((row) => ({
        year: row.year,
        endValue: Number(row.end_value),
        netContributions: Number(row.net_contributions),
        impliedReturn: row.implied_return ? Number(row.implied_return) : null,
      }))
      .sort((a, b) => b.year - a.year);
    const accounts = totalOverview.investments.accounts_latest
      .map((row) => ({
        name: row.account_name,
        value: Number(row.value),
      }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
    return { series, yearly, accounts };
  }, [totalOverview]);

  const totalInvestmentsYearlyTable = useMemo(() => {
    if (!totalOverview?.investments) return [];
    return totalOverview.investments.yearly
      .map((row) => ({
        year: row.year,
        endValue: Number(row.end_value),
        netContributions: Number(row.net_contributions),
        impliedReturn: row.implied_return ? Number(row.implied_return) : null,
      }))
      .sort((a, b) => b.year - a.year);
  }, [totalOverview]);

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
        delta: Number(row.delta),
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [totalOverview]);

  const totalExpenseSourceChanges = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.expense_source_changes_yoy
      .map((row) => ({
        source: row.source,
        delta: Number(row.delta),
      }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  }, [totalOverview]);

  const totalAccountsOverview = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.accounts
      .map((row) => ({
        id: row.account_id,
        name: row.name,
        type: row.account_type,
        balance: Number(row.current_balance),
        netOperating: Number(row.net_operating),
        netTransfers: Number(row.net_transfers),
        firstDate: row.first_transaction_date ?? null,
      }))
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
  }, [totalOverview]);

  const totalDebtSeries = useMemo(() => {
    if (!totalOverview) return [];
    return totalOverview.debt.series.map((row) => ({
      date: row.date,
      debt: Number(row.debt),
    }));
  }, [totalOverview]);

  const totalDebtSeriesWindowed = useMemo(() => {
    if (!totalWindowRange) return totalDebtSeries;
    return totalDebtSeries.filter(
      (row) =>
        row.date >= totalWindowRange.start && row.date <= totalWindowRange.end,
    );
  }, [totalDebtSeries, totalWindowRange]);

  const totalMoneySeries = useMemo(() => {
    if (!totalNetWorthSeries.length) return [];
    const debtByDate = new Map(
      totalDebtSeriesWindowed.map((row) => [row.date, row.debt]),
    );
    return totalNetWorthSeries.map((row) => {
      const debt = debtByDate.get(row.date);
      return {
        date: row.date,
        totalMoney: row.netWorth,
        debt: debt ?? null,
        assets: debt === undefined ? row.netWorth : row.netWorth + debt,
      };
    });
  }, [totalDebtSeriesWindowed, totalNetWorthSeries]);

  const totalMoneySnapshot = useMemo(() => {
    if (!totalKpis) return null;
    return {
      asOf: totalOverview?.as_of ?? null,
      total: totalKpis.totalMoney,
      debt: totalKpis.debtTotal,
    };
  }, [totalKpis, totalOverview]);

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
    if (!totalOverview) return null;
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
  }, [totalMonthlyIncomeExpense, totalWindowRange, totalOverview]);

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

  return {
    totalAllRange,
    totalWindowRange,
    totalKpis,
    totalNetWorthSeries,
    totalNetWorthStats,
    totalMonthlyIncomeExpense,
    totalNetWorthAttribution,
    totalNetWorthTrajectoryData,
    totalNetWorthTrajectoryDomain,
    totalExpenseComposition,
    totalIncomeComposition,
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
    totalMoneySeries,
    totalMoneySnapshot,
    totalDebtAccounts,
    totalSeasonalityHeatmaps,
    totalExpenseCategoryYearHeatmap,
    totalIncomeCategoryYearHeatmap,
  };
};
