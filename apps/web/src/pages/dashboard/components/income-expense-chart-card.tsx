import React from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { compactCurrency, currency } from "@/lib/format";
import type { YearlyOverviewResponse } from "@/types/api";
import { ChartCard } from "./chart-card";

type IncomeExpensePoint = {
  month: string;
  label: string;
  monthIndex: number;
  year: number;
  income: number;
  expense: number;
};

type IncomeExpenseChartCardProps = {
  data: IncomeExpensePoint[];
  loading: boolean;
  yearlyOverview: YearlyOverviewResponse | null;
  yearlyOverviewLoading: boolean;
};

export const IncomeExpenseChartCard: React.FC<IncomeExpenseChartCardProps> = ({
  data,
  loading,
  yearlyOverview,
  yearlyOverviewLoading,
}) => (
  <ChartCard
    title="Income vs Expense"
    description="Last 12 months"
    loading={loading}
  >
    <ChartContainer
      className="h-full w-full"
      config={{
        income: {
          label: "Income",
          color: "var(--chart-income, #22c55e)",
        },
        expense: {
          label: "Expense",
          color: "var(--chart-expense, #ef4444)",
        },
      }}
    >
      <BarChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeBarFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-income)"
              stopOpacity={0.95}
            />
            <stop
              offset="100%"
              stopColor="var(--color-income)"
              stopOpacity={0.35}
            />
          </linearGradient>
          <linearGradient id="expenseBarFill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-expense)"
              stopOpacity={0.9}
            />
            <stop
              offset="100%"
              stopColor="var(--color-expense)"
              stopOpacity={0.3}
            />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => compactCurrency(Number(v))}
          tickMargin={12}
          width={90}
        />
        <Tooltip
          shared
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;

            const monthLabel =
              typeof payload[0]?.payload?.label === "string"
                ? payload[0].payload.label
                : "";
            const monthIndex =
              typeof payload[0]?.payload?.monthIndex === "number"
                ? payload[0].payload.monthIndex
                : null;
            const monthYear =
              typeof payload[0]?.payload?.year === "number"
                ? payload[0].payload.year
                : null;
            const overviewYear = yearlyOverview?.year ?? null;

            const incomeItem = payload.find((p) => p.dataKey === "income");
            const expenseItem = payload.find((p) => p.dataKey === "expense");

            const incomeTotal =
              incomeItem?.value !== undefined && incomeItem.value !== null
                ? Math.abs(Number(incomeItem.value))
                : null;
            const expenseTotal =
              expenseItem?.value !== undefined && expenseItem.value !== null
                ? Math.abs(Number(expenseItem.value))
                : null;

            const buildBreakdown = (
              breakdown:
                | YearlyOverviewResponse["category_breakdown"]
                | YearlyOverviewResponse["income_category_breakdown"]
                | undefined,
              fallbackColor: string,
            ) => {
              const sorted =
                breakdown &&
                monthIndex !== null &&
                monthYear !== null &&
                overviewYear === monthYear
                  ? breakdown
                      .map((row) => ({
                        name: row.name,
                        total: Math.abs(Number(row.monthly[monthIndex] ?? 0)),
                        color: row.color_hex ?? undefined,
                      }))
                      .filter(
                        (row) => Number.isFinite(row.total) && row.total > 0,
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
              yearlyOverview?.income_category_breakdown,
              "#10b981",
            );
            const expenseBreakdown = buildBreakdown(
              yearlyOverview?.category_breakdown,
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
                </div>

                {yearlyOverviewLoading ? (
                  <p className="mt-2 text-slate-500">Loading breakdown…</p>
                ) : monthYear !== null &&
                  overviewYear !== null &&
                  monthYear !== overviewYear ? (
                  <p className="mt-2 text-slate-500">
                    Category breakdown is available for {overviewYear} months
                    only.
                  </p>
                ) : monthIndex !== null ? (
                  <div className="mt-2 space-y-2">
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
        <Bar
          dataKey="income"
          fill="url(#incomeBarFill)"
          stroke="var(--color-income)"
          strokeOpacity={0.55}
          radius={[8, 8, 0, 0]}
          barSize={24}
          name="Income"
        />
        <Bar
          dataKey="expense"
          fill="url(#expenseBarFill)"
          stroke="var(--color-expense)"
          strokeOpacity={0.55}
          radius={[8, 8, 0, 0]}
          barSize={24}
          name="Expense"
        />
      </BarChart>
    </ChartContainer>
  </ChartCard>
);
