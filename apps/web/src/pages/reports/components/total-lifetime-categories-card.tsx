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

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { TotalDrilldownState } from "../reports-types";
import { currency, isRecord } from "../reports-utils";

export const TotalLifetimeCategoriesCard: React.FC<{
  flow: "income" | "expense";
  hasOverview: boolean;
  rows: Array<{
    id: string | null;
    name: string;
    total: number;
    color: string;
    txCount: number;
  }>;
  onOpenDrilldownDialog: (state: TotalDrilldownState) => void;
}> = ({ flow, hasOverview, rows, onOpenDrilldownDialog }) => {
  const title =
    flow === "income"
      ? "Income categories (lifetime)"
      : "Expense categories (lifetime)";
  const fallbackColor = flow === "income" ? "#10b981" : "#ef4444";

  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        <p className="text-xs text-slate-500">
          Biggest lifetime {flow} categories. Click to drill down.
        </p>
      </CardHeader>
      <CardContent className="h-80">
        {!hasOverview ? (
          <Skeleton className="h-56 w-full" />
        ) : rows.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ left: 16, right: 12, top: 8, bottom: 8 }}
              onClick={(
                state: { activePayload?: Array<{ payload?: unknown }> } | null,
              ) => {
                const payload = state?.activePayload?.[0]?.payload;
                if (!isRecord(payload)) return;
                const id = payload.id;
                if (typeof id !== "string" || !id.length) return;
                const name =
                  typeof payload.name === "string" ? payload.name : "Category";
                const color =
                  typeof payload.color === "string"
                    ? payload.color
                    : fallbackColor;
                onOpenDrilldownDialog({
                  kind: "category",
                  flow,
                  categoryId: id,
                  name,
                  color,
                });
              }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                width={140}
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
                  const txCount = Number(item.txCount ?? 0);
                  return (
                    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                      <p className="font-semibold text-slate-800">{name}</p>
                      <p className="text-slate-600">{currency(total)}</p>
                      {Number.isFinite(txCount) && txCount > 0 ? (
                        <p className="text-slate-500">{txCount} tx</p>
                      ) : null}
                    </div>
                  );
                }}
              />
              <Bar dataKey="total" radius={[6, 6, 6, 6]}>
                {rows.map((entry) => (
                  <Cell key={entry.name} fill={entry.color || fallbackColor} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            No lifetime category data yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
