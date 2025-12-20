import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import type { TotalTimeseriesDialogState } from "../reports-types";
import { currency, formatDate, isRecord } from "../reports-utils";

export type SavingsRatePoint = {
  date: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  ratePct: number | null;
  rolling12mPct: number | null;
  index: number;
};

export const TotalSavingsRateCard: React.FC<{
  loading: boolean;
  series: SavingsRatePoint[];
  seriesAll: SavingsRatePoint[];
  domain: [number, number];
  onOpenTimeseriesDialog: (state: TotalTimeseriesDialogState) => void;
}> = ({ loading, series, seriesAll, domain, onOpenTimeseriesDialog }) => (
  <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
      <div>
        <CardTitle className="text-base font-semibold text-slate-900">
          Savings rate
        </CardTitle>
        <p className="text-xs text-slate-500">
          Monthly vs rolling 12m (income − expense / income).
        </p>
      </div>
    </CardHeader>
    <CardContent className="h-80">
      {loading ? (
        <Skeleton className="h-full w-full" />
      ) : !series.length ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-600">
          No savings history yet.
        </div>
      ) : (
        <div className="h-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={series}
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
                const income = Number(payload.income ?? 0);
                const expense = Number(payload.expense ?? 0);
                const net = Number(payload.net ?? income - expense);
                const ratePct =
                  typeof payload.ratePct === "number"
                    ? Number(payload.ratePct)
                    : null;
                const rolling12mPct =
                  typeof payload.rolling12mPct === "number"
                    ? Number(payload.rolling12mPct)
                    : null;
                const idx =
                  typeof payload.index === "number"
                    ? Number(payload.index)
                    : null;
                if (idx === null) return;
                const window = seriesAll
                  .slice(Math.max(0, idx - 11), idx + 1)
                  .map((row) => ({
                    date: row.date,
                    label: row.label,
                    income: row.income,
                    expense: row.expense,
                    net: row.net,
                    ratePct: row.ratePct,
                  }));
                onOpenTimeseriesDialog({
                  kind: "savingsRate",
                  date,
                  income,
                  expense,
                  net,
                  ratePct,
                  rolling12mPct,
                  window,
                });
              }}
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
                domain={domain}
                tick={{ fill: "#475569", fontSize: 12 }}
                tickFormatter={(v) => `${Number(v)}%`}
              />
              <ReferenceLine y={0} stroke="#cbd5e1" />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload;
                  if (!isRecord(row)) return null;
                  const date = String(row.date ?? "");
                  const label = date
                    ? formatDate(date, { year: "numeric", month: "long" })
                    : "Month";
                  const income = Number(row.income ?? 0);
                  const expense = Number(row.expense ?? 0);
                  const net = Number(row.net ?? income - expense);
                  const rate =
                    typeof row.ratePct === "number"
                      ? Number(row.ratePct)
                      : null;
                  const rolling =
                    typeof row.rolling12mPct === "number"
                      ? Number(row.rolling12mPct)
                      : null;
                  return (
                    <div className="rounded-md border bg-white px-3 py-2 text-xs shadow-sm">
                      <p className="font-semibold text-slate-800">{label}</p>
                      <div className="mt-1 space-y-0.5 text-slate-700">
                        <p>
                          Savings rate:{" "}
                          {rate === null ? "—" : `${rate.toFixed(1)}%`}
                        </p>
                        <p>
                          Rolling 12m:{" "}
                          {rolling === null ? "—" : `${rolling.toFixed(1)}%`}
                        </p>
                        <p>Income: {currency(income)}</p>
                        <p>Expense: {currency(expense)}</p>
                        <p>Net: {currency(net)}</p>
                      </div>
                      <p className="mt-2 text-[11px] text-slate-500">
                        Click for details
                      </p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="rolling12mPct"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={false}
                name="Rolling 12m"
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="ratePct"
                stroke="#0f172a"
                strokeWidth={2}
                dot={false}
                name="Monthly"
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </CardContent>
  </Card>
);
