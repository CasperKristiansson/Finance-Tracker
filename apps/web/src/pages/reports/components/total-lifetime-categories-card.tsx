import React, { useMemo } from "react";
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

import { EmptyState } from "@/components/composed/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { TotalDrilldownState } from "../reports-types";
import { currency } from "../reports-utils";

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

  type LifetimeCategoryDatum = {
    id: string | null;
    name: string;
    total: number;
    color: string;
    txCount: number;
  };

  const categoryData = useMemo<LifetimeCategoryDatum[]>(
    () =>
      rows.map((row) => ({
        ...row,
        color: row.color || fallbackColor,
      })),
    [fallbackColor, rows],
  );

  type LifetimeCategoryWithId = LifetimeCategoryDatum & { id: string };

  const categoryById = useMemo(
    () =>
      new Map<string, LifetimeCategoryWithId>(
        categoryData
          .filter((row): row is LifetimeCategoryWithId => Boolean(row.id))
          .map((row) => [row.id, { ...row, id: row.id }]),
      ),
    [categoryData],
  );

  const handleBarClick = (categoryId: string) => {
    const category = categoryById.get(categoryId);
    if (!category) return;
    onOpenDrilldownDialog({
      kind: "category",
      flow,
      categoryId: category.id,
      name: category.name,
      color: category.color,
    });
  };

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
        ) : categoryData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categoryData}
              layout="vertical"
              margin={{ left: 16, right: 12, top: 8, bottom: 8 }}
              onClick={(
                state: { activePayload?: Array<{ payload?: unknown }> } | null,
              ) => {
                const payload = state?.activePayload?.[0]?.payload as
                  | LifetimeCategoryDatum
                  | undefined;
                if (!payload || typeof payload.id !== "string") return;
                handleBarClick(payload.id);
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
                  const item = payload[0]?.payload as
                    | LifetimeCategoryDatum
                    | undefined;
                  if (!item) return null;
                  const txCount = item.txCount;
                  return (
                    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                      <p className="font-semibold text-slate-800">
                        {item.name}
                      </p>
                      <p className="text-slate-600">{currency(item.total)}</p>
                      {Number.isFinite(txCount) && txCount > 0 ? (
                        <p className="text-slate-500">{txCount} tx</p>
                      ) : null}
                    </div>
                  );
                }}
              />
              <Bar dataKey="total" radius={[6, 6, 6, 6]}>
                {categoryData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title="No lifetime category data yet." />
        )}
      </CardContent>
    </Card>
  );
};
