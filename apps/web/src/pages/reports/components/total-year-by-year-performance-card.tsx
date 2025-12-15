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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { TotalDrilldownState } from "../reports-types";
import { compactCurrency, currency, percent } from "../reports-utils";

export const TotalYearByYearPerformanceCard: React.FC<{
  loading: boolean;
  hasOverview: boolean;
  bestYear: number | null;
  worstYear: number | null;
  lifetimeSavingsRate: number | null;
  chartData: Array<{
    year: number;
    income: number;
    expense: number;
    net: number;
    savingsRate: number | null;
  }>;
  tableData: Array<{
    year: number;
    income: number;
    expense: number;
    net: number;
    savingsRate: number | null;
  }>;
  onOpenDrilldownDialog: (state: TotalDrilldownState) => void;
}> = ({
  loading,
  hasOverview,
  bestYear,
  worstYear,
  lifetimeSavingsRate,
  chartData,
  tableData,
  onOpenDrilldownDialog,
}) => {
  return (
    <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          Year-by-year performance
        </CardTitle>
        <p className="text-xs text-slate-500">
          Income vs expense per year. Click a year for details.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasOverview ? (
          <Skeleton className="h-56 w-full" />
        ) : loading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <>
            <div className="h-56 rounded-md border border-slate-100 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  onClick={(
                    state:
                      | {
                          activePayload?: Array<{
                            payload?: { year?: unknown };
                          }>;
                        }
                      | null
                      | undefined,
                  ) => {
                    const clickedYear = state?.activePayload?.[0]?.payload?.year;
                    if (typeof clickedYear === "number") {
                      onOpenDrilldownDialog({ kind: "year", year: clickedYear });
                    }
                  }}
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
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const yearLabel = payload[0]?.payload?.year;
                      const income = Number(payload[0]?.payload?.income ?? 0);
                      const expense = Number(payload[0]?.payload?.expense ?? 0);
                      const net = Number(payload[0]?.payload?.net ?? 0);
                      return (
                        <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                          <p className="font-semibold text-slate-800">
                            {yearLabel}
                          </p>
                          <p className="text-slate-600">
                            Income: {currency(income)}
                          </p>
                          <p className="text-slate-600">
                            Expense: {currency(expense)}
                          </p>
                          <p className="text-slate-600">
                            Net: {currency(net)}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="income"
                    name="Income"
                    fill="#10b981"
                    radius={[6, 6, 4, 4]}
                    barSize={12}
                  />
                  <Bar
                    dataKey="expense"
                    name="Expense"
                    fill="#ef4444"
                    radius={[6, 6, 4, 4]}
                    barSize={12}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="max-h-56 overflow-auto rounded-md border border-slate-100 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Expense</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      Savings rate
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row) => (
                    <TableRow
                      key={row.year}
                      className="cursor-pointer"
                      onClick={() =>
                        onOpenDrilldownDialog({
                          kind: "year",
                          year: row.year,
                        })
                      }
                    >
                      <TableCell className="font-medium">{row.year}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700">
                        {currency(row.income)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-rose-700">
                        {currency(row.expense)}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        <span
                          className={
                            row.net >= 0 ? "text-emerald-700" : "text-rose-700"
                          }
                        >
                          {row.net >= 0 ? "+" : "−"}
                          {currency(Math.abs(row.net))}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                        {row.savingsRate === null ? "—" : percent(row.savingsRate)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              {typeof bestYear === "number" ? (
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1"
                  onClick={() =>
                    onOpenDrilldownDialog({ kind: "year", year: bestYear })
                  }
                >
                  Best: {bestYear}
                </button>
              ) : null}
              {typeof worstYear === "number" ? (
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-3 py-1"
                  onClick={() =>
                    onOpenDrilldownDialog({ kind: "year", year: worstYear })
                  }
                >
                  Worst: {worstYear}
                </button>
              ) : null}
              {lifetimeSavingsRate != null ? (
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1">
                  Lifetime savings rate: {percent(lifetimeSavingsRate)}
                </span>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

