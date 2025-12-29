import React, { useMemo, useState } from "react";

import { EmptyState } from "@/components/composed/empty-state";
import { LoadingCard } from "@/components/composed/loading-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { TotalHeatmapDialogState } from "../reports-types";
import { currency, heatColor } from "../reports-utils";

type SeasonalityHeatmaps = {
  years: number[];
  months: string[];
  income: number[][];
  expense: number[][];
  maxIncome: number;
  maxExpense: number;
};

export const TotalSeasonalityCard: React.FC<{
  flow: "income" | "expense";
  totalOverviewLoaded: boolean;
  heatmaps: SeasonalityHeatmaps | null;
  onOpenHeatmapDialog: (state: TotalHeatmapDialogState) => void;
}> = ({ flow, totalOverviewLoaded, heatmaps, onOpenHeatmapDialog }) => {
  const [hover, setHover] = useState<{
    year: number;
    monthIndex: number;
    value: number;
  } | null>(null);

  const content = useMemo(() => {
    if (!heatmaps) return null;
    const matrix = flow === "income" ? heatmaps.income : heatmaps.expense;
    const max = flow === "income" ? heatmaps.maxIncome : heatmaps.maxExpense;
    const color = flow === "income" ? "16,185,129" : "239,68,68";
    return { matrix, max, color };
  }, [flow, heatmaps]);

  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {flow === "income"
            ? "Income seasonality (year × month)"
            : "Expense seasonality (year × month)"}
        </CardTitle>
        <p className="text-xs text-slate-500">
          {flow === "income"
            ? "Total income per month (all categories combined)."
            : "Total expense per month (all categories combined)."}
        </p>
      </CardHeader>
      <CardContent className="overflow-auto">
        {!totalOverviewLoaded ? (
          <LoadingCard className="h-56" lines={10} />
        ) : !heatmaps ? (
          <EmptyState className="h-56" title="No seasonality data yet." />
        ) : (
          <div
            className="min-w-[560px] space-y-3"
            onMouseLeave={() => setHover(null)}
          >
            <div className="grid grid-cols-[72px_repeat(12,minmax(28px,1fr))] gap-1 text-[11px] text-slate-600">
              <div />
              {heatmaps.months.map((label) => (
                <div key={label} className="text-center">
                  {label}
                </div>
              ))}
              {heatmaps.years.map((yr, yrIdx) => (
                <React.Fragment key={yr}>
                  <div className="pr-2 font-medium text-slate-700">{yr}</div>
                  {content?.matrix[yrIdx].map((value, idx) => (
                    <button
                      type="button"
                      key={`${yr}-${idx}`}
                      title={`${yr} ${heatmaps.months[idx]}: ${currency(value)}`}
                      aria-label={`${yr} ${heatmaps.months[idx]} ${flow} ${currency(value)}`}
                      className="h-7 rounded-sm border border-slate-100 transition hover:ring-1 hover:ring-slate-300 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                      style={{
                        backgroundColor: heatColor(
                          content?.color ?? "148,163,184",
                          value,
                          content?.max ?? 0,
                        ),
                      }}
                      onMouseEnter={() =>
                        setHover({ year: yr, monthIndex: idx, value })
                      }
                      onFocus={() =>
                        setHover({ year: yr, monthIndex: idx, value })
                      }
                      onClick={() => {
                        const yearValues = content?.matrix[yrIdx] ?? [];
                        const yearTotal = yearValues.reduce(
                          (sum, v) => sum + v,
                          0,
                        );
                        const monthAcrossYears = heatmaps.years.map(
                          (year, yearIdx) => ({
                            year,
                            value: content?.matrix[yearIdx][idx] ?? 0,
                          }),
                        );
                        const prevValue =
                          yrIdx > 0
                            ? (content?.matrix[yrIdx - 1][idx] ?? 0)
                            : null;
                        const yoyDelta =
                          prevValue === null ? null : value - prevValue;
                        const yoyDeltaPct =
                          prevValue === null || prevValue === 0
                            ? null
                            : ((value - prevValue) / prevValue) * 100;
                        const monthRank =
                          1 + yearValues.filter((v) => v > value).length;
                        const monthSharePct =
                          yearTotal > 0 ? (value / yearTotal) * 100 : null;
                        onOpenHeatmapDialog({
                          kind: "seasonality",
                          flow,
                          year: yr,
                          monthIndex: idx,
                          monthLabel: heatmaps.months[idx],
                          value,
                          yearValues,
                          years: heatmaps.years,
                          monthAcrossYears,
                          yearTotal,
                          monthRank,
                          monthSharePct,
                          yoyDelta,
                          yoyDeltaPct,
                        });
                      }}
                    />
                  ))}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>
                {hover
                  ? `${hover.year} ${heatmaps.months[hover.monthIndex]}: ${currency(hover.value)}`
                  : "Hover a cell to see the value."}
              </span>
              <span className="text-slate-500">Click a cell for details</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
