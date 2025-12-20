import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { InlineError } from "@/components/composed/inline-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageRoutes } from "@/data/routes";
import type {
  TotalOverviewResponse,
  YearlyOverviewResponse,
} from "@/types/api";

import type { TotalDrilldownState } from "../reports-types";
import {
  compactCurrency,
  currency,
  median,
  medianAbsoluteDeviation,
  monthLabel,
  percent,
} from "../reports-utils";

type TotalDrilldownPoint = {
  period: string;
  income: number;
  expense: number;
  net: number;
};

type TotalDrilldownAnomaly = {
  period: string;
  value: number;
  score: number;
};

type TotalWindowRange = { start: string; end: string } | null;

type TotalKpis = {
  netWorth: number;
  cashBalance: number;
  debtTotal: number;
  investmentsValue: number | null;
  lifetimeIncome: number;
  lifetimeExpense: number;
  lifetimeSaved: number;
  lifetimeSavingsRate: number | null;
} | null;

type TotalInvestmentsYearRow = {
  year: number;
  endValue: number;
  netContributions: number;
  impliedReturn: number | null;
};

type TotalDebtAccountRow = {
  id: string;
  name: string;
  current: number;
  prev: number | null;
  delta: number | null;
};

type TotalDebtSeriesPoint = { date: string; debt: number };

type TotalNetWorthStats = {
  asOf: string;
  current: number;
  delta12m: number | null;
  delta12mPct: number | null;
  deltaSinceStart: number;
  deltaSinceStartPct: number | null;
  allTimeHigh: number;
  allTimeHighDate: string;
  allTimeLow: number;
  allTimeLowDate: string;
} | null;

type TotalNetWorthAttribution = {
  windowStart: string;
  windowEnd: string;
  netWorthDelta: number;
  savings: number;
  investmentsContribution: number | null;
  debtContribution: number;
  remainder: number;
} | null;

