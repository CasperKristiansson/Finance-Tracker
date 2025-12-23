import React, { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltipContent,
} from "@/components/ui/chart";

import { compactCurrency, currency, formatDate } from "../reports-utils";
import { ChartCard } from "./chart-card";

type TotalMoneyPoint = {
  date: string;
  totalMoney: number;
  debt: number | null;
  assets: number;
};

type TotalMoneySnapshot = {
  asOf: string | null;
  total: number;
  debt: number;
};

export const TotalMoneyPositionCard: React.FC<{
  loading: boolean;
  series: TotalMoneyPoint[];
  snapshot: TotalMoneySnapshot | null;
}> = ({ loading, series, snapshot }) => {
  const hasData = series.length > 0;
  const latest = series.at(-1);

  const chartData = useMemo(
    () =>
      series.map((row) => ({
        date: row.date,
        total: row.totalMoney,
        debt: row.debt ? -row.debt : 0,
      })),
    [series],
  );

  const hasDebt = chartData.some((row) => row.debt !== 0);

  const domain = useMemo<[number, number]>(() => {
    if (!chartData.length) return [0, 0];
    const values = chartData.flatMap((row) => [row.total, row.debt]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max(1, Math.abs(max - min) * 0.08);
    return [min - pad, max + pad];
  }, [chartData]);

  return (
    <ChartCard
      title="Total money (after debt)"
      description="Net position after subtracting debt, with debt plotted as a drag."
      loading={loading}
      contentClassName="h-[26rem]"
    >
      {!hasData ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-600">
          <p>No total money history yet.</p>
          <p className="text-xs text-slate-500">
            Import transactions to see your debt-adjusted totals over time.
          </p>
        </div>
      ) : (
        <div className="flex h-full flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Total money
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {currency(snapshot?.total ?? latest?.totalMoney ?? 0)}
              </p>
              <p className="text-[11px] text-slate-500">
                As of{" "}
                {formatDate(
                  snapshot?.asOf ?? latest?.date ?? new Date().toISOString(),
                )}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Debt included
              </p>
              <p className="font-semibold text-amber-700">
                {snapshot ? currency(-snapshot.debt) : "—"}
              </p>
              <p className="text-[11px] text-slate-500">
                Subtracted from total money
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Assets before debt
              </p>
              <p className="font-semibold text-slate-900">
                {latest ? currency(latest.assets) : "—"}
              </p>
              <p className="text-[11px] text-slate-500">
                Snapshot without liabilities
              </p>
            </div>
          </div>

          <div className="flex h-full flex-col gap-3">
            <ChartContainer
              className="h-[18rem] w-full"
              config={{
                total: { label: "Total money", color: "#0284c7" },
                debt: { label: "Debt drag", color: "#f97316" },
              }}
            >
              <AreaChart
                data={chartData}
                margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id="totalMoneyFill"
                    x1="0"
                    x2="0"
                    y1="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="debtFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#fb923c" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#fb923c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) =>
                    formatDate(value as string, {
                      month: "short",
                      year: "2-digit",
                    })
                  }
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  domain={domain}
                  tickMargin={12}
                  width={90}
                  tickFormatter={(v) => compactCurrency(Math.abs(Number(v)))}
                />
                <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="4 4" />
                <Tooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => currency(Number(value))}
                      labelFormatter={(value) =>
                        formatDate(String(value), {
                          month: "short",
                          year: "numeric",
                        })
                      }
                    />
                  }
                />
                <ChartLegend
                  verticalAlign="top"
                  content={<ChartLegendContent className="pt-0" />}
                />
                <Area
                  type="monotoneX"
                  dataKey="total"
                  stroke="#0284c7"
                  strokeWidth={2}
                  fill="url(#totalMoneyFill)"
                  name="Total money"
                />
                {hasDebt ? (
                  <Area
                    type="monotoneX"
                    dataKey="debt"
                    stroke="#f97316"
                    strokeWidth={1.5}
                    fill="url(#debtFill)"
                    name="Debt drag"
                  />
                ) : null}
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
};
