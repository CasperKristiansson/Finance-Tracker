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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  loading: boolean;
  expenseComposition: Composition | null;
  incomeComposition: Composition | null;
  onOpenHeatmapDialog: (state: TotalHeatmapDialogState) => void;
}> = ({
  loading,
  expenseComposition,
  incomeComposition,
  onOpenHeatmapDialog,
}) => (
  <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
    <CardHeader className="pb-2">
      <div>
        <CardTitle className="text-base font-semibold text-slate-900">
          Composition over time
        </CardTitle>
        <p className="text-xs text-slate-500">
          100% stacked by year for the biggest categories.
        </p>
      </div>
    </CardHeader>
    <CardContent className="h-80">
      {loading ? (
        <Skeleton className="h-full w-full" />
      ) : !expenseComposition && !incomeComposition ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-600">
          No composition data yet.
        </div>
      ) : (
        <Tabs defaultValue="expense" className="flex h-full flex-col">
          <TabsList className="self-start">
            <TabsTrigger value="expense">Expenses</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>
          <TabsContent value="expense" className="mt-2 min-h-0 flex-1">
            {!expenseComposition ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-600">
                No expense mix yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expenseComposition.data}>
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
                      const total = expenseComposition.totalsByYear[year] ?? 0;
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
                                  expenseComposition.amountByYear[year]?.[
                                    name
                                  ] ?? 0;
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
                            Click a segment for details
                          </p>
                        </div>
                      );
                    }}
                  />
                  {expenseComposition.keys.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="composition"
                      fill={expenseComposition.colors[key]}
                      isAnimationActive={false}
                      onClick={(data: unknown) => {
                        const payload = isRecord(data)
                          ? (data.payload as unknown)
                          : null;
                        if (!isRecord(payload)) return;
                        const year = Number(payload.year);
                        if (!Number.isFinite(year)) return;
                        const value =
                          expenseComposition.amountByYear[year]?.[key] ?? 0;
                        const totals = expenseComposition.years.map(
                          (yr) =>
                            expenseComposition.amountByYear[yr]?.[key] ?? 0,
                        );
                        const max = Math.max(0, ...totals);
                        const idx = expenseComposition.years.indexOf(year);
                        const prevValue =
                          idx > 0 ? (totals[idx - 1] ?? 0) : null;
                        const yoyDelta =
                          prevValue === null ? null : value - prevValue;
                        const yoyDeltaPct =
                          prevValue === null || prevValue === 0
                            ? null
                            : ((value - prevValue) / prevValue) * 100;
                        const yearTotal =
                          expenseComposition.totalsByYear[year] ?? null;
                        onOpenHeatmapDialog({
                          kind: "categoryByYear",
                          flow: "expense",
                          year,
                          categoryId: expenseComposition.ids[key] ?? null,
                          categoryName: key,
                          color: expenseComposition.colors[key] ?? "#ef4444",
                          value,
                          years: expenseComposition.years,
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
            )}
          </TabsContent>

          <TabsContent value="income" className="mt-2 min-h-0 flex-1">
            {!incomeComposition ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-600">
                No income mix yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeComposition.data}>
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
                      const total = incomeComposition.totalsByYear[year] ?? 0;
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
                                  incomeComposition.amountByYear[year]?.[
                                    name
                                  ] ?? 0;
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
                            Click a segment for details
                          </p>
                        </div>
                      );
                    }}
                  />
                  {incomeComposition.keys.map((key) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      stackId="composition"
                      fill={incomeComposition.colors[key]}
                      isAnimationActive={false}
                      onClick={(data: unknown) => {
                        const payload = isRecord(data)
                          ? (data.payload as unknown)
                          : null;
                        if (!isRecord(payload)) return;
                        const year = Number(payload.year);
                        if (!Number.isFinite(year)) return;
                        const value =
                          incomeComposition.amountByYear[year]?.[key] ?? 0;
                        const totals = incomeComposition.years.map(
                          (yr) =>
                            incomeComposition.amountByYear[yr]?.[key] ?? 0,
                        );
                        const max = Math.max(0, ...totals);
                        const idx = incomeComposition.years.indexOf(year);
                        const prevValue =
                          idx > 0 ? (totals[idx - 1] ?? 0) : null;
                        const yoyDelta =
                          prevValue === null ? null : value - prevValue;
                        const yoyDeltaPct =
                          prevValue === null || prevValue === 0
                            ? null
                            : ((value - prevValue) / prevValue) * 100;
                        const yearTotal =
                          incomeComposition.totalsByYear[year] ?? null;
                        onOpenHeatmapDialog({
                          kind: "categoryByYear",
                          flow: "income",
                          year,
                          categoryId: incomeComposition.ids[key] ?? null,
                          categoryName: key,
                          color: incomeComposition.colors[key] ?? "#10b981",
                          value,
                          years: incomeComposition.years,
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
            )}
          </TabsContent>
        </Tabs>
      )}
    </CardContent>
  </Card>
);
