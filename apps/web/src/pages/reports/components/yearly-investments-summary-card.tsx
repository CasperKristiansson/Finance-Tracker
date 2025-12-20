import React, { useMemo } from "react";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
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

import type { YearlyOverviewResponse } from "@/types/api";

import type { DetailDialogState } from "../reports-types";

import {
  compactCurrency,
  currency,
  formatDate,
  monthLabel,
  percent,
} from "../reports-utils";

type InvestmentsSummary = {
  asOf: string;
  start: number;
  end: number;
  change: number;
  changePct: number | null;
  contributions: number;
  withdrawals: number;
  monthly: Array<{ month: string; value: number }>;
  accounts: Array<{
    name: string;
    start: number;
    end: number;
    change: number;
  }>;
};

export const YearlyInvestmentsSummaryCard: React.FC<{
  year: number;
  overview: YearlyOverviewResponse | null;
  onOpenDetailDialog: (state: DetailDialogState) => void;
}> = ({ year, overview, onOpenDetailDialog }) => {
  const investmentsSummary = useMemo<InvestmentsSummary | null>(() => {
    if (!overview?.investments_summary) return null;
    const monthly = overview.investments_summary.monthly_values.map(
      (value, idx) => ({
        month: monthLabel(new Date(Date.UTC(year, idx, 1)).toISOString()),
        value: Number(value),
      }),
    );
    const accounts = overview.investments_summary.accounts
      .map((row) => ({
        name: row.account_name,
        start: Number(row.start_value),
        end: Number(row.end_value),
        change: Number(row.change),
      }))
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
    return {
      asOf: overview.investments_summary.as_of,
      start: Number(overview.investments_summary.start_value),
      end: Number(overview.investments_summary.end_value),
      change: Number(overview.investments_summary.change),
      changePct: overview.investments_summary.change_pct
        ? Number(overview.investments_summary.change_pct)
        : null,
      contributions: Number(overview.investments_summary.contributions),
      withdrawals: Number(overview.investments_summary.withdrawals),
      monthly,
      accounts,
    };
  }, [overview?.investments_summary, year]);

  const hasOverview = Boolean(overview);
  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <CardTitle className="text-base font-semibold text-slate-900">
            Investments summary
          </CardTitle>
          <p className="text-xs text-slate-500">
            Snapshot-based (not a spending category).
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!hasOverview || !investmentsSummary}
          onClick={() => {
            if (!investmentsSummary) return;
            onOpenDetailDialog({
              kind: "investments",
              title: `Investments (${year})`,
              asOf: investmentsSummary.asOf,
              monthly: investmentsSummary.monthly,
              accounts: investmentsSummary.accounts.map((row) => ({
                name: row.name,
                start: row.start,
                end: row.end,
                change: row.change,
              })),
              summary: {
                start: investmentsSummary.start,
                end: investmentsSummary.end,
                change: investmentsSummary.change,
                changePct: investmentsSummary.changePct,
                contributions: investmentsSummary.contributions,
                withdrawals: investmentsSummary.withdrawals,
              },
            });
          }}
        >
          Details
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasOverview || !investmentsSummary ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  As of
                </p>
                <p className="font-semibold text-slate-900">
                  {formatDate(investmentsSummary.asOf)}
                </p>
              </div>
              <div className="rounded-md border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Value
                </p>
                <p className="font-semibold text-slate-900">
                  {currency(investmentsSummary.end)}
                </p>
                <p className="text-xs text-slate-500">
                  {investmentsSummary.change >= 0 ? "+" : "−"}
                  {currency(Math.abs(investmentsSummary.change))}{" "}
                  {investmentsSummary.changePct !== null
                    ? `(${percent(investmentsSummary.changePct)})`
                    : ""}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-slate-100 bg-white p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Contributions
                </p>
                <p className="font-semibold text-slate-900">
                  {currency(investmentsSummary.contributions)}
                </p>
              </div>
              <div className="rounded-md border border-slate-100 bg-white p-3">
                <p className="text-xs tracking-wide text-slate-500 uppercase">
                  Withdrawals
                </p>
                <p className="font-semibold text-slate-900">
                  {currency(investmentsSummary.withdrawals)}
                </p>
              </div>
            </div>

            <div className="h-44 rounded-md border border-slate-100 bg-white p-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={investmentsSummary.monthly}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="month"
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
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#4f46e5"
                    fill="rgba(79,70,229,0.15)"
                    strokeWidth={2}
                    name="Portfolio"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-md border border-slate-100">
              <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                Accounts
              </div>
              <div className="max-h-44 overflow-auto">
                {investmentsSummary.accounts.length ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">End</TableHead>
                        <TableHead className="text-right">Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {investmentsSummary.accounts.map((row) => (
                        <TableRow
                          key={row.name}
                          className="cursor-pointer"
                          onClick={() => {
                            onOpenDetailDialog({
                              kind: "investments",
                              title: `${row.name} (${year})`,
                              asOf: investmentsSummary.asOf,
                              monthly: investmentsSummary.monthly,
                              accounts: [
                                {
                                  name: row.name,
                                  start: row.start,
                                  end: row.end,
                                  change: row.change,
                                },
                              ],
                              summary: {
                                start: row.start,
                                end: row.end,
                                change: row.change,
                                changePct:
                                  row.start > 0
                                    ? (row.change / row.start) * 100
                                    : null,
                                contributions: 0,
                                withdrawals: 0,
                              },
                            });
                          }}
                        >
                          <TableCell className="font-medium">
                            {row.name}
                          </TableCell>
                          <TableCell className="text-right">
                            {currency(row.end)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            <span
                              className={
                                row.change >= 0
                                  ? "text-emerald-700"
                                  : "text-rose-700"
                              }
                            >
                              {row.change >= 0 ? "+" : "−"}
                              {currency(Math.abs(row.change))}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="p-3 text-sm text-slate-500">
                    No investment accounts captured yet.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
