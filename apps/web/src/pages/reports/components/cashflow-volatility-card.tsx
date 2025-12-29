import React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { CashflowVolatilitySummary } from "../reports-types";
import { currency } from "../reports-utils";

const formatCv = (cv: number | null) =>
  cv === null ? "—" : `${(cv * 100).toFixed(1)}%`;

const stabilityScoreClass = (score: number | null) => {
  if (score === null) return "text-slate-900";
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-rose-600";
};

const spikeBadgeStyles: Record<
  CashflowVolatilitySummary["spikes"][number]["kind"],
  string
> = {
  income: "bg-emerald-100 text-emerald-700",
  expense: "bg-rose-100 text-rose-700",
  net: "bg-indigo-100 text-indigo-700",
};

const spikeKindLabel: Record<
  CashflowVolatilitySummary["spikes"][number]["kind"],
  string
> = {
  income: "Income spike",
  expense: "Expense spike",
  net: "Net spike",
};

export const CashflowVolatilityCard: React.FC<{
  title: string;
  description: string;
  loading: boolean;
  volatility: CashflowVolatilitySummary | null;
}> = ({ title, description, loading, volatility }) => {
  return (
    <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          {title}
        </CardTitle>
        <p className="text-xs text-slate-500">{description}</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-52 w-full" />
        ) : !volatility ? (
          <div className="flex h-52 items-center justify-center text-sm text-slate-600">
            Monthly series unavailable.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Stability score
                </p>
                <p
                  className={`text-3xl font-semibold ${stabilityScoreClass(
                    volatility.stabilityScore,
                  )}`}
                >
                  {volatility.stabilityScore === null
                    ? "—"
                    : `${Math.round(volatility.stabilityScore)}%`}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Lower CVs raise the score.
              </p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[11px] text-slate-400 uppercase">
                <span>Metric</span>
                <span className="text-right">Std dev</span>
                <span className="text-right">CV</span>
              </div>
              {[
                { label: "Income", metric: volatility.income },
                { label: "Expense", metric: volatility.expense },
                { label: "Net", metric: volatility.net },
              ].map((row) => (
                <div
                  key={row.label}
                  className="grid grid-cols-[1fr_auto_auto] gap-2 text-slate-700"
                >
                  <span>{row.label}</span>
                  <span className="text-right font-semibold text-slate-900">
                    {currency(row.metric.stdDev)}
                  </span>
                  <span className="text-right text-slate-600">
                    {formatCv(row.metric.cv)}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Spike months
              </p>
              {volatility.spikes.length ? (
                <div className="flex flex-wrap gap-2">
                  {volatility.spikes.map((spike) => (
                    <Badge
                      key={`${spike.date}-${spike.kind}`}
                      className={spikeBadgeStyles[spike.kind]}
                    >
                      {spike.label} • {spikeKindLabel[spike.kind]}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No months beyond 1.5σ.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