export const TotalDrilldownDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalDrilldown: TotalDrilldownState | null;
  totalWindowRange: TotalWindowRange;
  totalDrilldownLoading: boolean;
  totalDrilldownError: string | null;
  totalDrilldownSeries: TotalDrilldownPoint[];
  totalYearDrilldown: YearlyOverviewResponse | null;
  totalYearDrilldownLoading: boolean;
  totalYearDrilldownError: string | null;
  totalKpis: TotalKpis;
  totalInvestmentsYearlyTable: TotalInvestmentsYearRow[];
  totalDebtAccounts: TotalDebtAccountRow[];
  totalDebtSeries: TotalDebtSeriesPoint[];
  totalNetWorthStats: TotalNetWorthStats;
  totalNetWorthAttribution: TotalNetWorthAttribution;
  totalOverview: TotalOverviewResponse | null;
}> = ({
  open,
  onOpenChange,
  totalDrilldown,
  totalWindowRange,
  totalDrilldownLoading,
  totalDrilldownError,
  totalDrilldownSeries,
  totalYearDrilldown,
  totalYearDrilldownLoading,
  totalYearDrilldownError,
  totalKpis,
  totalInvestmentsYearlyTable,
  totalDebtAccounts,
  totalDebtSeries,
  totalNetWorthStats,
  totalNetWorthAttribution,
  totalOverview,
}) => {
  const navigate = useNavigate();

  const totalDrilldownAnomalies = useMemo<TotalDrilldownAnomaly[]>(() => {
    if (!totalDrilldown) return [];
    if (
      totalDrilldown.kind !== "category" &&
      totalDrilldown.kind !== "source" &&
      totalDrilldown.kind !== "account"
    ) {
      return [];
    }
    if (!totalDrilldownSeries.length) return [];
    const values = totalDrilldownSeries.map((row) => {
      if (totalDrilldown.kind === "account") return row.net;
      return totalDrilldown.flow === "expense" ? row.expense : row.income;
    });
    const med = median(values);
    const mad = medianAbsoluteDeviation(values, med);
    const scale = mad > 0 ? mad * 1.4826 : 0;
    const mean =
      values.reduce((sum, value) => sum + value, 0) /
      Math.max(1, values.length);
    const variance =
      values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      Math.max(1, values.length);
    const std = Math.sqrt(variance);
    const denom = scale > 0 ? scale : std > 0 ? std : 1;

    const labeled = totalDrilldownSeries.map((row, idx) => {
      const value = values[idx] ?? 0;
      const score = (value - med) / denom;
      return {
        period: row.period,
        value,
        score,
      };
    });

    return labeled
      .filter((row) => row.score >= 2.8 && row.value !== 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [totalDrilldown, totalDrilldownSeries]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {totalDrilldown?.kind === "category"
              ? `${totalDrilldown.name} (${totalDrilldown.flow})`
              : totalDrilldown?.kind === "source"
                ? `${totalDrilldown.source} (${totalDrilldown.flow})`
                : totalDrilldown?.kind === "account"
                  ? `${totalDrilldown.name} (${totalDrilldown.accountType})`
                  : totalDrilldown?.kind === "year"
                    ? `Year ${totalDrilldown.year}`
                    : totalDrilldown?.kind === "investments"
                      ? "Investments"
                      : totalDrilldown?.kind === "debt"
                        ? "Debt overview"
                        : totalDrilldown?.kind === "netWorth"
                          ? "Net worth"
                          : "Details"}
          </DialogTitle>
        </DialogHeader>

        {!totalDrilldown ? null : totalDrilldown.kind === "category" ||
          totalDrilldown.kind === "source" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Window:{" "}
                {totalWindowRange
                  ? `${totalWindowRange.start} → ${totalWindowRange.end}`
                  : "—"}
              </p>
            </div>
            {totalDrilldownError ? (
              <InlineError message={totalDrilldownError} />
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Total (filtered)
                  </p>
                  <p className="font-semibold text-slate-900">
                    {totalDrilldownLoading
                      ? "—"
                      : currency(
                          totalDrilldownSeries.reduce((sum, row) => {
                            const value =
                              totalDrilldown.flow === "expense"
                                ? row.expense
                                : row.income;
                            return sum + value;
                          }, 0),
                        )}
                  </p>
                  <p className="text-xs text-slate-600">
                    Monthly buckets from /reports/custom (transfers excluded).
                  </p>
                </div>
                {totalDrilldownAnomalies.length ? (
                  <div className="rounded-md border border-slate-100 bg-white p-3">
                    <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                      Notable months
                    </p>
                    <div className="mt-2 space-y-2">
                      {totalDrilldownAnomalies.map((row) => (
                        <div
                          key={row.period}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-600">
                            {new Date(row.period).toLocaleDateString("sv-SE", {
                              year: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {currency(row.value)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Flagged as unusually high vs typical month.
                    </p>
                  </div>
                ) : null}
                <div className="max-h-72 overflow-auto rounded-md border border-slate-100 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const bucket: Record<number, number> = {};
                        totalDrilldownSeries.forEach((row) => {
                          const yr = new Date(row.period).getUTCFullYear();
                          const value =
                            totalDrilldown.flow === "expense"
                              ? row.expense
                              : row.income;
                          bucket[yr] = (bucket[yr] ?? 0) + value;
                        });
                        return Object.entries(bucket)
                          .map(([yr, value]) => ({
                            year: Number(yr),
                            total: value,
                          }))
                          .sort((a, b) => b.year - a.year)
                          .slice(0, 20)
                          .map((row) => (
                            <TableRow key={row.year}>
                              <TableCell className="font-medium">
                                {row.year}
                              </TableCell>
                              <TableCell className="text-right font-semibold">
                                {currency(row.total)}
                              </TableCell>
                            </TableRow>
                          ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="h-80 rounded-md border border-slate-100 bg-white p-2">
                {totalDrilldownLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : totalDrilldownSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={totalDrilldownSeries.map((row) => ({
                        date: row.period,
                        label: new Date(row.period).toLocaleDateString(
                          "sv-SE",
                          { month: "short", year: "2-digit" },
                        ),
                        value:
                          totalDrilldown.flow === "expense"
                            ? row.expense
                            : row.income,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
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
                        labelFormatter={(_label, payload) =>
                          payload?.[0]?.payload?.date
                            ? new Date(
                                String(payload[0].payload.date),
                              ).toLocaleDateString("sv-SE", {
                                year: "numeric",
                                month: "long",
                              })
                            : String(_label)
                        }
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke={
                          totalDrilldown.kind === "category"
                            ? totalDrilldown.color
                            : totalDrilldown.flow === "income"
                              ? "#10b981"
                              : "#ef4444"
                        }
                        fill={
                          totalDrilldown.flow === "income"
                            ? "rgba(16,185,129,0.14)"
                            : "rgba(239,68,68,0.12)"
                        }
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No history available.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : totalDrilldown.kind === "account" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Window:{" "}
                {totalWindowRange
                  ? `${totalWindowRange.start} → ${totalWindowRange.end}`
                  : "—"}
              </p>
            </div>
            {totalDrilldownError ? (
              <InlineError message={totalDrilldownError} />
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      Income
                    </p>
                    <p className="font-semibold text-emerald-700">
                      {currency(
                        totalDrilldownSeries.reduce(
                          (sum, row) => sum + row.income,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      Expense
                    </p>
                    <p className="font-semibold text-rose-700">
                      {currency(
                        totalDrilldownSeries.reduce(
                          (sum, row) => sum + row.expense,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                  <div className="rounded-md border border-slate-100 bg-white p-3">
                    <p className="text-xs tracking-wide text-slate-500 uppercase">
                      Net
                    </p>
                    <p className="font-semibold text-slate-900">
                      {currency(
                        totalDrilldownSeries.reduce(
                          (sum, row) => sum + row.net,
                          0,
                        ),
                      )}
                    </p>
                  </div>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                  This uses /reports/custom (income/expense only). Transfers are
                  excluded.
                </div>
                {totalDrilldownAnomalies.length ? (
                  <div className="rounded-md border border-slate-100 bg-white p-3">
                    <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                      Notable months (net)
                    </p>
                    <div className="mt-2 space-y-2">
                      {totalDrilldownAnomalies.map((row) => (
                        <div
                          key={row.period}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-slate-600">
                            {new Date(row.period).toLocaleDateString("sv-SE", {
                              year: "numeric",
                              month: "short",
                            })}
                          </span>
                          <span
                            className={
                              row.value >= 0
                                ? "font-semibold text-emerald-700"
                                : "font-semibold text-rose-700"
                            }
                          >
                            {row.value >= 0 ? "+" : "−"}
                            {currency(Math.abs(row.value))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="h-80 rounded-md border border-slate-100 bg-white p-2">
                {totalDrilldownLoading ? (
                  <Skeleton className="h-full w-full" />
                ) : totalDrilldownSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={totalDrilldownSeries.map((row) => ({
                        date: row.period,
                        label: new Date(row.period).toLocaleDateString(
                          "sv-SE",
                          { month: "short", year: "2-digit" },
                        ),
                        income: row.income,
                        expenseNeg: -row.expense,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
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
                        formatter={(value) => currency(Math.abs(Number(value)))}
                        labelFormatter={(_label, payload) =>
                          payload?.[0]?.payload?.date
                            ? new Date(
                                String(payload[0].payload.date),
                              ).toLocaleDateString("sv-SE", {
                                year: "numeric",
                                month: "long",
                              })
                            : String(_label)
                        }
                        contentStyle={{ fontSize: 12 }}
                      />
                      <ReferenceLine y={0} stroke="#cbd5e1" />
                      <Bar
                        dataKey="income"
                        name="Income"
                        fill="#10b981"
                        radius={[4, 4, 4, 4]}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="expenseNeg"
                        name="Expense"
                        fill="#ef4444"
                        radius={[4, 4, 4, 4]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No history available.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : totalDrilldown.kind === "year" ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Snapshot of the yearly report. Use “Open yearly report” for the
                full page.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  navigate(`${PageRoutes.reportsYearly}/${totalDrilldown.year}`)
                }
              >
                Open yearly report
              </Button>
            </div>
            {totalYearDrilldownError ? (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {totalYearDrilldownError}
              </div>
            ) : null}
            {totalYearDrilldownLoading ? (
              <Skeleton className="h-80 w-full" />
            ) : !totalYearDrilldown ? (
              <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                No yearly details available.
              </div>
            ) : (
              (() => {
                const monthly = totalYearDrilldown.monthly.map((row) => ({
                  date: row.date,
                  month: monthLabel(row.date),
                  income: Number(row.income),
                  expense: Number(row.expense),
                  net: Number(row.net),
                }));
                const topExpenseCategories = [
                  ...totalYearDrilldown.category_breakdown,
                ]
                  .map((row) => ({
                    name: row.name,
                    total: Number(row.total),
                    txCount: row.transaction_count,
                  }))
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 10);
                const topIncomeCategories = [
                  ...totalYearDrilldown.income_category_breakdown,
                ]
                  .map((row) => ({
                    name: row.name,
                    total: Number(row.total),
                    txCount: row.transaction_count,
                  }))
                  .sort((a, b) => b.total - a.total)
                  .slice(0, 10);

                return (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        {[
                          {
                            label: "Income",
                            value: Number(
                              totalYearDrilldown.stats.total_income,
                            ),
                            className: "text-emerald-700",
                          },
                          {
                            label: "Expense",
                            value: Number(
                              totalYearDrilldown.stats.total_expense,
                            ),
                            className: "text-rose-700",
                          },
                          {
                            label: "Net saved",
                            value: Number(totalYearDrilldown.stats.net_savings),
                            className: "text-slate-900",
                          },
                          {
                            label: "Savings rate",
                            value: totalYearDrilldown.stats.savings_rate_pct
                              ? Number(
                                  totalYearDrilldown.stats.savings_rate_pct,
                                )
                              : null,
                            className: "text-slate-900",
                            format: "percent" as const,
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="rounded-md border border-slate-100 bg-slate-50 p-3"
                          >
                            <p className="text-xs tracking-wide text-slate-500 uppercase">
                              {item.label}
                            </p>
                            <p className={`font-semibold ${item.className}`}>
                              {item.value === null
                                ? "—"
                                : item.format === "percent"
                                  ? percent(item.value)
                                  : currency(item.value)}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={monthly}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                            />
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
                              tickFormatter={(v) =>
                                compactCurrency(Math.abs(Number(v)))
                              }
                            />
                            <Tooltip
                              formatter={(value) =>
                                currency(Math.abs(Number(value)))
                              }
                              contentStyle={{ fontSize: 12 }}
                            />
                            <ReferenceLine y={0} stroke="#cbd5e1" />
                            <Bar
                              dataKey="income"
                              name="Income"
                              fill="#10b981"
                              radius={[6, 6, 0, 0]}
                              barSize={16}
                              isAnimationActive={false}
                            />
                            <Bar
                              dataKey="expense"
                              name="Expense"
                              fill="#ef4444"
                              radius={[6, 6, 0, 0]}
                              barSize={16}
                              isAnimationActive={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="net"
                              name="Net"
                              stroke="#0f172a"
                              strokeWidth={2}
                              dot={false}
                              isAnimationActive={false}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      <div className="rounded-md border border-slate-100 bg-white">
                        <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                          Top expense categories
                        </div>
                        <div className="max-h-72 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">
                                  Total
                                </TableHead>
                                <TableHead className="hidden text-right md:table-cell">
                                  Tx
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {topExpenseCategories.map((row) => (
                                <TableRow key={row.name}>
                                  <TableCell className="font-medium">
                                    {row.name}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    {currency(row.total)}
                                  </TableCell>
                                  <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                                    {row.txCount}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>

                      <div className="rounded-md border border-slate-100 bg-white">
                        <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                          Top income categories
                        </div>
                        <div className="max-h-72 overflow-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead className="text-right">
                                  Total
                                </TableHead>
                                <TableHead className="hidden text-right md:table-cell">
                                  Tx
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {topIncomeCategories.map((row) => (
                                <TableRow key={row.name}>
                                  <TableCell className="font-medium">
                                    {row.name}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-emerald-700">
                                    {currency(row.total)}
                                  </TableCell>
                                  <TableCell className="hidden text-right text-xs text-slate-600 md:table-cell">
                                    {row.txCount}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </>
        ) : totalDrilldown.kind === "investments" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Latest value
                  </p>
                  <p className="font-semibold text-slate-900">
                    {totalKpis?.investmentsValue === null
                      ? "—"
                      : currency(totalKpis?.investmentsValue ?? 0)}
                  </p>
                  <p className="text-xs text-slate-600">Snapshot-based.</p>
                </div>
                <div className="max-h-72 overflow-auto rounded-md border border-slate-100 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead className="text-right">End</TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          Net contrib
                        </TableHead>
                        <TableHead className="hidden text-right md:table-cell">
                          Implied return
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totalInvestmentsYearlyTable.map((row) => (
                        <TableRow key={row.year}>
                          <TableCell className="font-medium">
                            {row.year}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(row.endValue)}
                          </TableCell>
                          <TableCell className="hidden text-right md:table-cell">
                            {currency(row.netContributions)}
                          </TableCell>
                          <TableCell className="hidden text-right md:table-cell">
                            {row.impliedReturn === null
                              ? "—"
                              : currency(row.impliedReturn)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="h-80 rounded-md border border-slate-100 bg-white p-2">
                {!totalOverview?.investments?.series?.length ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No investment snapshots yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={totalOverview.investments.series.map((row) => ({
                        date: row.date,
                        label: new Date(row.date).toLocaleDateString("sv-SE", {
                          month: "short",
                          year: "2-digit",
                        }),
                        value: Number(row.value),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
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
                        labelFormatter={(_label, payload) =>
                          payload?.[0]?.payload?.date
                            ? new Date(
                                String(payload[0].payload.date),
                              ).toLocaleDateString("sv-SE", {
                                year: "numeric",
                                month: "long",
                              })
                            : String(_label)
                        }
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        stroke="#4f46e5"
                        fill="rgba(79,70,229,0.15)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </>
        ) : totalDrilldown.kind === "debt" ? (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    Total debt
                  </p>
                  <p className="font-semibold text-slate-900">
                    {totalOverview
                      ? currency(Number(totalOverview.debt.total_current))
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-600">
                    Accounts shown as-of now.
                  </p>
                </div>
                <div className="max-h-72 overflow-auto rounded-md border border-slate-100 bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debt</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {totalDebtAccounts.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell className="max-w-[220px] truncate font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {currency(row.current)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="h-80 rounded-md border border-slate-100 bg-white p-2">
                {totalDebtSeries.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={totalOverview?.debt.series.map((row) => ({
                        date: row.date,
                        label: new Date(row.date).toLocaleDateString("sv-SE", {
                          month: "short",
                          year: "2-digit",
                        }),
                        debt: Number(row.debt),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
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
                        labelFormatter={(_label, payload) =>
                          payload?.[0]?.payload?.date
                            ? new Date(
                                String(payload[0].payload.date),
                              ).toLocaleDateString("sv-SE", {
                                year: "numeric",
                                month: "long",
                              })
                            : String(_label)
                        }
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="debt"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No debt history yet.
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    As of
                  </p>
                  <p className="font-semibold text-slate-900">
                    {totalOverview
                      ? new Date(totalOverview.as_of).toLocaleDateString(
                          "sv-SE",
                        )
                      : "—"}
                  </p>
                  <p className="text-xs text-slate-600">
                    Ledger + investment snapshots.
                  </p>
                </div>
                {totalNetWorthStats ? (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-md border border-slate-100 bg-white p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Current
                      </p>
                      <p className="font-semibold text-slate-900">
                        {currency(totalNetWorthStats.current)}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-white p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Change (12m)
                      </p>
                      <p className="font-semibold text-slate-900">
                        {totalNetWorthStats.delta12m === null ? (
                          "—"
                        ) : (
                          <>
                            <span
                              className={
                                totalNetWorthStats.delta12m >= 0
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                              }
                            >
                              {totalNetWorthStats.delta12m >= 0 ? "+" : "−"}
                              {currency(Math.abs(totalNetWorthStats.delta12m))}
                            </span>
                            {totalNetWorthStats.delta12mPct === null ? null : (
                              <span className="ml-2 text-xs text-slate-600">
                                ({percent(totalNetWorthStats.delta12mPct)})
                              </span>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-white p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Change (since start)
                      </p>
                      <p className="font-semibold text-slate-900">
                        <span
                          className={
                            totalNetWorthStats.deltaSinceStart >= 0
                              ? "text-emerald-700"
                              : "text-rose-700"
                          }
                        >
                          {totalNetWorthStats.deltaSinceStart >= 0 ? "+" : "−"}
                          {currency(
                            Math.abs(totalNetWorthStats.deltaSinceStart),
                          )}
                        </span>
                        {totalNetWorthStats.deltaSinceStartPct ===
                        null ? null : (
                          <span className="ml-2 text-xs text-slate-600">
                            ({percent(totalNetWorthStats.deltaSinceStartPct)})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="rounded-md border border-slate-100 bg-white p-3">
                      <p className="text-xs tracking-wide text-slate-500 uppercase">
                        Range
                      </p>
                      <p className="font-semibold text-slate-900">
                        {currency(totalNetWorthStats.allTimeLow)} →{" "}
                        {currency(totalNetWorthStats.allTimeHigh)}
                      </p>
                      <p className="text-xs text-slate-600">
                        High:{" "}
                        {new Date(
                          totalNetWorthStats.allTimeHighDate,
                        ).toLocaleDateString("sv-SE")}
                      </p>
                    </div>
                  </div>
                ) : null}

                {totalNetWorthAttribution ? (
                  <div className="rounded-md border border-slate-100 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                          Change Attribution
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(
                            totalNetWorthAttribution.windowStart,
                          ).getFullYear()}
                          –
                          {new Date(
                            totalNetWorthAttribution.windowEnd,
                          ).getFullYear()}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-slate-900">
                        {totalNetWorthAttribution.netWorthDelta >= 0
                          ? "+"
                          : "−"}
                        {currency(
                          Math.abs(totalNetWorthAttribution.netWorthDelta),
                        )}
                      </p>
                    </div>
                    <div className="mt-3 space-y-2">
                      {(
                        [
                          {
                            label: "Savings (income − expense)",
                            value: totalNetWorthAttribution.savings,
                          },
                          totalNetWorthAttribution.investmentsContribution ===
                          null
                            ? null
                            : {
                                label: "Investments change",
                                value:
                                  totalNetWorthAttribution.investmentsContribution,
                              },
                          {
                            label: "Debt change",
                            value: totalNetWorthAttribution.debtContribution,
                          },
                          {
                            label: "Remainder",
                            value: totalNetWorthAttribution.remainder,
                          },
                        ] as Array<null | { label: string; value: number }>
                      )
                        .filter(
                          (row): row is { label: string; value: number } =>
                            Boolean(row),
                        )
                        .map((row) => {
                          const denominator = Math.max(
                            1,
                            Math.abs(totalNetWorthAttribution.netWorthDelta),
                          );
                          const pct = (Math.abs(row.value) / denominator) * 100;
                          return (
                            <div key={row.label} className="space-y-1">
                              <div className="flex items-center justify-between text-xs text-slate-600">
                                <span>{row.label}</span>
                                <span
                                  className={
                                    row.value >= 0
                                      ? "font-medium text-emerald-700"
                                      : "font-medium text-rose-700"
                                  }
                                >
                                  {row.value >= 0 ? "+" : "−"}
                                  {currency(Math.abs(row.value))}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={Math.min(100, pct)}
                                  className="h-2"
                                />
                                <span className="w-10 text-right text-[11px] text-slate-500">
                                  {percent(pct)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="h-80 rounded-md border border-slate-100 bg-white p-2">
                {totalOverview?.net_worth_series.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={totalOverview.net_worth_series.map((row) => ({
                        date: row.date,
                        label: new Date(row.date).toLocaleDateString("sv-SE", {
                          month: "short",
                          year: "2-digit",
                        }),
                        netWorth: Number(row.net_worth),
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
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
                        labelFormatter={(_label, payload) =>
                          payload?.[0]?.payload?.date
                            ? new Date(
                                String(payload[0].payload.date),
                              ).toLocaleDateString("sv-SE", {
                                year: "numeric",
                                month: "long",
                              })
                            : String(_label)
                        }
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="netWorth"
                        stroke="#0f172a"
                        fill="rgba(15,23,42,0.12)"
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No net worth history yet.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
