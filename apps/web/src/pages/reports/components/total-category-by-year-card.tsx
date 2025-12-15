import React, { useMemo, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { TotalDrilldownState, TotalHeatmapDialogState } from "../reports-types";
import { currency, heatColor } from "../reports-utils";

type CategoryYearHeatmap = {
  years: number[];
  rows: Array<{
    categoryId: string | null;
    name: string;
    icon: string | null;
    color: string | null;
    totals: number[];
  }>;
  max: number;
};

export const TotalCategoryByYearCard: React.FC<{
  flow: "income" | "expense";
  totalOverviewLoaded: boolean;
  heatmap: CategoryYearHeatmap | null;
  yearlyTotals: Array<{ year: number; income: number; expense: number }>;
  onOpenDrilldownDialog: (state: TotalDrilldownState) => void;
  onOpenHeatmapDialog: (state: TotalHeatmapDialogState) => void;
}> = ({
  flow,
  totalOverviewLoaded,
  heatmap,
  yearlyTotals,
  onOpenDrilldownDialog,
  onOpenHeatmapDialog,
}) => {
  const [hover, setHover] = useState<{
    year: number;
    categoryName: string;
    value: number;
  } | null>(null);

  const yearTotalByYear = useMemo(() => {
    const map = new Map<number, number>();
    yearlyTotals.forEach((entry) => {
      map.set(entry.year, flow === "income" ? entry.income : entry.expense);
    });
    return map;
  }, [flow, yearlyTotals]);

  const baseColor = flow === "income" ? "16,185,129" : "239,68,68";
  const fallbackColor = flow === "income" ? "#10b981" : "#ef4444";

  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {flow === "income" ? "Income categories by year" : "Expense categories by year"}
        </CardTitle>
        <p className="text-xs text-slate-500">
          Top categories (lifetime) across all years.
        </p>
      </CardHeader>
      <CardContent className="overflow-auto">
        {!totalOverviewLoaded ? (
          <Skeleton className="h-56 w-full" />
        ) : !heatmap ? (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            No category history yet.
          </div>
        ) : (
          <>
            <div
              className="grid gap-px text-[10px] text-slate-600"
              style={{
                gridTemplateColumns: `160px repeat(${heatmap.years.length}, minmax(0, 1fr))`,
              }}
              onMouseLeave={() => setHover(null)}
            >
              <div />
              {heatmap.years.map((yr) => (
                <div
                  key={yr}
                  className="flex h-6 items-center justify-center overflow-hidden"
                  title={String(yr)}
                >
                  <span className="text-[10px] leading-none text-slate-600">
                    {String(yr).slice(-2)}
                  </span>
                </div>
              ))}
              {heatmap.rows.map((row) => (
                <React.Fragment key={row.name}>
                  <div
                    className={
                      row.categoryId
                        ? "cursor-pointer truncate pr-2 font-medium text-slate-700"
                        : "truncate pr-2 font-medium text-slate-700"
                    }
                    onClick={() => {
                      if (!row.categoryId) return;
                      onOpenDrilldownDialog({
                        kind: "category",
                        flow,
                        categoryId: row.categoryId,
                        name: row.name,
                        color: row.color ?? fallbackColor,
                      });
                    }}
                  >
                    {row.name}
                  </div>
                  {heatmap.years.map((yr, idx) => {
                    const value = row.totals[idx] ?? 0;
                    const yearTotal = yearTotalByYear.get(yr);
                    return (
                      <button
                        type="button"
                        key={`${row.name}-${yr}`}
                        title={`${row.name} • ${yr}: ${currency(value)}`}
                        aria-label={`${row.name} ${yr} ${flow} ${currency(value)}`}
                        className="h-5 rounded-sm border border-slate-100 transition hover:ring-1 hover:ring-slate-300 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-none"
                        style={{
                          backgroundColor: heatColor(baseColor, value, heatmap.max),
                        }}
                        onMouseEnter={() =>
                          setHover({ year: yr, categoryName: row.name, value })
                        }
                        onFocus={() =>
                          setHover({ year: yr, categoryName: row.name, value })
                        }
                        onClick={() => {
                          const prevValue = idx > 0 ? (row.totals[idx - 1] ?? 0) : null;
                          const yoyDelta = prevValue === null ? null : value - prevValue;
                          const yoyDeltaPct =
                            prevValue === null || prevValue === 0
                              ? null
                              : ((value - prevValue) / prevValue) * 100;
                          onOpenHeatmapDialog({
                            kind: "categoryByYear",
                            flow,
                            year: yr,
                            categoryId: row.categoryId,
                            categoryName: row.name,
                            color: row.color ?? fallbackColor,
                            value,
                            years: heatmap.years,
                            totals: row.totals,
                            max: heatmap.max,
                            yearTotal: typeof yearTotal === "number" ? yearTotal : null,
                            sharePct:
                              typeof yearTotal === "number" && yearTotal > 0
                                ? (value / yearTotal) * 100
                                : null,
                            yoyDelta,
                            yoyDeltaPct,
                          });
                        }}
                      />
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>
                {hover
                  ? `${hover.categoryName} • ${hover.year}: ${currency(hover.value)}`
                  : "Hover a cell to see the value."}
              </span>
              <span className="text-slate-500">Click a cell for details</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

