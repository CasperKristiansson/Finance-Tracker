export {
  compactCurrency,
  currency,
  formatDate,
  formatDateTime,
  monthAndYear,
  monthLabel,
  monthName,
  percent,
} from "@/lib/format";

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

export const medianAbsoluteDeviation = (values: number[], center?: number) => {
  if (!values.length) return 0;
  const mid = typeof center === "number" ? center : median(values);
  const deviations = values.map((v) => Math.abs(v - mid));
  return median(deviations);
};

export const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) return "";
  const raw = String(value);
  if (/["\n,]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
};

export const downloadCsv = (
  filename: string,
  rows: Array<Record<string, unknown>>,
) => {
  if (!rows.length) return;
  const headers = Array.from(
    rows.reduce((acc, row) => {
      Object.keys(row).forEach((key) => acc.add(key));
      return acc;
    }, new Set<string>()),
  );
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

export const heatColor = (rgb: string, value: number, max: number) => {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(max) ||
    max <= 0 ||
    value <= 0
  ) {
    return "rgba(148,163,184,0.08)";
  }
  const intensity = Math.min(1, value / max);
  const alpha = 0.08 + intensity * 0.45;
  return `rgba(${rgb},${alpha.toFixed(3)})`;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
