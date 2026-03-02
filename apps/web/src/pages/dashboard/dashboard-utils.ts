import type { MonthlyReportEntry } from "@/types/api";

export type KPI = {
  title: string;
  value: string;
  delta?: string;
  trend?: "up" | "down" | "neutral";
  helper?: string;
};

export type SavingsMonthStatus = "normal" | "no-income" | "no-activity";

export const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ROLLING_MONTH_COUNT = 12;

export type RollingMonthSlot = {
  year: number;
  monthIndex: number;
  monthKey: string;
  label: string;
};

const toMonthKey = (year: number, monthIndex: number) =>
  `${year}-${String(monthIndex + 1).padStart(2, "0")}`;

export const numberFromString = (value?: string): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrencyDelta = (
  value: number,
  formatCurrency: (value: number) => string,
) => {
  const sign = value >= 0 ? "+" : "-";
  return `${sign}${formatCurrency(Math.abs(value))}`;
};

export const buildRollingMonthSlots = (
  count = ROLLING_MONTH_COUNT,
  anchor = new Date(),
): RollingMonthSlot[] => {
  const anchorYear = anchor.getFullYear();
  const anchorMonth = anchor.getMonth();
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    const date = new Date(anchorYear, anchorMonth - offset, 1);
    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    return {
      year,
      monthIndex,
      monthKey: toMonthKey(year, monthIndex),
      label: `${MONTH_LABELS[monthIndex] ?? ""} ${String(year).slice(-2)}`,
    };
  });
};

const parsePeriodYearMonth = (period: string) => {
  const match = period.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (!Number.isFinite(year) || monthIndex < 0 || monthIndex > 11) {
    return null;
  }
  return { year, monthIndex };
};

const parsePeriodDate = (period: string) => {
  const normalized = period.includes("T") ? period : `${period}T00:00:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

export const getPeriodYear = (period: string) =>
  parsePeriodYearMonth(period)?.year ?? parsePeriodDate(period).getFullYear();

export const getPeriodMonthKey = (period: string) => {
  const parsed = parsePeriodYearMonth(period);
  if (parsed) return toMonthKey(parsed.year, parsed.monthIndex);
  const fallback = parsePeriodDate(period);
  return toMonthKey(fallback.getFullYear(), fallback.getMonth());
};

export const dedupeMonthlyEntries = (entries: MonthlyReportEntry[]) => {
  const byMonth = new Map<string, MonthlyReportEntry>();
  entries.forEach((entry) => {
    byMonth.set(getPeriodMonthKey(entry.period), entry);
  });
  return Array.from(byMonth.values()).sort((a, b) =>
    getPeriodMonthKey(a.period).localeCompare(getPeriodMonthKey(b.period)),
  );
};
