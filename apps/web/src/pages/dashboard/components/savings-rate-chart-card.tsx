import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { currency } from "@/lib/format";
import type { SavingsMonthStatus } from "../dashboard-utils";
import { ChartCard } from "./chart-card";

type SavingsRatePoint = {
  month: string;
  label: string;
  rate: number;
  income: number;
  expense: number;
  status: SavingsMonthStatus;
};

type SavingsRateChartCardProps = {
  loading: boolean;
  data: SavingsRatePoint[];
  summary: {
    noIncomeMonths: number;
    noActivityMonths: number;
  };
};

export const SavingsRateChartCard: React.FC<SavingsRateChartCardProps> = ({
  loading,
  data,
  summary,
}) => (
  <ChartCard
    title="Savings rate"
    description="Last 12 months"
    loading={loading}
    action={
      summary.noIncomeMonths || summary.noActivityMonths ? (
        <div className="space-y-1 text-[11px] text-slate-500">
          {summary.noIncomeMonths ? (
            <p className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {summary.noIncomeMonths} no-income months
            </p>
          ) : null}
          {summary.noActivityMonths ? (
            <p className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              {summary.noActivityMonths} no-activity months
            </p>
          ) : null}
        </div>
      ) : null
    }
  >
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <defs>
          <linearGradient id="savingsRateFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#0284c7" stopOpacity={0.95} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <YAxis
          tickFormatter={(v) => `${v}%`}
          tickLine={false}
          axisLine={false}
        />
        <ReferenceLine y={0} stroke="#cbd5e1" />
        {data
          .filter((point) => point.status !== "normal")
          .map((point) => (
            <ReferenceDot
              key={`${point.label}-${point.status}`}
              x={point.month}
              y={0}
              r={point.status === "no-activity" ? 4 : 3}
              fill={point.status === "no-activity" ? "#cbd5e1" : "#fbbf24"}
              stroke={point.status === "no-activity" ? "#64748b" : "#b45309"}
            />
          ))}
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0];
            const status =
              item.payload?.status === "no-income" ||
              item.payload?.status === "no-activity"
                ? (item.payload.status as SavingsMonthStatus)
                : "normal";
            return (
              <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-semibold text-slate-800">
                  {item.payload.label}
                </p>
                <p className="text-slate-600">Savings rate: {item.value}%</p>
                <p className="text-slate-500">
                  Income: {currency(Number(item.payload.income ?? 0))} -
                  Expense: {currency(Number(item.payload.expense ?? 0))}
                </p>
                {status === "no-income" ? (
                  <p className="text-amber-700">
                    No income recorded this month.
                  </p>
                ) : null}
                {status === "no-activity" ? (
                  <p className="text-slate-600">
                    No income or expense recorded this month.
                  </p>
                ) : null}
              </div>
            );
          }}
        />
        <Bar
          dataKey="rate"
          fill="url(#savingsRateFill)"
          stroke="#0ea5e9"
          strokeOpacity={0.4}
          radius={[6, 6, 4, 4]}
        />
      </BarChart>
    </ResponsiveContainer>
  </ChartCard>
);
