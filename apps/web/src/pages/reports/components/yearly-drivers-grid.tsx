import React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { YearlyOverviewResponse } from "@/types/api";
import type { YearlyExtraDialogState } from "../reports-types";
import { currency } from "../reports-utils";

type CategoryDeltaRow = {
  key: string;
  id: string | null;
  name: string;
  delta: number;
};

type SourceDeltaRow = {
  source: string;
  delta: number;
};

type SavingsDecomposition = {
  netDelta: number;
  netPrev: number;
  netNow: number;
  contributions: Array<{
    kind: "income" | "expense";
    id: string | null;
    name: string;
    contribution: number;
  }>;
};

export const YearlyDriversGrid: React.FC<{
  year: number;
  overview: YearlyOverviewResponse | null;
  prevOverview: YearlyOverviewResponse | null;
  prevOverviewLoading: boolean;
  yearlyExpenseCategoryDeltas: CategoryDeltaRow[];
  yearlyExpenseSourceDeltas: SourceDeltaRow[];
  yearlySavingsDecomposition: SavingsDecomposition | null;
  onOpenExtraDialog: (state: YearlyExtraDialogState) => void;
  onOpenSourceDetail: (flow: "income" | "expense", source: string) => void;
  onSelectCategory: (flow: "income" | "expense", categoryId: string) => void;
}> = ({
  year,
  overview,
  prevOverview,
  prevOverviewLoading,
  yearlyExpenseCategoryDeltas,
  yearlyExpenseSourceDeltas,
  yearlySavingsDecomposition,
  onOpenExtraDialog,
  onOpenSourceDetail,
  onSelectCategory,
}) => {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
      <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
        <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Category drivers
            </CardTitle>
            <p className="text-xs text-slate-500">
              Biggest YoY shifts (expense + income).
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenExtraDialog({ kind: "categoryDrivers" })}
            disabled={!overview || !prevOverview}
          >
            Details
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!overview ? (
            <Skeleton className="h-44 w-full" />
          ) : prevOverviewLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : !prevOverview ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              Need prior-year data to compute YoY drivers.
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-600">
                Comparing {year} vs {year - 1}
              </div>
              <div className="grid gap-2">
                {yearlyExpenseCategoryDeltas
                  .filter((row) => row.delta > 0)
                  .slice(0, 3)
                  .map((row) => (
                    <button
                      key={`exp-up-${row.key}`}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-left text-xs"
                      onClick={() => {
                        if (!row.id) return;
                        onSelectCategory("expense", row.id);
                      }}
                      disabled={!row.id}
                    >
                      <span className="max-w-[140px] truncate font-medium text-slate-900">
                        {row.name}
                      </span>
                      <span className="font-semibold text-rose-700">
                        +{currency(row.delta)}
                      </span>
                    </button>
                  ))}
                {yearlyExpenseCategoryDeltas
                  .filter((row) => row.delta < 0)
                  .slice(0, 2)
                  .map((row) => (
                    <button
                      key={`exp-down-${row.key}`}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-left text-xs"
                      onClick={() => {
                        if (!row.id) return;
                        onSelectCategory("expense", row.id);
                      }}
                      disabled={!row.id}
                    >
                      <span className="max-w-[140px] truncate font-medium text-slate-900">
                        {row.name}
                      </span>
                      <span className="font-semibold text-emerald-700">
                        −{currency(Math.abs(row.delta))}
                      </span>
                    </button>
                  ))}
              </div>
              <div className="text-xs text-slate-500">
                Tip: click an item to open its monthly breakdown.
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
        <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Merchant deltas
            </CardTitle>
            <p className="text-xs text-slate-500">
              Biggest YoY shifts by description.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              onOpenExtraDialog({ kind: "merchantDrivers", flow: "expense" })
            }
            disabled={!overview || !prevOverview}
          >
            Details
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!overview ? (
            <Skeleton className="h-44 w-full" />
          ) : prevOverviewLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : !prevOverview ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              Need prior-year data to compute merchant deltas.
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-600">
                Comparing {year} vs {year - 1}
              </div>
              <div className="grid gap-2">
                {yearlyExpenseSourceDeltas.slice(0, 5).map((row) => (
                  <button
                    key={row.source}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-left text-xs"
                    onClick={() => onOpenSourceDetail("expense", row.source)}
                  >
                    <span className="max-w-[150px] truncate font-medium text-slate-900">
                      {row.source}
                    </span>
                    <span
                      className={
                        row.delta <= 0
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-rose-700"
                      }
                    >
                      {row.delta >= 0 ? "+" : "−"}
                      {currency(Math.abs(row.delta))}
                    </span>
                  </button>
                ))}
              </div>
              <div className="text-xs text-slate-500">
                Click a merchant to compare monthly patterns.
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
        <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              One-off transactions
            </CardTitle>
            <p className="text-xs text-slate-500">
              Largest single expenses this year.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenExtraDialog({ kind: "oneOffs" })}
            disabled={!overview || !overview.largest_transactions.length}
          >
            Details
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {!overview ? (
            <Skeleton className="h-44 w-full" />
          ) : overview.largest_transactions.length ? (
            overview.largest_transactions.slice(0, 5).map((row) => (
              <button
                key={row.id}
                type="button"
                className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-left text-xs"
                onClick={() => onOpenExtraDialog({ kind: "oneOffs" })}
              >
                <span className="max-w-[150px] truncate font-medium text-slate-900">
                  {row.merchant}
                </span>
                <span className="font-semibold text-slate-900">
                  {currency(Number(row.amount))}
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              No large transactions yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
        <CardHeader className="flex flex-col gap-2 pb-2 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Savings decomposition
            </CardTitle>
            <p className="text-xs text-slate-500">
              Net = income − expense, vs last year.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onOpenExtraDialog({ kind: "savingsDecomposition" })}
            disabled={!yearlySavingsDecomposition}
          >
            Details
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!overview ? (
            <Skeleton className="h-44 w-full" />
          ) : prevOverviewLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : !yearlySavingsDecomposition ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
              Need prior-year data to decompose savings.
            </div>
          ) : (
            <>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Net change ({year} vs {year - 1})
                </p>
                <p
                  className={
                    yearlySavingsDecomposition.netDelta >= 0
                      ? "text-2xl font-semibold text-emerald-700"
                      : "text-2xl font-semibold text-rose-700"
                  }
                >
                  {yearlySavingsDecomposition.netDelta >= 0 ? "+" : "−"}
                  {currency(Math.abs(yearlySavingsDecomposition.netDelta))}
                </p>
                <p className="text-xs text-slate-600">
                  {currency(yearlySavingsDecomposition.netPrev)} →{" "}
                  {currency(yearlySavingsDecomposition.netNow)}
                </p>
              </div>
              <div className="grid gap-2">
                {yearlySavingsDecomposition.contributions
                  .slice(0, 4)
                  .map((row) => (
                    <button
                      key={`${row.kind}-${row.name}`}
                      type="button"
                      className="flex w-full items-center justify-between rounded-md border border-slate-100 bg-white px-3 py-2 text-left text-xs"
                      onClick={() => {
                        if (!row.id) return;
                        onSelectCategory(
                          row.kind === "income" ? "income" : "expense",
                          row.id,
                        );
                      }}
                      disabled={!row.id}
                    >
                      <span className="max-w-[150px] truncate font-medium text-slate-900">
                        {row.name}
                      </span>
                      <span
                        className={
                          row.contribution >= 0
                            ? "font-semibold text-emerald-700"
                            : "font-semibold text-rose-700"
                        }
                      >
                        {row.contribution >= 0 ? "+" : "−"}
                        {currency(Math.abs(row.contribution))}
                      </span>
                    </button>
                  ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
