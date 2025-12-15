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

import type { TotalDrilldownState } from "../reports-types";
import { currency } from "../reports-utils";

export const TotalAccountsOverviewCard: React.FC<{
  hasOverview: boolean;
  rows: Array<{
    id: string;
    name: string;
    type: string;
    balance: number;
    netOperating: number;
    netTransfers: number;
    firstDate: string | null;
  }>;
  onOpenDrilldownDialog: (state: TotalDrilldownState) => void;
}> = ({ hasOverview, rows, onOpenDrilldownDialog }) => {
  return (
    <Card className="border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold text-slate-900">
          Accounts overview
        </CardTitle>
        <p className="text-xs text-slate-500">
          Current balance plus lifetime operating and transfers totals.
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
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Net operating
                </TableHead>
                <TableHead className="hidden text-right md:table-cell">
                  Net transfers
                </TableHead>
                <TableHead className="hidden md:table-cell">First tx</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() =>
                    onOpenDrilldownDialog({
                      kind: "account",
                      accountId: row.id,
                      name: row.name,
                      accountType: row.type,
                    })
                  }
                >
                  <TableCell className="max-w-[220px] truncate font-medium">
                    {row.name}
                  </TableCell>
                  <TableCell className="hidden text-xs text-slate-600 md:table-cell">
                    {row.type}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {currency(row.balance)}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    {currency(row.netOperating)}
                  </TableCell>
                  <TableCell className="hidden text-right md:table-cell">
                    {currency(row.netTransfers)}
                  </TableCell>
                  <TableCell className="hidden text-xs text-slate-600 md:table-cell">
                    {row.firstDate ? new Date(row.firstDate).getFullYear() : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-md border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            No accounts available.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

