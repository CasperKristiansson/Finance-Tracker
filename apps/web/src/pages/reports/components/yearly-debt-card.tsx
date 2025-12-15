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

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { DetailDialogState } from "../reports-types";
import { currency } from "../reports-utils";
import { ChartCard } from "./chart-card";

type DebtChartPoint = { month: string; debt: number };

export type DebtOverviewRow = {
  id: string;
  name: string;
  startDebt: number;
  endDebt: number;
  delta: number;
  monthly: Array<{ month: string; value: number }>;
};

export const YearlyDebtCard: React.FC<{
  year: number;
  loading: boolean;
  debtChart: DebtChartPoint[];
  debtOverviewRows: DebtOverviewRow[];
  onOpenDetailDialog: (state: DetailDialogState) => void;
}> = ({ year, loading, debtChart, debtOverviewRows, onOpenDetailDialog }) => {
  return (
    <ChartCard
      title="Debt"
      description="Trend and breakdown by account."
      loading={loading}
    >
      <Tabs defaultValue="trend" className="flex h-full flex-col">
        <TabsList className="self-start">
          <TabsTrigger value="trend">Trend</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
        </TabsList>
        <TabsContent value="trend" className="mt-2 min-h-0 flex-1">
          <div className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={debtChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                />
                <YAxis hide />
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
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
        <TabsContent
          value="accounts"
          className="mt-2 min-h-0 flex-1 overflow-auto"
        >
          {debtOverviewRows.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">End</TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Δ
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtOverviewRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => {
                      onOpenDetailDialog({
                        kind: "debt",
                        title: `${row.name} (${year})`,
                        monthly: row.monthly,
                        startDebt: row.startDebt,
                        endDebt: row.endDebt,
                        delta: row.delta,
                      });
                    }}
                  >
                    <TableCell className="max-w-[180px] truncate font-medium">
                      {row.name}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {currency(row.endDebt)}
                    </TableCell>
                    <TableCell className="hidden text-right text-xs md:table-cell">
                      <span
                        className={
                          row.delta <= 0 ? "text-emerald-700" : "text-rose-700"
                        }
                      >
                        {row.delta >= 0 ? "+" : "−"}
                        {currency(Math.abs(row.delta))}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
              No debt accounts found for this selection.
            </div>
          )}
        </TabsContent>
      </Tabs>
    </ChartCard>
  );
};
