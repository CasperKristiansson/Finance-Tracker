import React from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { TotalDrilldownState } from "../reports-types";
import { compactCurrency, currency } from "../reports-utils";

export const TotalDebtOverviewCard: React.FC<{
  hasOverview: boolean;
  debt: {
    totalCurrent: number;
    changeSincePrevYearEnd: number | null;
    debtToIncomeLatestYear: number | null;
  };
  series: Array<{ date: string; debt: number }>;
  accounts: Array<{
    id: string;
    name: string;
    current: number;
    delta: number | null;
  }>;
  onOpenDrilldownDialog: (state: TotalDrilldownState) => void;
}> = ({ hasOverview, debt, series, accounts, onOpenDrilldownDialog }) => {
  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          Debt overview
        </CardTitle>
        <p className="text-xs text-slate-500">
          Total debt and debt accounts. Values are as-of now, with a
          year-over-year anchor when available.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasOverview ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Total debt
                </p>
                <p className="font-semibold text-slate-900">
                  {currency(debt.totalCurrent)}
                </p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Δ vs prev year end
                </p>
                <p className="font-semibold text-slate-900">
                  {debt.changeSincePrevYearEnd === null
                    ? "—"
                    : `${debt.changeSincePrevYearEnd >= 0 ? "+" : "−"}${currency(
                        Math.abs(debt.changeSincePrevYearEnd),
                      )}`}
                </p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Debt / income
                </p>
                <p className="font-semibold text-slate-900">
                  {debt.debtToIncomeLatestYear === null
                    ? "—"
                    : `${(debt.debtToIncomeLatestYear * 100).toLocaleString("sv-SE", { maximumFractionDigits: 0 })}%`}
                </p>
              </div>
            </div>
            <div
              className="h-44 cursor-pointer rounded-md border border-slate-100 bg-white p-2"
              onClick={() => onOpenDrilldownDialog({ kind: "debt" })}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
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
                    formatter={(value) => currency(Number(value))}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="debt"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    name="Debt"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="max-h-56 overflow-auto rounded-md border border-slate-100 bg-white">
              {accounts.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="hidden text-right md:table-cell">
                        Δ
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-[180px] truncate font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {currency(row.current)}
                        </TableCell>
                        <TableCell className="hidden text-right text-xs md:table-cell">
                          {row.delta === null ? (
                            "—"
                          ) : (
                            <span
                              className={
                                row.delta <= 0
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                              }
                            >
                              {row.delta >= 0 ? "+" : "−"}
                              {currency(Math.abs(row.delta))}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-4 text-sm text-slate-600">
                  No debt accounts found.
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
