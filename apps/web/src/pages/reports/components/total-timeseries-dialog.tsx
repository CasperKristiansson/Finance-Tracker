import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

import type { TotalTimeseriesDialogState } from "../reports-types";
import { compactCurrency, currency } from "../reports-utils";

export const TotalTimeseriesDialog: React.FC<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: TotalTimeseriesDialogState | null;
  savingsRateDomain: [number, number];
  onOpenNetWorthDetails: () => void;
}> = ({
  open,
  onOpenChange,
  state,
  savingsRateDomain,
  onOpenNetWorthDetails,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle>
          {state?.kind === "netWorthBreakdown"
            ? `Net worth breakdown • ${new Date(state.date).toLocaleDateString(
                "sv-SE",
                { year: "numeric", month: "long" },
              )}`
            : state?.kind === "savingsRate"
              ? `Savings rate • ${new Date(state.date).toLocaleDateString(
                  "sv-SE",
                  { year: "numeric", month: "long" },
                )}`
              : "Details"}
        </DialogTitle>
      </DialogHeader>

      {!state ? null : state.kind === "netWorthBreakdown" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Net worth
              </p>
              <p className="font-semibold text-slate-900">
                {currency(state.netWorth)}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Cash
              </p>
              <p className="font-semibold text-slate-900">
                {currency(state.cash)}
              </p>
              <p className="text-xs text-slate-600">
                {state.shareCashPct === null
                  ? "—"
                  : `${state.shareCashPct.toFixed(0)}% of assets`}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Investments
              </p>
              <p className="font-semibold text-slate-900">
                {currency(state.investments)}
              </p>
              <p className="text-xs text-slate-600">
                {state.shareInvestmentsPct === null
                  ? "—"
                  : `${state.shareInvestmentsPct.toFixed(0)}% of assets`}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Debt
              </p>
              <p className="font-semibold text-slate-900">
                {currency(state.debt)}
              </p>
              <p className="text-xs text-slate-600">
                {state.shareDebtPct === null
                  ? "—"
                  : `${state.shareDebtPct.toFixed(0)}% of assets`}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3 rounded-md border border-slate-100 bg-white p-3">
              <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                Composition
              </p>
              {(
                [
                  { label: "Cash", value: state.shareCashPct },
                  { label: "Investments", value: state.shareInvestmentsPct },
                  { label: "Debt", value: state.shareDebtPct },
                ] as const
              ).map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <span>{row.label}</span>
                    <span className="font-medium text-slate-800">
                      {row.value === null ? "—" : `${row.value.toFixed(0)}%`}
                    </span>
                  </div>
                  <Progress
                    value={row.value === null ? 0 : Math.max(0, row.value)}
                    className="h-2"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-3 rounded-md border border-slate-100 bg-white p-3">
              <p className="text-xs font-semibold tracking-wide text-slate-700 uppercase">
                Deltas
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    MoM
                  </p>
                  <p className="font-semibold text-slate-900">
                    {state.deltaMoM === null ? (
                      "—"
                    ) : (
                      <span
                        className={
                          state.deltaMoM >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }
                      >
                        {state.deltaMoM >= 0 ? "+" : "−"}
                        {currency(Math.abs(state.deltaMoM))}
                      </span>
                    )}
                  </p>
                </div>
                <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs tracking-wide text-slate-500 uppercase">
                    YoY
                  </p>
                  <p className="font-semibold text-slate-900">
                    {state.deltaYoY === null ? (
                      "—"
                    ) : (
                      <span
                        className={
                          state.deltaYoY >= 0
                            ? "text-emerald-700"
                            : "text-rose-700"
                        }
                      >
                        {state.deltaYoY >= 0 ? "+" : "−"}
                        {currency(Math.abs(state.deltaYoY))}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  onOpenNetWorthDetails();
                }}
              >
                Open full net worth details
              </Button>
            </div>
          </div>
        </div>
      ) : state.kind === "savingsRate" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Savings rate
              </p>
              <p className="font-semibold text-slate-900">
                {state.ratePct === null ? "—" : `${state.ratePct.toFixed(1)}%`}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Rolling 12m
              </p>
              <p className="font-semibold text-slate-900">
                {state.rolling12mPct === null
                  ? "—"
                  : `${state.rolling12mPct.toFixed(1)}%`}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Income
              </p>
              <p className="font-semibold text-slate-900">
                {currency(state.income)}
              </p>
            </div>
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
              <p className="text-xs tracking-wide text-slate-500 uppercase">
                Expense / Net
              </p>
              <p className="font-semibold text-slate-900">
                {currency(state.expense)}
              </p>
              <p className="text-xs text-slate-600">
                Net: {currency(state.net)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={state.window.map((row) => ({
                    label: row.label,
                    income: row.income,
                    expenseNeg: -row.expense,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    tickFormatter={(v) => compactCurrency(Number(v))}
                  />
                  <Tooltip
                    formatter={(value) => currency(Math.abs(Number(value)))}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <Bar
                    dataKey="income"
                    name="Income"
                    fill="#10b981"
                    radius={[6, 6, 4, 4]}
                  />
                  <Bar
                    dataKey="expenseNeg"
                    name="Expense"
                    fill="#ef4444"
                    radius={[6, 6, 4, 4]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="h-72 rounded-md border border-slate-100 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={state.window}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#475569", fontSize: 12 }}
                    domain={savingsRateDomain}
                    tickFormatter={(v) => `${Number(v)}%`}
                  />
                  <ReferenceLine y={0} stroke="#cbd5e1" />
                  <Tooltip
                    formatter={(value) => `${Number(value).toFixed(1)}%`}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ratePct"
                    stroke="#0f172a"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContent>
  </Dialog>
);
