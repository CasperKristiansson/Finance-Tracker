import React from "react";
import { Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageRoutes } from "@/data/routes";

import { ChartCard } from "./chart-card";
import { currency, percent } from "../reports-utils";
import type { TotalDrilldownState } from "../reports-types";

export type TotalNetWorthStats = {
  asOf: string;
  current: number;
  delta12m: number | null;
  delta12mPct: number | null;
  deltaSinceStart: number;
  deltaSinceStartPct: number | null;
  allTimeHigh: number;
  allTimeHighDate: string;
  allTimeLow: number;
};

export type TotalNetWorthAttribution = {
  windowStart: string;
  windowEnd: string;
  netWorthDelta: number;
  savings: number;
  investmentsContribution: number | null;
  debtContribution: number;
  remainder: number;
};

export const TotalNetWorthGrowthCard: React.FC<{
  loading: boolean;
  totalWindowPreset: "all" | "10" | "5" | "3";
  hasOverview: boolean;
  hasNetWorthHistory: boolean;
  netWorthStats: TotalNetWorthStats | null;
  netWorthAttribution: TotalNetWorthAttribution | null;
  onOpenDrilldownDialog: (state: TotalDrilldownState) => void;
}> = ({
  loading,
  totalWindowPreset,
  hasOverview,
  hasNetWorthHistory,
  netWorthStats,
  netWorthAttribution,
  onOpenDrilldownDialog,
}) => {
  return (
    <ChartCard
      title="Net worth growth"
      description={
        totalWindowPreset === "all"
          ? "Monthly net worth snapshot (ledger + investments)."
          : `Monthly net worth snapshot (last ${totalWindowPreset} years).`
      }
      loading={loading}
      contentClassName="h-[26rem]"
    >
      {!hasOverview && !loading ? (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-600">
          <Sparkles className="h-6 w-6 text-slate-500" />
          <p className="text-center">
            No data yet. Import files or add transactions.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link to={PageRoutes.imports}>Go to Imports</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link to={PageRoutes.transactions}>Add transactions</Link>
            </Button>
          </div>
        </div>
      ) : !hasNetWorthHistory ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-slate-600">
          <p>No net worth history yet.</p>
        </div>
      ) : (
        <div className="flex h-full flex-col gap-3">
          {netWorthStats ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-md border border-slate-100 bg-slate-50 p-3 text-left"
                onClick={() => onOpenDrilldownDialog({ kind: "netWorth" })}
              >
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Current (as of{" "}
                  {new Date(netWorthStats.asOf).toLocaleDateString("sv-SE")})
                </p>
                <p className="font-semibold text-slate-900">
                  {currency(netWorthStats.current)}
                </p>
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-100 bg-slate-50 p-3 text-left"
                onClick={() => onOpenDrilldownDialog({ kind: "netWorth" })}
              >
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Change (12m)
                </p>
                <p className="font-semibold text-slate-900">
                  {netWorthStats.delta12m === null ? (
                    "—"
                  ) : (
                    <>
                      <span
                        className={
                          netWorthStats.delta12m >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }
                      >
                        {netWorthStats.delta12m >= 0 ? "+" : "−"}
                        {currency(Math.abs(netWorthStats.delta12m))}
                      </span>
                      {netWorthStats.delta12mPct === null ? null : (
                        <span className="ml-2 text-xs text-slate-600">
                          ({percent(netWorthStats.delta12mPct)})
                        </span>
                      )}
                    </>
                  )}
                </p>
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-100 bg-slate-50 p-3 text-left"
                onClick={() => onOpenDrilldownDialog({ kind: "netWorth" })}
              >
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Change (since start)
                </p>
                <p className="font-semibold text-slate-900">
                  <span
                    className={
                      netWorthStats.deltaSinceStart >= 0
                        ? "text-emerald-700"
                        : "text-rose-700"
                    }
                  >
                    {netWorthStats.deltaSinceStart >= 0 ? "+" : "−"}
                    {currency(Math.abs(netWorthStats.deltaSinceStart))}
                  </span>
                  {netWorthStats.deltaSinceStartPct === null ? null : (
                    <span className="ml-2 text-xs text-slate-600">
                      ({percent(netWorthStats.deltaSinceStartPct)})
                    </span>
                  )}
                </p>
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-100 bg-slate-50 p-3 text-left"
                onClick={() => onOpenDrilldownDialog({ kind: "netWorth" })}
              >
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Range
                </p>
                <p className="font-semibold text-slate-900">
                  {currency(netWorthStats.allTimeLow)} →{" "}
                  {currency(netWorthStats.allTimeHigh)}
                </p>
                <p className="text-xs text-slate-600">
                  High:{" "}
                  {new Date(netWorthStats.allTimeHighDate).toLocaleDateString(
                    "sv-SE",
                  )}
                </p>
              </button>
            </div>
          ) : null}

          {netWorthAttribution ? (
            <button
              type="button"
              className="rounded-md border border-slate-100 bg-white p-3 text-left transition hover:bg-slate-50"
              onClick={() => onOpenDrilldownDialog({ kind: "netWorth" })}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                    Change Attribution
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(netWorthAttribution.windowStart).getFullYear()}–
                    {new Date(netWorthAttribution.windowEnd).getFullYear()}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  {netWorthAttribution.netWorthDelta >= 0 ? "+" : "−"}
                  {currency(Math.abs(netWorthAttribution.netWorthDelta))}
                </p>
              </div>
              <div className="mt-3 space-y-2">
                {(
                  [
                    {
                      label: "Savings (income − expense)",
                      value: netWorthAttribution.savings,
                    },
                    netWorthAttribution.investmentsContribution === null
                      ? null
                      : {
                          label: "Investments change",
                          value: netWorthAttribution.investmentsContribution,
                        },
                    {
                      label: "Debt change",
                      value: netWorthAttribution.debtContribution,
                    },
                    {
                      label: "Remainder",
                      value: netWorthAttribution.remainder,
                    },
                  ] as Array<null | { label: string; value: number }>
                )
                  .filter(Boolean)
                  .map((row) => {
                    if (!row) return null;
                    const total = Math.max(
                      1,
                      Math.abs(netWorthAttribution.netWorthDelta),
                    );
                    const pct = (Math.abs(row.value) / total) * 100;
                    return (
                      <div key={row.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-slate-600">
                          <span>{row.label}</span>
                          <span
                            className={
                              row.value >= 0
                                ? "font-medium text-emerald-700"
                                : "font-medium text-rose-700"
                            }
                          >
                            {row.value >= 0 ? "+" : "−"}
                            {currency(Math.abs(row.value))}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={Math.min(100, pct)}
                            className="h-2"
                          />
                          <span className="w-10 text-right text-[11px] text-slate-500">
                            {percent(pct)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </button>
          ) : null}
        </div>
      )}
    </ChartCard>
  );
};
