import React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { applyInvestmentGrowth } from "@/lib/investment-growth";
import type { YearlyOverviewResponse } from "@/types/api";

import type { ReportMode } from "../reports-types";
import { currency, percent } from "../reports-utils";

type TotalKpis = {
  totalMoney: number;
  netWorth: number;
  cashBalance: number;
  debtTotal: number;
  investmentsValue: number | null;
  lifetimeIncome: number;
  lifetimeExpense: number;
  lifetimeSaved: number;
  lifetimeSavingsRate: number | null;
} | null;

export const ReportsOverviewCard: React.FC<{
  routeMode: ReportMode;
  year: number;
  overview: YearlyOverviewResponse | null;
  totalKpis: TotalKpis;
  includeInvestmentGrowth: boolean;
}> = ({ routeMode, year, overview, totalKpis, includeInvestmentGrowth }) => (
  <Card className="border-slate-200 shadow-[0_12px_36px_-26px_rgba(15,23,42,0.35)]">
    <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div>
        <CardTitle className="text-sm text-slate-700">Overview</CardTitle>
        <p className="text-sm text-slate-500">
          Key totals for {routeMode === "yearly" ? year : "all time"}.
        </p>
      </div>
    </CardHeader>
    {routeMode === "yearly" && overview ? (
      <CardContent className="grid gap-3 md:grid-cols-4">
        {(() => {
          const growth = overview.monthly.reduce(
            (sum, row) => sum + Number(row.investment_market_growth ?? 0),
            0,
          );
          const adjusted = applyInvestmentGrowth(
            Number(overview.stats.total_income),
            Number(overview.stats.total_expense),
            growth,
            includeInvestmentGrowth,
          );
          const savingsRate =
            overview.stats.savings_rate_pct != null
              ? Number(overview.stats.savings_rate_pct)
              : Number(overview.stats.total_income) > 0
                ? (Number(overview.stats.net_savings) /
                    Number(overview.stats.total_income)) *
                  100
                : null;
          return [
            {
              label: "Income",
              value: adjusted.income,
              color: "text-emerald-700",
            },
            {
              label: "Expense",
              value: adjusted.expense,
              color: "text-rose-700",
            },
            {
              label: "Net saved",
              value: adjusted.net,
              color: "text-slate-900",
            },
            {
              label: "Savings rate",
              value: savingsRate,
              color: "text-slate-900",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-4"
            >
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                {item.label}
              </p>
              <div className={`text-2xl font-semibold ${item.color}`}>
                {item.value === null
                  ? "—"
                  : item.label === "Savings rate"
                    ? `${Math.round(item.value)}%`
                    : currency(item.value)}
              </div>
            </div>
          ));
        })()}
      </CardContent>
    ) : routeMode === "total" && totalKpis ? (
      <CardContent className="grid gap-3 md:grid-cols-6">
        {[
          {
            label: "Total money",
            value: totalKpis.totalMoney,
            format: "currency" as const,
            color: "text-slate-900",
          },
          {
            label: "Net worth",
            value: totalKpis.netWorth,
            format: "currency" as const,
            color: "text-slate-900",
          },
          {
            label: "Lifetime saved",
            value: totalKpis.lifetimeSaved,
            format: "currency" as const,
            color:
              totalKpis.lifetimeSaved >= 0
                ? "text-emerald-700"
                : "text-rose-700",
          },
          {
            label: "Savings rate (lifetime)",
            value: totalKpis.lifetimeSavingsRate,
            format: "percent" as const,
            color: "text-slate-900",
          },
          {
            label: "Debt",
            value: totalKpis.debtTotal,
            format: "currency" as const,
            color: "text-orange-700",
          },
          {
            label: "Investments",
            value: totalKpis.investmentsValue,
            format: "currency" as const,
            color: "text-indigo-700",
          },
        ].map((item) => (
          <div
            key={item.label}
            className="space-y-1 rounded-lg border border-slate-100 bg-slate-50 p-4"
          >
            <p className="text-xs tracking-wide text-slate-500 uppercase">
              {item.label}
            </p>
            <div className={`text-2xl font-semibold ${item.color}`}>
              {item.value === null
                ? "—"
                : item.format === "percent"
                  ? percent(item.value)
                  : currency(item.value)}
            </div>
          </div>
        ))}
      </CardContent>
    ) : null}
  </Card>
);
