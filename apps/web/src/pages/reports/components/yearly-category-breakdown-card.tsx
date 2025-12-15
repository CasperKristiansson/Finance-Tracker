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

import { currency, isRecord } from "../reports-utils";
import { ChartCard } from "./chart-card";

type CategoryRow = {
  id?: string | null;
  name: string;
  total: number;
  color: string;
};

export const YearlyCategoryBreakdownCard: React.FC<{
  flow: "income" | "expense";
  loading: boolean;
  rows: CategoryRow[];
  onSelectCategory: (categoryId: string) => void;
}> = ({ flow, loading, rows, onSelectCategory }) => {
  const title =
    flow === "income"
      ? "Category breakdown (income)"
      : "Category breakdown (expenses)";

  return (
    <ChartCard
      title={title}
      description="Top categories + Other. Click to drill down."
      loading={loading}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows.map((row) => ({ ...row, total: row.total }))}
          layout="vertical"
          margin={{ left: 16, right: 12, top: 8, bottom: 8 }}
          onClick={(
            state: {
              activePayload?: Array<{ payload?: { id?: unknown } }>;
            } | null,
          ) => {
            const id = state?.activePayload?.[0]?.payload?.id;
            if (typeof id === "string" && id.length) onSelectCategory(id);
          }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tickLine={false}
            axisLine={false}
            width={120}
            tick={{ fill: "#475569", fontSize: 12 }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0]?.payload;
              if (!isRecord(item)) return null;
              const name =
                typeof item.name === "string" ? item.name : "Category";
              const total = Number(item.total ?? 0);
              return (
                <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                  <p className="font-semibold text-slate-800">{name}</p>
                  <p className="text-slate-600">{currency(total)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="total" radius={[6, 6, 6, 6]}>
            {rows.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
};
