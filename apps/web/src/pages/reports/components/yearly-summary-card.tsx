import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { YearlyOverviewResponse } from "@/types/api";

import { currency, monthName } from "../reports-utils";

export const YearlySummaryCard: React.FC<{
  year: number;
  overview: YearlyOverviewResponse | null;
}> = ({ year, overview }) => {
  return (
    <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          Summary
        </CardTitle>
        <p className="text-xs text-slate-500">
          High-signal totals and highlights.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!overview ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Total income</span>
              <span className="font-semibold text-emerald-700">
                {currency(Number(overview.stats.total_income))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Total expenses</span>
              <span className="font-semibold text-rose-700">
                {currency(Number(overview.stats.total_expense))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Net savings</span>
              <span className="font-semibold text-slate-900">
                {currency(Number(overview.stats.net_savings))}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Savings rate</span>
              <span className="font-semibold text-slate-900">
                {overview.stats.savings_rate_pct
                  ? `${Math.round(Number(overview.stats.savings_rate_pct))}%`
                  : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Avg monthly spend</span>
              <span className="font-semibold text-slate-900">
                {currency(Number(overview.stats.avg_monthly_spend))}
              </span>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold">Biggest months</p>
              <p>
                Income:{" "}
                {monthName(year, overview.stats.biggest_income_month.month)} (
                {currency(Number(overview.stats.biggest_income_month.amount))})
              </p>
              <p>
                Expense:{" "}
                {monthName(year, overview.stats.biggest_expense_month.month)} (
                {currency(Number(overview.stats.biggest_expense_month.amount))})
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
