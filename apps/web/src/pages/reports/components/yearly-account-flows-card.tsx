import React from "react";

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

import type { DetailDialogState } from "../reports-types";
import { currency } from "../reports-utils";

export type AccountFlowRow = {
  id: string;
  name: string;
  accountType: string;
  startBalance: number;
  endBalance: number;
  netOperating: number;
  netTransfers: number;
  change: number;
  monthly: Array<{
    month: string;
    income: number;
    expense: number;
    transfersIn: number;
    transfersOut: number;
    change: number;
  }>;
};

export const YearlyAccountFlowsCard: React.FC<{
  year: number;
  hasOverview: boolean;
  rows: AccountFlowRow[];
  onOpenDetailDialog: (state: DetailDialogState) => void;
}> = ({ year, hasOverview, rows, onOpenDetailDialog }) => {
  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          Account flows
        </CardTitle>
        <p className="text-xs text-slate-500">
          Net operating (income − expense) vs net transfers. Click a row for
          monthly detail.
        </p>
      </CardHeader>
      <CardContent className="max-h-[32rem] overflow-auto">
        {!hasOverview ? (
          <Skeleton className="h-56 w-full" />
        ) : rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Net operating
                </TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Net transfers
                </TableHead>
                <TableHead className="text-right">Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => {
                    onOpenDetailDialog({
                      kind: "account",
                      title: `${row.name} (${year})`,
                      accountType: row.accountType,
                      startBalance: row.startBalance,
                      endBalance: row.endBalance,
                      change: row.change,
                      monthly: row.monthly,
                    });
                  }}
                >
                  <TableCell className="max-w-[220px] truncate font-medium">
                    {row.name}
                    <span className="ml-2 text-xs text-slate-500">
                      ({row.accountType})
                    </span>
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    {currency(row.netOperating)}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    {currency(row.netTransfers)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <span
                      className={
                        row.change >= 0 ? "text-emerald-700" : "text-rose-700"
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
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            No account flows available.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
