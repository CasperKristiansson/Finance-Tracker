import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
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

export type TotalInvestmentsSnapshot = {
  series: Array<{ date: string; value: number }>;
  yearly: Array<{
    year: number;
    endValue: number;
    netContributions: number;
    impliedReturn: number | null;
  }>;
  accounts: Array<{ name: string; value: number }>;
};

export const TotalInvestmentsSnapshotCard: React.FC<{
  hasOverview: boolean;
  investments: TotalInvestmentsSnapshot | null;
  investmentsYearlyTable: TotalInvestmentsSnapshot["yearly"];
  onOpenDrilldownDialog: (state: TotalDrilldownState) => void;
}> = ({ hasOverview, investments, investmentsYearlyTable, onOpenDrilldownDialog }) => {
  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          Investments (snapshot-based)
        </CardTitle>
        <p className="text-xs text-slate-500">Value is tracked via snapshots.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasOverview ? (
          <Skeleton className="h-56 w-full" />
        ) : !investments ? (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            No investment snapshots yet.
          </div>
        ) : (
          <>
            <div
              className="h-44 cursor-pointer rounded-md border border-slate-100 bg-white p-2"
              onClick={() => onOpenDrilldownDialog({ kind: "investments" })}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={investments.series}>
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

            <div className="max-h-56 overflow-auto rounded-md border border-slate-100 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Year</TableHead>
                    <TableHead className="text-right">End</TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      Net contrib
                    </TableHead>
                    <TableHead className="hidden text-right md:table-cell">
                      Implied return
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investmentsYearlyTable.map((row) => (
                    <TableRow key={row.year}>
                      <TableCell className="font-medium">{row.year}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(row.endValue)}
                      </TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        {currency(row.netContributions)}
                      </TableCell>
                      <TableCell className="hidden text-right md:table-cell">
                        {row.impliedReturn === null ? "—" : currency(row.impliedReturn)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="max-h-44 overflow-auto rounded-md border border-slate-100 bg-white">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {investments.accounts.map((row) => (
                    <TableRow key={row.name}>
                      <TableCell className="max-w-[220px] truncate font-medium">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {currency(row.value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

