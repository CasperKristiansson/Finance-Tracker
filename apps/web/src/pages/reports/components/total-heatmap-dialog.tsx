import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { TotalHeatmapDialogState } from "../reports-types";
import { compactCurrency, currency, percent } from "../reports-utils";

export const TotalHeatmapDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: TotalHeatmapDialogState | null;
  onOpenCategoryDrilldown: (args: {
    flow: "income" | "expense";
    categoryId: string;
    name: string;
    color: string;
  }) => void;
}> = ({ open, onOpenChange, state, onOpenCategoryDrilldown }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle>
          {state?.kind === "seasonality"
            ? `${state.flow === "income" ? "Income" : "Expense"} seasonality • ${state.year} ${state.monthLabel}`
            : state?.kind === "categoryByYear"
              ? `${state.flow === "income" ? "Income" : "Expense"} category • ${state.categoryName} • ${state.year}`
              : "Details"}
        </DialogTitle>
      </DialogHeader>

      {!state ? null : state.kind === "seasonality" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Amount
              </p>
              <p className="font-semibold text-slate-900">
                {currency(state.value)}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Share of year
              </p>
              <p className="font-semibold text-slate-900">
                {state.monthSharePct === null
                  ? "—"
                  : percent(state.monthSharePct)}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Rank (month)
              </p>
              <p className="font-semibold text-slate-900">
                #{state.monthRank} / 12
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                YoY (same month)
              </p>
              <p className="font-semibold text-slate-900">
                {state.yoyDelta === null ? (
                  "—"
                ) : (
                  <span
                    className={
                      state.yoyDelta >= 0 ? "text-emerald-700" : "text-rose-700"
                    }
                  >
                    {state.yoyDelta >= 0 ? "+" : "−"}
                    {currency(Math.abs(state.yoyDelta))}
                  </span>
                )}
              </p>
              {state.yoyDeltaPct === null ? null : (
                <p className="text-xs text-slate-600">
                  {percent(state.yoyDeltaPct)}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-64 rounded-md border border-slate-100 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={state.yearValues.map((value, idx) => ({
                    month: new Date(Date.UTC(2000, idx, 1)).toLocaleDateString(
                      "sv-SE",
                      { month: "short" },
                    ),
                    value,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickFormatter={(v) => compactCurrency(Number(v))}
                  />
                  <Tooltip
                    formatter={(value) => currency(Number(value))}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 4, 4]}>
                    {state.yearValues.map((_value, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          idx === state.monthIndex
                            ? state.flow === "income"
                              ? "#059669"
                              : "#dc2626"
                            : state.flow === "income"
                              ? "#10b981"
                              : "#ef4444"
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="h-64 rounded-md border border-slate-100 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={state.monthAcrossYears.map((row) => ({
                    year: String(row.year),
                    value: row.value,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="year"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickFormatter={(v) => compactCurrency(Number(v))}
                  />
                  <Tooltip
                    formatter={(value) => currency(Number(value))}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar
                    dataKey="value"
                    radius={[6, 6, 4, 4]}
                    fill={state.flow === "income" ? "#10b981" : "#ef4444"}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : state.kind === "categoryByYear" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Amount
              </p>
              <p className="font-semibold text-slate-900">
                {currency(state.value)}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Share of year
              </p>
              <p className="font-semibold text-slate-900">
                {state.sharePct === null ? "—" : percent(state.sharePct)}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                YoY
              </p>
              <p className="font-semibold text-slate-900">
                {state.yoyDelta === null ? (
                  "—"
                ) : (
                  <span
                    className={
                      state.yoyDelta >= 0 ? "text-emerald-700" : "text-rose-700"
                    }
                  >
                    {state.yoyDelta >= 0 ? "+" : "−"}
                    {currency(Math.abs(state.yoyDelta))}
                  </span>
                )}
              </p>
              {state.yoyDeltaPct === null ? null : (
                <p className="text-xs text-slate-600">
                  {percent(state.yoyDeltaPct)}
                </p>
              )}
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Actions
              </p>
              {state.categoryId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-1 w-full"
                  onClick={() => {
                    if (!state.categoryId) return;
                    onOpenChange(false);
                    onOpenCategoryDrilldown({
                      flow: state.flow,
                      categoryId: state.categoryId,
                      name: state.categoryName,
                      color: state.color,
                    });
                  }}
                >
                  Open drilldown
                </Button>
              ) : (
                <p className="mt-1 text-xs text-slate-600">—</p>
              )}
            </div>
          </div>

          <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={state.years.map((year, idx) => ({
                  year: String(year),
                  value: state.totals[idx] ?? 0,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="year"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  tickFormatter={(v) => compactCurrency(Number(v))}
                />
                <Tooltip
                  formatter={(value) => currency(Number(value))}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[6, 6, 4, 4]}>
                  {state.years.map((year) => (
                    <Cell
                      key={year}
                      fill={
                        year === state.year ? state.color : `${state.color}99`
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </DialogContent>
  </Dialog>
);
