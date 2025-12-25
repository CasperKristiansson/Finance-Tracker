import React from "react";

import { EmptyState } from "@/components/composed/empty-state";
import { LoadingCard } from "@/components/composed/loading-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { CategoryConcentration } from "../reports-utils";
import { percent } from "../reports-utils";

export const CategoryConcentrationCard: React.FC<{
  flow: "income" | "expense";
  loading: boolean;
  hasOverview: boolean;
  concentration: CategoryConcentration | null;
}> = ({ flow, loading, hasOverview, concentration }) => {
  const title =
    flow === "income"
      ? "Income category concentration"
      : "Expense category concentration";
  const accent = flow === "income" ? "#10b981" : "#ef4444";

  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        <p className="text-xs text-slate-500">
          How much of the total sits in the top categories.
        </p>
      </CardHeader>
      <CardContent>
        {loading && !hasOverview ? (
          <LoadingCard className="h-56" lines={6} />
        ) : !concentration ? (
          <EmptyState className="h-56" title="No category data yet." />
        ) : (
          <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs text-slate-400 uppercase">Top 3 share</p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {percent(concentration.topSharePct)}
                </p>
                <p className="text-xs text-slate-500">
                  Combined share of the three biggest categories.
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-xs text-slate-400 uppercase">
                  Diversity score
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {percent(concentration.diversityScore)}
                </p>
                <p className="text-xs text-slate-500">
                  Higher means the mix is more balanced.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Top categories
              </p>
              {concentration.topCategories.map((row) => (
                <div
                  key={row.name}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {row.name}
                    </span>
                    <span className="text-slate-500">
                      {percent(row.sharePct)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.min(100, row.sharePct)}%`,
                        backgroundColor: accent,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
