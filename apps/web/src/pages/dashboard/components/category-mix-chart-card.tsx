import React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { currency } from "@/lib/format";
import { ChartCard } from "./chart-card";

type CategoryBreakdownPoint = {
  name: string;
  value: number;
};

type RollingBreakdownRow = {
  name: string;
  total: number;
  color?: string;
};

type CategoryMixChartCardProps = {
  loading: boolean;
  categoryBreakdown: CategoryBreakdownPoint[];
  rollingBreakdown: {
    income: RollingBreakdownRow[];
    expense: RollingBreakdownRow[];
  };
};

export const CategoryMixChartCard: React.FC<CategoryMixChartCardProps> = ({
  loading,
  categoryBreakdown,
  rollingBreakdown,
}) => (
  <ChartCard
    title="Category mix"
    description="Income vs expenses (last 12 months)"
    loading={loading}
    action={
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Income
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-rose-500" />
          Expenses
        </span>
      </div>
    }
  >
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <defs>
          <linearGradient
            id="categoryMixIncomeFill"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#059669" stopOpacity={0.95} />
          </linearGradient>
          <linearGradient
            id="categoryMixExpenseFill"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop offset="0%" stopColor="#fb7185" stopOpacity={0.95} />
            <stop offset="100%" stopColor="#e11d48" stopOpacity={0.95} />
          </linearGradient>
        </defs>
        <Pie
          data={categoryBreakdown}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={4}
        >
          {categoryBreakdown.map((_, index) => (
            <Cell
              key={index}
              fill={
                index === 0
                  ? "url(#categoryMixIncomeFill)"
                  : "url(#categoryMixExpenseFill)"
              }
              stroke={index === 0 ? "#10b981" : "#ef4444"}
              strokeOpacity={0.35}
            />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0];
            const flow =
              item.name === "Income"
                ? ("income" as const)
                : ("expense" as const);
            const sorted =
              flow === "income"
                ? rollingBreakdown.income
                : rollingBreakdown.expense;
            const top = sorted.slice(0, 5);
            const otherTotal = sorted
              .slice(5)
              .reduce((sum, row) => sum + row.total, 0);
            return (
              <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                <p className="font-semibold text-slate-800">{item.name}</p>
                <p className="text-slate-600">{currency(Number(item.value))}</p>
                {top.length ? (
                  <div className="mt-2 space-y-1">
                    {top.map((row) => (
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
                                (flow === "income" ? "#10b981" : "#ef4444"),
                            }}
                          />
                          <span className="truncate">{row.name}</span>
                        </span>
                        <span className="font-medium text-slate-800 tabular-nums">
                          {currency(row.total)}
                        </span>
                      </div>
                    ))}
                    {otherTotal ? (
                      <div className="flex items-center justify-between gap-4 pt-1 text-slate-600">
                        <span>Other</span>
                        <span className="font-medium tabular-nums">
                          {currency(otherTotal)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  </ChartCard>
);
