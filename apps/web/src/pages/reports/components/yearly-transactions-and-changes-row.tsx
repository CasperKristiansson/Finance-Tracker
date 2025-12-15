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

import type { YearlyOverviewResponse } from "@/types/api";
import { currency } from "../reports-utils";

export const YearlyTransactionsAndChangesRow: React.FC<{
  overview: YearlyOverviewResponse | null;
  onOpenOneOffs: () => void;
  onSelectExpenseCategory: (categoryId: string) => void;
}> = ({ overview, onOpenOneOffs, onSelectExpenseCategory }) => {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">
            Largest transactions
          </CardTitle>
          <p className="text-xs text-slate-500">
            High-impact items with category and note.
          </p>
        </CardHeader>
        <CardContent className="max-h-[22rem] overflow-auto">
          {!overview ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.largest_transactions.slice(0, 8).map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={onOpenOneOffs}
                  >
                    <TableCell className="max-w-[160px] truncate font-medium">
                      {row.merchant}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs text-slate-600">
                      {row.category_name}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {currency(Number(row.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="h-full border-slate-200 shadow-[0_10px_40px_-20px_rgba(15,23,42,0.4)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-slate-900">
            Category changes
          </CardTitle>
          <p className="text-xs text-slate-500">
            Ranked by increased spend vs last year.
          </p>
        </CardHeader>
        <CardContent className="max-h-[22rem] overflow-auto">
          {!overview ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead className="text-right">This year</TableHead>
                  <TableHead className="text-right">YoY</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.category_changes.map((row) => (
                  <TableRow
                    key={row.name}
                    className={row.category_id ? "cursor-pointer" : undefined}
                    onClick={() => {
                      if (!row.category_id) return;
                      onSelectExpenseCategory(row.category_id);
                    }}
                  >
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {currency(Number(row.delta))}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency(Number(row.amount))}
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-600">
                      {row.delta_pct
                        ? `${Math.round(Number(row.delta_pct))}%`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
