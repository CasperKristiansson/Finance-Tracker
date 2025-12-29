import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/composed/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { TotalHeatmapDialogState } from "../reports-types";
import { currency, isRecord } from "../reports-utils";

type Composition = {
  years: number[];
  keys: string[];
  colors: Record<string, string>;
  ids: Record<string, string | null>;
  totalsByYear: Record<number, number>;
  amountByYear: Record<number, Record<string, number>>;
  data: Array<Record<string, number | string>>;
};

export const TotalCompositionOverTimeCard: React.FC<{
  flow: "income" | "expense";
  loading: boolean;
  composition: Composition | null;
  onOpenHeatmapDialog: (state: TotalHeatmapDialogState) => void;
}> = ({ flow, loading, composition, onOpenHeatmapDialog }) => {
  const title =
    flow === "income" ? "Income composition" : "Expense composition";
  const fallbackColor = flow === "income" ? "#10b981" : "#ef4444";

  return (
    <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        <p className="text-xs text-slate-500">
          100% stacked by year (share of total). Hover for SEK totals, click a
          segment for details.
        </p>
      </CardHeader>

      <CardContent className="h-80">
        {loading ? (
          <Skeleton className="h-full w-full" />
        ) : !composition ? (
          <EmptyState
            title={`No ${flow} composition data yet.`}
            className="h-full"
          />
        ) : (
          <div className="flex h-full flex-col gap-2">
            <div className="min-h-0 flex-1 rounded-md border border-slate-100 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={composition.data}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickFormatter={(v) => `${Number(v)}%`}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const year = Number(label);
                      const total = composition.totalsByYear[year] ?? 0;
                      return (
                        <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-semibold text-slate-800">{year}</p>
                          <p className="text-slate-600">
                            Total: {currency(total)}
                          </p>
                          <div className="mt-2 space-y-1">
                            {payload
                              .slice()
                              .reverse()
                              .map((p) => {
                                const name = String(p.name ?? "");
                                const pct = Number(p.value ?? 0);
                                const amount =
                                  composition.amountByYear[year]?.[name] ?? 0;
                                return (
                                  <div
                                    key={name}
                                    className="flex items-center justify-between gap-3"
                                  >
                                    <span className="text-slate-700">
                                      {name}
                                    </span>
                                    <span className="text-slate-600">
                                      {pct.toFixed(0)}% • {currency(amount)}
                                    </span>
                                  </div>
                                );
                              })}
                          </div>
                          <p className="mt-2 text-[11px] text-slate-500">
                            Each year sums to 100% (share view).
                          </p>
                        </div>
                      );
                    }}
                  />
                  {composition.keys.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="composition"
                      fill={composition.colors[key] ?? fallbackColor}
                      isAnimationActive={false}
                      onClick={(data: unknown) => {
                        const payload = isRecord(data)
                          ? (data.payload as unknown)
                          : null;
                        if (!isRecord(payload)) return;
                        const year = Number(payload.year);
                        if (!Number.isFinite(year)) return;
                        const value =
                          composition.amountByYear[year]?.[key] ?? 0;
                        const totals = composition.years.map(
                          (yr) => composition.amountByYear[yr]?.[key] ?? 0,
                        );
                        const max = Math.max(0, ...totals);
                        const idx = composition.years.indexOf(year);
                        const prevValue =
                          idx > 0 ? (totals[idx - 1] ?? 0) : null;
                        const yoyDelta =
                          prevValue === null ? null : value - prevValue;
                        const yoyDeltaPct =
                          prevValue === null || prevValue === 0
                            ? null
                            : ((value - prevValue) / prevValue) * 100;
                        const yearTotal =
                          composition.totalsByYear[year] ?? null;
                        onOpenHeatmapDialog({
                          kind: "categoryByYear",
                          flow,
                          year,
                          categoryId: composition.ids[key] ?? null,
                          categoryName: key,
                          color: composition.colors[key] ?? fallbackColor,
                          value,
                          years: composition.years,
                          totals,
                          max,
                          yearTotal,
                          sharePct:
                            typeof yearTotal === "number" && yearTotal > 0
                              ? (value / yearTotal) * 100
                              : null,
                          yoyDelta,
                          yoyDeltaPct,
                        });
                      }}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <span>
                Buckets: {composition.keys.length} (top categories + other)
              </span>
              <span className="text-slate-500">
                Click a segment for details
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
