import { Sparkles } from "lucide-react";
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { PageRoutes } from "@/data/routes";
import type { YearlyOverviewResponse } from "@/types/api";

import {
  compactCurrency,
  currency,
  isRecord,
  monthLabel,
} from "../reports-utils";
import { ChartCard } from "./chart-card";

type MonthPoint = {
  month: string;
  monthIndex: number;
  income: number;
  expense: number | null;
  net: number;
};

export const YearlyIncomeExpenseCard: React.FC<{
  year: number;
  overview: YearlyOverviewResponse | null;
  overviewLoading: boolean;
}> = ({ year, overview, overviewLoading }) => {
  const monthly = useMemo(() => {
    const rows: MonthPoint[] = (overview?.monthly || []).map(
      (row, monthIndex) => ({
        month: monthLabel(row.date),
        monthIndex,
        income: Number(row.income),
        expense: Number(row.expense),
        net: Number(row.net),
      }),
    );
    return rows.map((row) => ({
      ...row,
      expense:
        typeof row.expense === "number" && Number.isFinite(row.expense)
          ? Math.abs(row.expense)
          : null,
    }));
  }, [overview?.monthly]);

  return (
    <ChartCard
      title={`Income vs expense (${year})`}
      description="Income and expense by month, with net line for turning points."
      loading={overviewLoading}
    >
      {!overview && !overviewLoading ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-600">
          <Sparkles className="h-6 w-6 text-slate-500" />
          <p className="text-center">
            No data for {year} yet. Import files or add transactions.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link to={PageRoutes.imports}>Go to Imports</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to={PageRoutes.transactions}>Add transactions</Link>
            </Button>
          </div>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthly}>
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
              shared
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;

                const record = payload[0]?.payload;
                if (!isRecord(record)) return null;

                const monthLabel =
                  typeof record.month === "string" ? record.month : "";
                const monthIndex =
                  typeof record.monthIndex === "number"
                    ? record.monthIndex
                    : null;

                const incomeItem = payload.find((p) => p.dataKey === "income");
                const expenseItem = payload.find(
                  (p) => p.dataKey === "expense",
                );

                const incomeTotal =
                  incomeItem?.value !== undefined && incomeItem.value !== null
                    ? Math.abs(Number(incomeItem.value))
                    : null;
                const expenseTotal =
                  expenseItem?.value !== undefined && expenseItem.value !== null
                    ? Math.abs(Number(expenseItem.value))
                    : null;

                const net = typeof record.net === "number" ? record.net : null;

                const buildBreakdown = (
                  breakdown:
                    | YearlyOverviewResponse["category_breakdown"]
                    | YearlyOverviewResponse["income_category_breakdown"]
                    | undefined,
                  fallbackColor: string,
                ) => {
                  const sorted =
                    breakdown && monthIndex !== null
                      ? breakdown
                          .map((row) => ({
                            name: row.name,
                            total: Math.abs(
                              Number(row.monthly[monthIndex] ?? 0),
                            ),
                            color: row.color_hex ?? undefined,
                          }))
                          .filter(
                            (row) =>
                              Number.isFinite(row.total) && row.total > 0,
                          )
                          .sort((a, b) => b.total - a.total)
                      : [];
                  const top = sorted.slice(0, 4);
                  const otherTotal = sorted
                    .slice(4)
                    .reduce((sum, row) => sum + row.total, 0);

                  return { top, otherTotal, fallbackColor };
                };

                const incomeBreakdown = buildBreakdown(
                  overview?.income_category_breakdown,
                  "#10b981",
                );
                const expenseBreakdown = buildBreakdown(
                  overview?.category_breakdown,
                  "#ef4444",
                );

                return (
                  <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                    <p className="font-semibold text-slate-800">{monthLabel}</p>

                    <div className="mt-1 grid gap-1">
                      <p className="text-slate-600">
                        Income:{" "}
                        <span className="font-medium text-slate-800 tabular-nums">
                          {incomeTotal !== null ? currency(incomeTotal) : "—"}
                        </span>
                      </p>
                      <p className="text-slate-600">
                        Expense:{" "}
                        <span className="font-medium text-slate-800 tabular-nums">
                          {expenseTotal !== null ? currency(expenseTotal) : "—"}
                        </span>
                      </p>
                      <p className="pt-1 font-semibold text-slate-900 tabular-nums">
                        Net: {net !== null ? currency(net) : "—"}
                      </p>
                    </div>

                    {overviewLoading ? (
                      <p className="mt-2 text-slate-500">Loading breakdown…</p>
                    ) : monthIndex !== null ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {incomeBreakdown.top.length ? (
                          <div>
                            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                              Income categories
                            </p>
                            <div className="mt-1 space-y-1">
                              {incomeBreakdown.top.map((row) => (
                                <div
                                  key={`${row.name}-${row.total}`}
                                  className="flex items-center justify-between gap-4"
                                >
                                  <span className="flex min-w-0 items-center gap-2 text-slate-700">
                                    <span
                                      className="h-2 w-2 shrink-0 rounded-full"
                                      style={{
                                        backgroundColor:
                                          row.color ??
                                          incomeBreakdown.fallbackColor,
                                      }}
                                    />
                                    <span className="truncate">{row.name}</span>
                                  </span>
                                  <span className="font-medium text-slate-800 tabular-nums">
                                    {currency(row.total)}
                                  </span>
                                </div>
                              ))}
                              {incomeBreakdown.otherTotal ? (
                                <div className="flex items-center justify-between gap-4 pt-1 text-slate-600">
                                  <span>Other</span>
                                  <span className="font-medium tabular-nums">
                                    {currency(incomeBreakdown.otherTotal)}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}

                        {expenseBreakdown.top.length ? (
                          <div>
                            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                              Expense categories
                            </p>
                            <div className="mt-1 space-y-1">
                              {expenseBreakdown.top.map((row) => (
                                <div
                                  key={`${row.name}-${row.total}`}
                                  className="flex items-center justify-between gap-4"
                                >
                                  <span className="flex min-w-0 items-center gap-2 text-slate-700">
                                    <span
                                      className="h-2 w-2 shrink-0 rounded-full"
                                      style={{
                                        backgroundColor:
                                          row.color ??
                                          expenseBreakdown.fallbackColor,
                                      }}
                                    />
                                    <span className="truncate">{row.name}</span>
                                  </span>
                                  <span className="font-medium text-slate-800 tabular-nums">
                                    {currency(row.total)}
                                  </span>
                                </div>
                              ))}
                              {expenseBreakdown.otherTotal ? (
                                <div className="flex items-center justify-between gap-4 pt-1 text-slate-600">
                                  <span>Other</span>
                                  <span className="font-medium tabular-nums">
                                    {currency(expenseBreakdown.otherTotal)}
                                  </span>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              }}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Bar
              dataKey="income"
              name="Income"
              fill="#10b981"
              radius={[8, 8, 0, 0]}
              barSize={24}
            />
            <Bar
              dataKey="expense"
              name="Expense"
              fill="#ef4444"
              radius={[8, 8, 0, 0]}
              barSize={24}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="#0f172a"
              strokeWidth={2}
              dot={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
};
