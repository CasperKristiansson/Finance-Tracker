import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";

import type {
  TotalDrilldownState,
  TotalTimeseriesDialogState,
} from "../reports-types";
import { compactCurrency, currency, isRecord } from "../reports-utils";

type Point = {
  date: string;
  label: string;
  cash: number;
  investments: number;
  debt: number;
  debtNeg: number;
  netWorth: number;
};

export const TotalNetWorthBreakdownCard: React.FC<{
  loading: boolean;
  series: Point[];
  domain: [number, number];
  onOpenTimeseriesDialog: (state: TotalTimeseriesDialogState) => void;
  onOpenDrilldownDialog: (state: TotalDrilldownState) => void;
}> = ({
  loading,
  series,
  domain,
  onOpenTimeseriesDialog,
  onOpenDrilldownDialog,
}) => (
  <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
      <div>
        <CardTitle className="text-base font-semibold text-slate-900">
          Net worth breakdown
        </CardTitle>
        <p className="text-xs text-slate-500">
          Cash + investments − debt (monthly).
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onOpenDrilldownDialog({ kind: "netWorth" })}
      >
        Details
      </Button>
    </CardHeader>
    <CardContent className="h-80">
      {loading ? (
        <Skeleton className="h-full w-full" />
      ) : !series.length ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-600">
          No net worth components yet.
        </div>
      ) : (
        <ChartContainer
          className="h-full w-full"
          config={{
            cash: { label: "Cash", color: "#0f172a" },
            investments: { label: "Investments", color: "#4f46e5" },
            debtNeg: { label: "Debt", color: "#f97316" },
          }}
        >
          <AreaChart
            data={series}
            margin={{ left: 0, right: 0, top: 10, bottom: 0 }}
            onClick={(
              state:
                | {
                    activePayload?: Array<{ payload?: unknown }>;
                  }
                | null
                | undefined,
            ) => {
              const payload = state?.activePayload?.[0]?.payload ?? null;
              if (!isRecord(payload)) return;
              const date =
                typeof payload.date === "string" ? payload.date : null;
              if (!date) return;
              const idx = series.findIndex((row) => row.date === date);
              if (idx < 0) return;
              const row = series[idx];
              const prev = idx > 0 ? series[idx - 1] : null;
              const deltaMoM = prev ? row.netWorth - prev.netWorth : null;
              const target = new Date(date);
              target.setUTCFullYear(target.getUTCFullYear() - 1);
              const targetIso = target.toISOString().slice(0, 10);
              let yearAgo: Point | null = null;
              for (let i = idx; i >= 0; i -= 1) {
                const candidate = series[i];
                if (candidate.date <= targetIso) {
                  yearAgo = candidate;
                  break;
                }
              }
              const deltaYoY = yearAgo ? row.netWorth - yearAgo.netWorth : null;
              const assets = row.cash + row.investments;
              onOpenTimeseriesDialog({
                kind: "netWorthBreakdown",
                date,
                cash: row.cash,
                investments: row.investments,
                debt: row.debt,
                netWorth: row.netWorth,
                deltaMoM,
                deltaYoY,
                shareCashPct: assets > 0 ? (row.cash / assets) * 100 : null,
                shareInvestmentsPct:
                  assets > 0 ? (row.investments / assets) * 100 : null,
                shareDebtPct: assets > 0 ? (row.debt / assets) * 100 : null,
              });
            }}
          >
            <defs>
              <linearGradient
                id="cashFillTotalBreakdown"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#0f172a" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
              </linearGradient>
              <linearGradient
                id="invFillTotalBreakdown"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
              </linearGradient>
              <linearGradient
                id="debtFillTotalBreakdown"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              domain={domain}
              allowDataOverflow
              tickMargin={12}
              width={90}
              tickFormatter={(v) => compactCurrency(Number(v))}
            />
            <ReferenceLine y={0} stroke="#cbd5e1" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0]?.payload;
                if (!isRecord(row)) return null;
                const date = String(row.date ?? "");
                const label = date
                  ? new Date(date).toLocaleDateString("sv-SE", {
                      year: "numeric",
                      month: "long",
                    })
                  : "Month";
                const cash = Number(row.cash ?? 0);
                const inv = Number(row.investments ?? 0);
                const debt = Number(row.debt ?? 0);
                const net = Number(row.netWorth ?? 0);
                return (
                  <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                    <p className="font-semibold text-slate-800">{label}</p>
                    <div className="mt-1 space-y-0.5 text-slate-700">
                      <p>Net worth: {currency(net)}</p>
                      <p>Cash: {currency(cash)}</p>
                      <p>Investments: {currency(inv)}</p>
                      <p>Debt: {currency(debt)}</p>
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500">
                      Click for details
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotoneX"
              dataKey="cash"
              stackId="assets"
              stroke="#0f172a"
              fill="url(#cashFillTotalBreakdown)"
              strokeWidth={2}
              name="Cash"
            />
            <Area
              type="monotoneX"
              dataKey="investments"
              stackId="assets"
              stroke="#4f46e5"
              fill="url(#invFillTotalBreakdown)"
              strokeWidth={2}
              name="Investments"
            />
            <Area
              type="monotoneX"
              dataKey="debtNeg"
              stackId="assets"
              stroke="#f97316"
              fill="url(#debtFillTotalBreakdown)"
              strokeWidth={2}
              name="Debt"
            />
          </AreaChart>
        </ChartContainer>
      )}
    </CardContent>
  </Card>
);
