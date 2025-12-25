import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { percent } from "../reports-utils";
import type { CategoryConcentration } from "../reports-utils";

type CategoryConcentrationCardProps = {
  flow: "income" | "expense";
  title: string;
  description?: string;
  loading?: boolean;
  concentration: CategoryConcentration | null;
};

export const CategoryConcentrationCard: React.FC<
  CategoryConcentrationCardProps
> = ({ flow, title, description, loading, concentration }) => {
  const accentColor = flow === "income" ? "#10b981" : "#ef4444";

  return (
    <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        {description ? (
          <p className="text-xs text-slate-500">{description}</p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : !concentration ? (
          <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-500">
            No category data yet.
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="text-[11px] tracking-wide text-slate-500 uppercase">
                Top 3 share
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {percent(concentration.topSharePct, {
                  maximumFractionDigits: 1,
                })}
              </p>
              <p className="text-xs text-slate-500">
                Portion of total {flow} across categories.
              </p>
            </div>

            <div className="space-y-2">
              {concentration.topCategories.map((category) => (
                <div
                  key={category.name}
                  className="flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 text-slate-700">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{
                        backgroundColor: category.color ?? accentColor,
                      }}
                    />
                    {category.name}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {percent(category.sharePct, { maximumFractionDigits: 1 })}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-slate-100 bg-white/80 p-3">
              <p className="text-[11px] tracking-wide text-slate-500 uppercase">
                Diversity score
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {percent(concentration.diversityScorePct, {
                  maximumFractionDigits: 1,
                })}
              </p>
              <p className="text-xs text-slate-500">
                Higher scores mean more balanced category mix.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
