import React, { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { currency, formatDate } from "../reports-utils";

type TotalWindowRange = { start: string; end: string } | null;

type TotalAverageExpense = {
  average: number;
  months: number;
  total: number;
};

type TotalMoneySnapshot = {
  asOf: string | null;
  cash: number;
};

export const CashRunwayCard: React.FC<{
  loading: boolean;
  windowRange: TotalWindowRange;
  averageExpense: TotalAverageExpense | null;
  cashSnapshot: TotalMoneySnapshot | null;
  runwayMonths: number | null;
}> = ({ loading, windowRange, averageExpense, cashSnapshot, runwayMonths }) => {
  const windowLabel = useMemo(() => {
    if (!windowRange) return "—";
    const start = formatDate(windowRange.start, {
      month: "short",
      year: "numeric",
    });
    const end = formatDate(windowRange.end, {
      month: "short",
      year: "numeric",
    });
    return `${start} → ${end}`;
  }, [windowRange]);

  const hasData = Boolean(
    averageExpense && cashSnapshot && Number.isFinite(runwayMonths ?? NaN),
  );

  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900">
            Cash runway
          </CardTitle>
          <p className="text-xs text-slate-500">
            Liquid cash divided by average monthly expenses.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : !hasData ? (
          <div className="flex h-32 items-center justify-center text-sm text-slate-600">
            Not enough data to estimate runway yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Liquid cash
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {currency(cashSnapshot?.cash ?? 0)}
              </p>
              <p className="text-[11px] text-slate-500">
                As of{" "}
                {formatDate(cashSnapshot?.asOf ?? new Date().toISOString(), {
                  month: "short",
                  year: "numeric",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Avg monthly expense
              </p>
              <p className="text-lg font-semibold text-slate-900">
                {currency(averageExpense?.average ?? 0)}
              </p>
              <p className="text-[11px] text-slate-500">
                Window: {windowLabel}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-emerald-50 p-3">
              <p className="text-xs tracking-wide text-emerald-700 uppercase">
                Runway
              </p>
              <p className="text-2xl font-semibold text-emerald-700">
                {(runwayMonths ?? 0).toFixed(1)} months
              </p>
              <p className="text-[11px] text-emerald-700/70">
                At current average spend rate
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
