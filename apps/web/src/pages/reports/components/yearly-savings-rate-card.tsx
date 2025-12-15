import React, { useMemo } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

import type { YearlyOverviewResponse } from "@/types/api";

import { currency } from "../reports-utils";

export type YearlySavings = {
  income: number;
  expense: number;
  saved: number;
  rate: number | null;
};

export const YearlySavingsRateCard: React.FC<{
  savings: YearlyOverviewResponse["savings"] | null | undefined;
}> = ({ savings: rawSavings }) => {
  const savings = useMemo<YearlySavings | null>(() => {
    if (!rawSavings) return null;
    return {
      income: Number(rawSavings.income),
      expense: Number(rawSavings.expense),
      saved: Number(rawSavings.saved),
      rate: rawSavings.savings_rate_pct
        ? Number(rawSavings.savings_rate_pct)
        : null,
    };
  }, [rawSavings]);

  return (
    <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          Saving rate
        </CardTitle>
        <p className="text-xs text-slate-500">
          Income, expense, and what you kept.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!savings ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Savings rate
                </p>
                <p className="text-3xl font-semibold text-slate-900">
                  {savings.rate === null ? "—" : `${Math.round(savings.rate)}%`}
                </p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>{currency(savings.saved)} saved</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Income</span>
                  <span className="font-semibold text-emerald-700">
                    {currency(savings.income)}
                  </span>
                </div>
                <Progress value={100} className="h-2" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Expense</span>
                  <span className="font-semibold text-rose-700">
                    {currency(savings.expense)}
                  </span>
                </div>
                <Progress
                  value={
                    savings.income > 0
                      ? Math.min(100, (savings.expense / savings.income) * 100)
                      : 0
                  }
                  className="h-2"
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Saved</span>
                  <span className="font-semibold text-slate-900">
                    {currency(savings.saved)}
                  </span>
                </div>
                <Progress
                  value={
                    savings.income > 0
                      ? Math.max(
                          0,
                          Math.min(100, (savings.saved / savings.income) * 100),
                        )
                      : 0
                  }
                  className="h-2"
                />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
